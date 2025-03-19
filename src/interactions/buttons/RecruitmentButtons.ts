import { ButtonInteraction, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from 'discord.js';
import { RecruitmentManager } from '../../managers/RecruitmentManager';
import { RecruitSessionManager } from '../../managers/RecruitSessionManager';
import { Element, ContentType } from '../../structures/Recruitment';
import { generateTimeButtons, generateParticipantTimeButtons } from '../../utils/TimeButtons';
import { Logger } from '../../utils/Logger';

/**
 * カレンダーボタンのハンドラ
 */
export async function handleCalendarButton(interaction: ButtonInteraction) {
    const customId = interaction.customId;
    const sessionManager = interaction.client.recruitSessionManager as RecruitSessionManager;
    
    // セッションIDを取得
    const match = customId.match(/calendar_\w+_(.+)$/);
    if (!match) return;
    
    const sessionId = match[1];
    const session = sessionManager.getSession(sessionId);
    
    if (!session) {
        return await interaction.reply({
            content: 'セッションが見つかりませんでした。もう一度 `/募集` コマンドを実行してください。',
            ephemeral: true
        });
    }
    
    try {
        if (customId.startsWith('calendar_prev_')) {
            // 前月表示処理
            session.calendarUI.prevMonth();
            const calendarRows = session.calendarUI.generateCalendar(sessionId);
            
            await interaction.update({
                content: `${session.contentType}募集の作成 - 開催日を選択してください：`,
                components: calendarRows
            });
            
        } else if (customId.startsWith('calendar_next_')) {
            // 次月表示処理
            session.calendarUI.nextMonth();
            const calendarRows = session.calendarUI.generateCalendar(sessionId);
            
            await interaction.update({
                content: `${session.contentType}募集の作成 - 開催日を選択してください：`,
                components: calendarRows
            });
            
        } else if (customId.startsWith('calendar_date_')) {
            // 日付選択処理
            const dayMatch = customId.match(/calendar_date_(\d+)/);
            if (!dayMatch) return;
            
            const day = parseInt(dayMatch[1]);
            const selectedDate = session.calendarUI.getSelectedDate(day);
            
            // セッション更新
            sessionManager.updateSession(sessionId, {
                selectedDate,
                step: 'time_selection'
            });
            
            // 時間選択ボタンを表示
            // 時間選択ボタンを表示
            const timeButtons = generateTimeButtons(sessionId);
            const { year, month } = session.calendarUI.getCurrentYearMonth();
            
            await interaction.update({
                content: `${session.contentType}募集 - ${year}年${month + 1}月${day}日の開始時間を選択してください：`,
                components: timeButtons
            });
            
            Logger.info(`${interaction.user.username} が日付を選択しました: ${year}年${month + 1}月${day}日`);
        }
    } catch (error) {
        Logger.error('カレンダーボタン処理エラー:', error);
        await interaction.reply({
            content: '処理中にエラーが発生しました。もう一度お試しください。',
            ephemeral: true
        });
    }
}

/**
 * 時間選択ボタンのハンドラ
 */
export async function handleTimeButton(interaction: ButtonInteraction) {
    const customId = interaction.customId;
    const sessionManager = interaction.client.recruitSessionManager as RecruitSessionManager;
    
    // セッションIDを取得
    const match = customId.match(/time_select_(\d\d:\d\d)_(.+)$/);
    if (!match) return;
    
    const selectedTime = match[1];
    const sessionId = match[2];
    const session = sessionManager.getSession(sessionId);
    
    if (!session) {
        return await interaction.reply({
            content: 'セッションが見つかりませんでした。もう一度 `/募集` コマンドを実行してください。',
            ephemeral: true
        });
    }
    
    try {
        // セッション更新
        sessionManager.updateSession(sessionId, {
            selectedTime,
            step: 'note_input'
        });
        
        // 備考入力用モーダル表示
        const modal = new ModalBuilder()
            .setCustomId(`recruit_modal_${sessionId}`)
            .setTitle(`${session.contentType}募集作成`);
        
        const noteInput = new TextInputBuilder()
            .setCustomId('note')
            .setLabel('備考 (任意)')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('例: 初心者歓迎です')
            .setRequired(false);
        
        const firstActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(noteInput);
        
        modal.addComponents(firstActionRow);
        
        await interaction.showModal(modal);
        
        Logger.info(`${interaction.user.username} が時間を選択しました: ${selectedTime}`);
    } catch (error) {
        Logger.error('時間選択ボタン処理エラー:', error);
        await interaction.reply({
            content: '処理中にエラーが発生しました。もう一度お試しください。',
            ephemeral: true
        });
    }
}

/**
 * 参加者の時間選択ボタンハンドラ
 */
export async function handleParticipantTimeButton(interaction: ButtonInteraction) {
    const customId = interaction.customId;
    const recruitmentManager = interaction.client.recruitmentManager as RecruitmentManager;
    
    // 時間とレクルートメントIDを抽出
    const match = customId.match(/participant_time_(\d\d:\d\d)_(.+)$/);
    if (!match) return;
    
    const selectedTime = match[1];
    const recruitmentId = match[2];
    
    try {
        const result = await recruitmentManager.setParticipantAvailableTime(
            recruitmentId,
            interaction.user.id,
            interaction.user.username,
            selectedTime
        );
        
        await interaction.reply({
            content: result.message,
            ephemeral: true
        });
        
        Logger.info(`${interaction.user.username} が参加可能時間を設定しました: ${selectedTime} (募集ID: ${recruitmentId})`);
    } catch (error) {
        Logger.error('参加者時間選択エラー:', error);
        await interaction.reply({
            content: '処理中にエラーが発生しました。もう一度お試しください。',
            ephemeral: true
        });
    }
}

/**
 * 属性選択ボタンハンドラ
 */
export async function handleElementButton(interaction: ButtonInteraction) {
    const customId = interaction.customId;
    const recruitmentManager = interaction.client.recruitmentManager as RecruitmentManager;
    
    // 属性とレクルートメントIDを抽出
    const match = customId.match(/element_(.+?)_(.+)$/);
    if (!match) return;
    
    const element = match[1] as Element;
    const recruitmentId = match[2];
    
    try {
        const result = await recruitmentManager.addParticipant(
            recruitmentId,
            interaction.user.id,
            interaction.user.username,
            element
        );
        
        await interaction.reply({
            content: result.message,
            ephemeral: true
        });
        
        Logger.info(`${interaction.user.username} が ${element} 属性で参加表明しました (募集ID: ${recruitmentId})`);
    } catch (error) {
        Logger.error('属性選択エラー:', error);
        await interaction.reply({
            content: '処理中にエラーが発生しました。もう一度お試しください。',
            ephemeral: true
        });
    }
}

/**
 * コンテンツ希望ボタンハンドラ
 */
export async function handleContentPreferenceButton(interaction: ButtonInteraction) {
    const customId = interaction.customId;
    const recruitmentManager = interaction.client.recruitmentManager as RecruitmentManager;
    
    // コンテンツ希望とレクルートメントIDを抽出
    const match = customId.match(/content_(.+?)_(.+)$/);
    if (!match) return;
    
    const preferredContent = match[1] as "天元" | "ルシゼロ" | "どれでも可";
    const recruitmentId = match[2];
    
    try {
        const result = await recruitmentManager.setParticipantContentPreference(
            recruitmentId,
            interaction.user.id,
            interaction.user.username,
            preferredContent
        );
        
        await interaction.reply({
            content: result.message,
            ephemeral: true
        });
        
        Logger.info(`${interaction.user.username} がコンテンツ希望を設定しました: ${preferredContent} (募集ID: ${recruitmentId})`);
    } catch (error) {
        Logger.error('コンテンツ希望選択エラー:', error);
        await interaction.reply({
            content: '処理中にエラーが発生しました。もう一度お試しください。',
            ephemeral: true
        });
    }
}

/**
 * コンテンツ確定ボタンハンドラ（主催者用）
 */
export async function handleConfirmContentButton(interaction: ButtonInteraction) {
    const customId = interaction.customId;
    const recruitmentManager = interaction.client.recruitmentManager as RecruitmentManager;
    
    // コンテンツ確定とレクルートメントIDを抽出
    const match = customId.match(/confirm_content_(.+?)_(.+)$/);
    if (!match) return;
    
    const contentType = match[1] as "天元" | "ルシゼロ";
    const recruitmentId = match[2];
    
    try {
        const result = await recruitmentManager.confirmContentType(
            recruitmentId,
            interaction.user.id,
            contentType
        );
        
        await interaction.reply({
            content: result.message,
            ephemeral: true
        });
        
        Logger.info(`${interaction.user.username} がコンテンツを確定しました: ${contentType} (募集ID: ${recruitmentId})`);
    } catch (error) {
        Logger.error('コンテンツ確定エラー:', error);
        await interaction.reply({
            content: '処理中にエラーが発生しました。もう一度お試しください。',
            ephemeral: true
        });
    }
}

/**
 * 参加取消ボタンハンドラ
 */
export async function handleCancelParticipationButton(interaction: ButtonInteraction) {
    const customId = interaction.customId;
    const recruitmentManager = interaction.client.recruitmentManager as RecruitmentManager;
    
    // レクルートメントIDを抽出
    const match = customId.match(/cancel_(.+)$/);
    if (!match) return;
    
    const recruitmentId = match[1];
    
    try {
        const result = await recruitmentManager.cancelParticipation(
            recruitmentId,
            interaction.user.id
        );
        
        await interaction.reply({
            content: result.message,
            ephemeral: true
        });
        
        Logger.info(`${interaction.user.username} が参加を取り消しました (募集ID: ${recruitmentId})`);
    } catch (error) {
        Logger.error('参加取消エラー:', error);
        await interaction.reply({
            content: '処理中にエラーが発生しました。もう一度お試しください。',
            ephemeral: true
        });
    }
}

/**
 * 参加者時間選択ボタンハンドラ
 */
export async function handleTimeSelectButton(interaction: ButtonInteraction) {
    const customId = interaction.customId;
    
    // レクルートメントIDを抽出
    const match = customId.match(/time_select_(.+)$/);
    if (!match) return;
    
    const recruitmentId = match[1];
    
    try {
        // 時間選択ボタンを表示
        const timeButtons = generateParticipantTimeButtons(recruitmentId);
        
        await interaction.reply({
            content: '参加可能な開始時間を選択してください：',
            components: timeButtons,
            ephemeral: true
        });
        
        Logger.info(`${interaction.user.username} が参加可能時間選択を開始しました (募集ID: ${recruitmentId})`);
    } catch (error) {
        Logger.error('参加者時間選択表示エラー:', error);
        await interaction.reply({
            content: '処理中にエラーが発生しました。もう一度お試しください。',
            ephemeral: true
        });
    }
}

/**
 * 募集締め切りボタンハンドラ
 */
export async function handleCloseRecruitmentButton(interaction: ButtonInteraction) {
    const customId = interaction.customId;
    const recruitmentManager = interaction.client.recruitmentManager as RecruitmentManager;
    
    // レクルートメントIDを抽出
    const match = customId.match(/close_(.+)$/);
    if (!match) return;
    
    const recruitmentId = match[1];
    
    try {
        const result = await recruitmentManager.closeRecruitment(
            recruitmentId,
            interaction.user.id
        );
        
        await interaction.reply({
            content: result.message,
            ephemeral: true
        });
        
        Logger.info(`${interaction.user.username} が募集を締め切りました (募集ID: ${recruitmentId})`);
    } catch (error) {
        Logger.error('募集締め切りエラー:', error);
        await interaction.reply({
            content: '処理中にエラーが発生しました。もう一度お試しください。',
            ephemeral: true
        });
    }
}