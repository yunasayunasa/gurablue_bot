import dotenv from 'dotenv';
dotenv.config();

export const config = {
    token: process.env.TOKEN || '',
    clientId: process.env.CLIENT_ID || '',
    guildId: process.env.GUILD_ID || '',
    
    // 埋め込みメッセージの色
    colors: {
        primary: 0x0099FF,      // 通常の募集
        success: 0x00FF99,      // 成功メッセージ
        danger: 0xFF6666,       // エラーメッセージ
        closed: 0x999999        // 閉じた募集
    },
    
    // 募集のデフォルト値
    defaults: {
        participantLimit: 6,    // 参加者上限
        sessionTimeout: 10 * 60 * 1000 // セッションタイムアウト（10分）
    }
};