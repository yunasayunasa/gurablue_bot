import { SlashCommandBuilder } from '@discordjs/builders';
import { CommandInteraction } from 'discord.js';
import { RecruitSessionManager } from '../managers/RecruitSessionManager';
import { CalendarUI } from '../utils/CalendarUI';
import { ContentType } from '../structures/Recruitment';
import { Logger } from '../utils/Logger';

// コマンド定義
export const data = new SlashCommandBuilder()
    .setName('募集')
    .setDescription('高難易度コンテンツの募集を開始します')
    .addStringOption(option => 
        option.setName('コンテンツ')
            .setDescription('募集するコンテンツを選択')
            .setRequired(true)
            .addChoices(
                { name: '天元', value: '天元' },
                { name: 'ルシゼロ', value: 'ルシゼロ' },
                { name: '参加者希望', value: '参加者希望' }
            )
    );

// コマンドハンドラ
export async function execute(interaction: CommandInteraction) {
    try {
        // コンテンツタイプを取得
        const contentType = interaction.options.getString('コンテンツ') as ContentType;
        if (!contentType) {
            await interaction.reply({
                content: 'コンテンツタイプを選択してください。',
                ephemeral: true
            });
            return;
        }
        
        // 募集セッションを開始
        const sessionManager = interaction.client.recruitSessionManager as RecruitSessionManager;
        const sessionId = sessionManager.createSession(
            interaction.user.id,
            contentType
        );
        
        // カレンダーUIを表示
        const session = sessionManager.getSession(sessionId);
        if (!session) {
            await interaction.reply({
                content: 'セッション作成に失敗しました。',
                ephemeral: true
            });
            return;
        }
        
        const calendarRows = session.calendarUI.generateCalendar(sessionId);
        
        await interaction.reply({
            content: `${contentType}募集の作成を開始します。まずは開催日を選択してください：`,
            components: calendarRows,
            ephemeral: true
        });
        
        Logger.info(`${interaction.user.username} が募集作成を開始しました (コンテンツ: ${contentType})`);
    } catch (error) {
        Logger.error('募集コマンド実行エラー:', error);
        await interaction.reply({
            content: '募集の作成に失敗しました。しばらくしてからもう一度お試しください。',
            ephemeral: true
        });
    }
}