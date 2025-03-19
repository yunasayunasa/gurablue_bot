import { REST, Routes } from 'discord.js';
import { config } from './config';
import * as RecruitCommand from './commands/RecruitCommand';
import { Logger } from './utils/Logger';

const commands = [
    RecruitCommand.data.toJSON()
];

const rest = new REST({ version: '10' }).setToken(config.token);

// 開発サーバーにコマンドを登録（即時反映）
async function deployCommands() {
    try {
        Logger.info('スラッシュコマンドを登録中...');
        
        if (config.guildId) {
            // 特定のサーバーにコマンドを登録（開発用）
            await rest.put(
                Routes.applicationGuildCommands(config.clientId, config.guildId),
                { body: commands }
            );
            Logger.info(`サーバー ${config.guildId} にコマンドを登録しました。`);
        } else {
            // グローバルにコマンドを登録（本番用・反映に時間がかかる）
            await rest.put(
                Routes.applicationCommands(config.clientId),
                { body: commands }
            );
            Logger.info('グローバルにコマンドを登録しました。');
        }
    } catch (error) {
        Logger.error('コマンド登録エラー:', error);
    }
}

deployCommands();