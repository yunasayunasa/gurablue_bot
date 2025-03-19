import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

export function generateTimeButtons(sessionId: string): ActionRowBuilder<ButtonBuilder>[] {
    const rows: ActionRowBuilder<ButtonBuilder>[] = [];
    
    // 一般的なレイド時間帯を3行に分けて表示
    const timeSlots = [
        // 早めの時間帯
        ['18:00', '19:00', '20:00'],
        // 通常の時間帯
        ['21:00', '22:00', '23:00'],
        // 深夜の時間帯
        ['00:00', '01:00', '02:00']
    ];
    
    timeSlots.forEach((timeRow) => {
        const row = new ActionRowBuilder<ButtonBuilder>();
        
        timeRow.forEach(time => {
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`time_select_${time}_${sessionId}`)
                    .setLabel(time)
                    .setStyle(ButtonStyle.Primary)
            );
        });
        
        rows.push(row);
    });
    
    return rows;
}

// 参加者用の時間選択メニュー用ボタン
export function generateParticipantTimeButtons(recruitmentId: string): ActionRowBuilder<ButtonBuilder>[] {
    const rows: ActionRowBuilder<ButtonBuilder>[] = [];
    
    // 一般的なレイド時間帯を2行に分けて表示
    const timeSlots = [
        // 通常の時間帯
        ['19:00', '20:00', '21:00'],
        // 遅めの時間帯
        ['22:00', '23:00', '00:00']
    ];
    
    timeSlots.forEach((timeRow) => {
        const row = new ActionRowBuilder<ButtonBuilder>();
        
        timeRow.forEach(time => {
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`participant_time_${time}_${recruitmentId}`)
                    .setLabel(`${time}から参加可能`)
                    .setStyle(ButtonStyle.Secondary)
            );
        });
        
        rows.push(row);
    });
    
    return rows;
}