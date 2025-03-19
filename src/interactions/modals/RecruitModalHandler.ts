import { ModalSubmitInteraction } from 'discord.js';
import { RecruitSessionManager } from '../../managers/RecruitSessionManager';
import { RecruitmentManager } from '../../managers/RecruitmentManager';
import { Logger } from '../../utils/Logger';

export async function handleRecruitModal(interaction: ModalSubmitInteraction) {
    const customId = interaction.customId;
    
    // セッションIDを抽出
    const match = customId.match(/recruit_modal_(.+)$/);
    if (!match) return;
    
    const sessionId = match[1];
    const sessionManager = interaction.client.recruitSessionManager as RecruitSessionManager;
    const recruitmentManager = interaction.client.recruitmentManager as RecruitmentManager;
    
    try {
        const session = sessionManager.getSession(sessionId);
        if (!session) {
            await interaction.reply({
                content: 'セッションが見つかりません。もう一度 `/募集` コマンドを実行してください。',
                ephemeral: true
            });
            return;
        }
        
        // 必要なデータが揃っているか確認
        if (!session.selectedDate || !session.selectedTime) {
            await interaction.reply({
                content: '日付または時間が設定されていません。',
                ephemeral: true
            });
            return;
        }
        
        // 備考を取得
        const noteInput = interaction.fields.getTextInputValue('note');
        
        // 募集を作成
        const dateStr = `${session.selectedDate.getFullYear()}/${session.selectedDate.getMonth() + 1}/${session.selectedDate.getDate()}`;
        
        const recruitment = await recruitmentManager.createRecruitment(
            session.contentType,
            dateStr,
            session.selectedTime,
            interaction.user.id,
            interaction.user.username,
            interaction.channelId,
            noteInput || undefined
        );
        
        if (recruitment) {
            await interaction.reply({
                content: `${session.contentType}の募集を作成しました！`,
                ephemeral: true
            });
            
            // 主催者を自動的に参加登録（参加者希望の場合はコンテンツ選択が必要）
            if (session.contentType !== '参加者希望') {
                await recruitmentManager.addParticipant(
                    recruitment.id,
                    interaction.user.id,
                    interaction.user.username,
                    '火' // デフォルト属性
                );
            }
            
            // セッション削除
            sessionManager.deleteSession(sessionId);
        } else {
            await interaction.reply({
                content: '募集の作成に失敗しました。',
                ephemeral: true
            });
        }
        
        Logger.info(`${interaction.user.username} が募集作成を完了しました (${session.contentType})`);
    } catch (error) {
        Logger.error('モーダル送信エラー:', error);
        await interaction.reply({
            content: '処理中にエラーが発生しました。もう一度お試しください。',
            ephemeral: true
        });
    }
}