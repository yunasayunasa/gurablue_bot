import { Client, GatewayIntentBits, Events, Collection, ButtonInteraction, ModalSubmitInteraction } from 'discord.js';
import { config } from './config';
import { RecruitmentManager } from './managers/RecruitmentManager';
import { RecruitSessionManager } from './managers/RecruitSessionManager';
import { Logger } from './utils/Logger';

// コマンドのインポート
import * as RecruitCommand from './commands/RecruitCommand';

// インタラクションハンドラのインポート
import {
    handleCalendarButton,
    handleTimeButton,
    handleParticipantTimeButton,
    handleElementButton,
    handleContentPreferenceButton,
    handleConfirmContentButton,
    handleCancelParticipationButton,
    handleTimeSelectButton,
    handleCloseRecruitmentButton
} from './interactions/buttons/RecruitmentButtons';

import { handleRecruitModal } from './interactions/modals/RecruitModalHandler';

// クライアントの初期化
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages
    ]
});

// クライアントにマネージャーをアタッチ
declare module 'discord.js' {
    interface Client {
        recruitmentManager: RecruitmentManager;
        recruitSessionManager: RecruitSessionManager;
        commands: Collection<string, { data: any, execute: Function }>;
    }
}

client.commands = new Collection();
client.commands.set(RecruitCommand.data.name, RecruitCommand);
client.recruitmentManager = new RecruitmentManager(client);
client.recruitSessionManager = new RecruitSessionManager();

// Ready イベント
client.once(Events.ClientReady, (c) => {
    Logger.info(`Logged in as ${c.user.tag}`);
    
    // クリーンアップタイマーを開始
    client.recruitSessionManager.startCleanupInterval();
});

// コマンド実行
client.on(Events.InteractionCreate, async (interaction) => {
    if (interaction.isCommand()) {
        const command = client.commands.get(interaction.commandName);
        
        if (!command) return;
        
        try {
            await command.execute(interaction);
        } catch (error) {
            Logger.error(`コマンド実行エラー: ${interaction.commandName}`, error);
            const content = '実行中にエラーが発生しました。';
            
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content, ephemeral: true });
            } else {
                await interaction.reply({ content, ephemeral: true });
            }
        }
    }
    
    // ボタンインタラクション
    if (interaction.isButton()) {
        const customId = interaction.customId;
        
        try {
            if (customId.startsWith('calendar_')) {
                await handleCalendarButton(interaction);
            } else if (customId.match(/time_select_\d\d:\d\d_/)) {
                await handleTimeButton(interaction);
            } else if (customId.startsWith('participant_time_')) {
                await handleParticipantTimeButton(interaction);
            } else if (customId.startsWith('element_')) {
                await handleElementButton(interaction);
            } else if (customId.startsWith('content_')) {
                await handleContentPreferenceButton(interaction);
            } else if (customId.startsWith('confirm_content_')) {
                await handleConfirmContentButton(interaction);
            } else if (customId.startsWith('cancel_')) {
                await handleCancelParticipationButton(interaction);
            } else if (customId.match(/time_select_[^_]+$/)) {
                await handleTimeSelectButton(interaction);
            } else if (customId.startsWith('close_')) {
                await handleCloseRecruitmentButton(interaction);
            }
        } catch (error) {
            Logger.error(`ボタンハンドリングエラー: ${customId}`, error);
            await safeReply(interaction, '処理中にエラーが発生しました。');
        }
    }
    
    // モーダル送信
    if (interaction.isModalSubmit()) {
        const customId = interaction.customId;
        
        try {
            if (customId.startsWith('recruit_modal_')) {
                await handleRecruitModal(interaction);
            }
        } catch (error) {
            Logger.error(`モーダル処理エラー: ${customId}`, error);
            await safeReply(interaction, '処理中にエラーが発生しました。');
        }
    }
});

// 安全な返信関数
async function safeReply(interaction: ButtonInteraction | ModalSubmitInteraction, content: string): Promise<void> {
    try {
        if (interaction.replied) {
            await interaction.followUp({ content, ephemeral: true });
        } else {
            await interaction.reply({ content, ephemeral: true });
        }
    } catch (error) {
        Logger.error('返信エラー', error);
    }
}

// ログイン
client.login(config.token).catch(error => {
    Logger.error('ログインエラー:', error);
    process.exit(1);
});