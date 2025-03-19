import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

export class CalendarUI {
    private year: number;
    private month: number; // 0-11
    
    constructor() {
        const now = new Date();
        this.year = now.getFullYear();
        this.month = now.getMonth();
    }
    
    // 月を変更
    setMonth(year: number, month: number) {
        this.year = year;
        this.month = month;
    }
    
    // 次の月に移動
    nextMonth() {
        if (this.month === 11) {
            this.month = 0;
            this.year++;
        } else {
            this.month++;
        }
    }
    
    // 前の月に移動
    prevMonth() {
        if (this.month === 0) {
            this.month = 11;
            this.year--;
        } else {
            this.month--;
        }
    }
    
    // カレンダーUIを生成
    generateCalendar(sessionId: string): ActionRowBuilder<ButtonBuilder>[] {
        const rows: ActionRowBuilder<ButtonBuilder>[] = [];
        
        // 月選択ヘッダー
        const headerRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId(`calendar_prev_${sessionId}`)
                .setLabel('◀')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`calendar_header_${sessionId}`)
                .setLabel(`${this.year}年${this.month + 1}月`)
                .setStyle(ButtonStyle.Primary)
                .setDisabled(true),
            new ButtonBuilder()
                .setCustomId(`calendar_next_${sessionId}`)
                .setLabel('▶')
                .setStyle(ButtonStyle.Secondary)
        );
        rows.push(headerRow);
        
        // 曜日ヘッダー
        const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
        const weekdayButtons = weekdays.map((day, index) => 
            new ButtonBuilder()
                .setCustomId(`calendar_weekday_${index}_${sessionId}`)
                .setLabel(day)
                .setStyle(index === 0 ? ButtonStyle.Danger : ButtonStyle.Secondary)
                .setDisabled(true)
        );
        
        const weekdayRow = new ActionRowBuilder<ButtonBuilder>().addComponents(...weekdayButtons);
        rows.push(weekdayRow);
        
        // 日付ボタン（最大5週間分表示）
        const firstDay = new Date(this.year, this.month, 1);
        const lastDay = new Date(this.year, this.month + 1, 0);
        const daysInMonth = lastDay.getDate();
        
        let currentDay = 1;
        let currentWeek = 0;
        
        while (currentDay <= daysInMonth && currentWeek < 5) {
            const weekButtonsRow = new ActionRowBuilder<ButtonBuilder>();
            
            // 1週間分のボタン
            for (let i = 0; i < 7; i++) {
                if ((currentWeek === 0 && i < firstDay.getDay()) || currentDay > daysInMonth) {
                    // 空白ボタン（月の初めの空白または月末後の空白）
                    weekButtonsRow.addComponents(
                        new ButtonBuilder()
                            .setCustomId(`calendar_empty_${currentWeek}_${i}_${sessionId}`)
                            .setLabel(' ')
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(true)
                    );
                } else {
                    // 日付ボタン
                    const today = new Date();
                    const isToday = 
                        today.getFullYear() === this.year && 
                        today.getMonth() === this.month && 
                        today.getDate() === currentDay;
                    
                    const isPast = 
                        new Date(this.year, this.month, currentDay) < 
                        new Date(today.getFullYear(), today.getMonth(), today.getDate());
                    
                    weekButtonsRow.addComponents(
                        new ButtonBuilder()
                            .setCustomId(`calendar_date_${currentDay}_${sessionId}`)
                            .setLabel(`${currentDay}`)
                            .setStyle(isToday ? ButtonStyle.Success : ButtonStyle.Secondary)
                            .setDisabled(isPast) // 過去の日付は選択不可
                    );
                    
                    currentDay++;
                }
            }
            
            rows.push(weekButtonsRow);
            currentWeek++;
        }
        
        return rows;
    }
    
    // 選択された日付から Date オブジェクトを生成
    getSelectedDate(day: number): Date {
        return new Date(this.year, this.month, day);
    }
    
    // 現在の年月を取得
    getCurrentYearMonth(): {year: number, month: number} {
        return {
            year: this.year,
            month: this.month
        };
    }
}