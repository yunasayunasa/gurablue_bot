import { 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    TextChannel,
    Client,
    Message
} from 'discord.js';
import { 
    Recruitment, 
    ParticipantData, 
    Element, 
    ELEMENTS,
    ContentType,
    GlobalParticipationManager
} from '../structures/Recruitment';
import { config } from '../config';
import { Logger } from '../utils/Logger';
import { RECRUITMENT_CONSTANTS } from '../config/constants';
import {
    RecruitmentStatus,
    ContentPreference,
    ParticipantPreference,
    RecruitmentResult,
    RecruitmentError
} from '../types/recruitment';

type ChannelType = TextChannel | null;

export class RecruitmentManager {
    private recruitments: Map<string, Recruitment> = new Map();
    private client: Client;
    private globalParticipationManager: GlobalParticipationManager;
    selectParticipants: any;
    
    constructor(client: Client) {
        this.client = client;
        this.globalParticipationManager = new GlobalParticipationManager();
    }
    
    /**
     * 募集を作成する
     */
    async createRecruitment(
        contentType: ContentType,
        dateStr: string,
        timeStr: string,
        hostId: string,
        hostName: string,
        channelId: string,
        note?: string
    ): Promise<RecruitmentResult> {
        try {
            // 日付と時間の検証
            const dateTime = this.validateDateTime(dateStr, timeStr);
            if (!dateTime.success) {
                return dateTime;
            }
            
            const startTime = dateTime.date!;
            
            // チャンネルを取得
            const channel = await this.safeChannelFetch(channelId);
            if (!channel) {
                return {
                    success: false,
                    message: `チャンネルが見つかりません: ${channelId}`,
                    error: new RecruitmentError('Channel not found', 'CHANNEL_NOT_FOUND')
                };
            }
            
            // 募集メッセージを作成
            const recruitment: Recruitment = {
                id: '',  // メッセージIDで後で設定
                contentType,
                startTime,
                hostId,
                hostName,
                channelId,
                note,
                participants: new Map(),
                status: 'open'
            };
            
            const embed = this.createRecruitmentEmbed(recruitment);
            const components = this.createRecruitmentComponents(recruitment);
            
            const message = await this.sendRecruitmentMessage(channel, embed, components);
            if (!message) {
                return {
                    success: false,
                    message: "メッセージの送信に失敗しました",
                    error: new RecruitmentError('Failed to send message', 'MESSAGE_SEND_FAILED')
                };
            }
            
            // IDを設定して保存
            recruitment.id = message.id;
            this.recruitments.set(message.id, recruitment);
            
            Logger.info(`募集作成: ${message.id} (${contentType}, ${hostName})`);
            return {
                success: true,
                message: "募集の作成に成功しました"
            };
        } catch (error) {
            Logger.error('募集作成エラー:', error);
            return {
                success: false,
                message: "募集の作成に失敗しました",
                error: error instanceof Error ? error : new Error(String(error))
            };
        }
    }

    /**
     * チャンネルの安全な取得
     */
    private async safeChannelFetch(channelId: string): Promise<ChannelType> {
        try {
            const channel = await this.client.channels.fetch(channelId);
            if (!channel || !(channel instanceof TextChannel)) {
                throw new RecruitmentError(
                    `Invalid channel type or not found: ${channelId}`,
                    'INVALID_CHANNEL'
                );
            }
            return channel;
        } catch (error) {
            Logger.error('Channel fetch error:', {
                channelId,
                error: error instanceof Error ? error.message : String(error)
            });
            return null;
        }
    }

    /**
     * 日付と時間の検証
     */
    private validateDateTime(dateStr: string, timeStr: string): RecruitmentResult & { date?: Date } {
        try {
            const [year, month, day] = dateStr.split('/').map(num => parseInt(num));
            const [hour, minute] = timeStr.split(':').map(num => parseInt(num));
            
            if ([year, month, day, hour, minute].some(isNaN)) {
                return {
                    success: false,
                    message: "無効な日付または時間形式です"
                };
            }
            
            const date = new Date(year, month - 1, day, hour, minute);
            
            if (date < new Date()) {
                return {
                    success: false,
                    message: `無効な時間: ${dateStr} ${timeStr} (過去の日時は指定できません)`
                };
            }
            
            return {
                success: true,
                message: "日時の検証に成功しました",
                date
            };
        } catch (error) {
            return {
                success: false,
                message: "日付と時間の解析に失敗しました",
                error: error instanceof Error ? error : new Error(String(error))
            };
        }
    }

    /**
     * 募集メッセージの送信
     */
    private async sendRecruitmentMessage(
        channel: TextChannel,
        embed: EmbedBuilder,
        components: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[]
    ): Promise<Message | null> {
        try {
            return await channel.send({
                embeds: [embed],
                components
            });
        } catch (error) {
            Logger.error('メッセージ送信エラー:', error);
            return null;
        }
    }
        /**
     * 募集メッセージ用のEmbedを作成
     */
        private createRecruitmentEmbed(recruitment: Recruitment): EmbedBuilder {
            const dateStr = this.formatDateSafe(recruitment.startTime);
            const timeStr = this.formatTimeSafe(recruitment.startTime);
            
            const embed = new EmbedBuilder()
                .setTitle(`【${this.getDisplayContentType(recruitment)}】募集`)
                .setDescription(
                    `**開催日時**: ${dateStr} ${timeStr}～\n` +
                    `**主催者**: ${recruitment.hostName}\n` +
                    (recruitment.note ? `**備考**: ${recruitment.note}\n` : '') +
                    `\n**参加者状況** (${recruitment.participants.size}/${RECRUITMENT_CONSTANTS.MAX_PARTICIPANTS})\n`
                )
                .setColor(config.colors.primary)
                .setTimestamp();
            
            if (recruitment.status === 'open') {
                this.addOpenRecruitmentFields(embed, recruitment);
            } else {
                this.addClosedRecruitmentFields(embed, recruitment);
            }
            
            return embed;
        }
    
        /**
         * オープン状態の募集用のフィールドを追加
         */
        private addOpenRecruitmentFields(embed: EmbedBuilder, recruitment: Recruitment): void {
            // 属性ごとの参加者を集計
            const elementParticipants = this.aggregateElementParticipants(recruitment);
            
            // 属性ごとのフィールドを追加
            for (const element of ELEMENTS) {
                embed.addFields({
                    name: element,
                    value: elementParticipants[element]?.length 
                        ? elementParticipants[element]!.join(', ')
                        : '(未定)',
                    inline: true
                });
            }
            
            // 参加可能時間の表示
            const timeInfo = this.createTimeAvailabilityInfo(recruitment);
            if (timeInfo) {
                embed.addFields(timeInfo);
            }
            
            // コンテンツ希望の表示
            if (recruitment.contentType === '参加者希望') {
                const contentInfo = this.createContentPreferenceInfo(recruitment);
                if (contentInfo) {
                    embed.addFields(contentInfo);
                }
            }
        }
    
        /**
         * クローズ状態の募集用のフィールドを追加
         */
        private addClosedRecruitmentFields(embed: EmbedBuilder, recruitment: Recruitment): void {
            ELEMENTS.forEach(element => {
                const assignedUser = Array.from(recruitment.participants.values())
                    .find(p => p.assignedElement === element);
                
                embed.addFields({
                    name: element,
                    value: assignedUser ? assignedUser.username : '(未定)',
                    inline: true
                });
            });
            
            if (recruitment.waitingList?.length) {
                const waitingUsers = recruitment.waitingList
                    .map(id => recruitment.participants.get(id)?.username || id)
                    .join(', ');
                
                embed.addFields({
                    name: '【補欠メンバー】',
                    value: waitingUsers,
                    inline: false
                });
            }
            
            embed.setColor(config.colors.closed);
        }
    
        /**
         * 属性ごとの参加者を集計
         */
        private aggregateElementParticipants(recruitment: Recruitment): Record<Element, string[]> {
            const elementParticipants: Partial<Record<Element, string[]>> = {};
            
            ELEMENTS.forEach(element => {
                elementParticipants[element] = [];
            });
            
            for (const [_, participant] of recruitment.participants.entries()) {
                participant.preferredElements.forEach(element => {
                    elementParticipants[element]?.push(participant.username);
                });
            }
            
            return elementParticipants as Record<Element, string[]>;
        }
    
        /**
         * 参加可能時間の情報を作成
         */
        private createTimeAvailabilityInfo(recruitment: Recruitment): { name: string; value: string; inline: boolean } | null {
            const availableTimes: Record<string, string[]> = {};
            
            for (const [_, participant] of recruitment.participants.entries()) {
                if (participant.availableFromTime) {
                    if (!availableTimes[participant.availableFromTime]) {
                        availableTimes[participant.availableFromTime] = [];
                    }
                    availableTimes[participant.availableFromTime].push(participant.username);
                }
            }
            
            if (Object.keys(availableTimes).length === 0) {
                return null;
            }
            
            const timeText = Object.keys(availableTimes)
                .sort()
                .map(time => `${time}～: ${availableTimes[time].join(', ')}`)
                .join('\n');
            
            return {
                name: '【参加可能時間】',
                value: timeText,
                inline: false
            };
        }
    
        /**
         * コンテンツ希望の情報を作成
         */
        private createContentPreferenceInfo(recruitment: Recruitment): { name: string; value: string; inline: boolean } | null {
            const contentPreferences: Record<ContentPreference, string[]> = {
                '天元': [],
                'ルシゼロ': [],
                'どれでも可': []
            };
            
            for (const [_, participant] of recruitment.participants.entries()) {
                if (participant.preferredContent) {
                    contentPreferences[participant.preferredContent].push(participant.username);
                }
            }
            
            const contentText = Object.entries(contentPreferences)
                .filter(([_, users]) => users.length > 0)
                .map(([content, users]) => `${content}: ${users.join(', ')}`)
                .join('\n');
            
            if (!contentText) {
                return null;
            }
            
            return {
                name: '【コンテンツ希望】',
                value: contentText,
                inline: false
            };
        }
    
        /**
         * 募集メッセージのボタンを作成
         */
        private createRecruitmentComponents(recruitment: Recruitment): ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] {
            if (recruitment.status === 'closed') {
                return [];
            }
            
            const rows: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] = [];
            
            if (recruitment.contentType === '参加者希望' && !recruitment.confirmedContent) {
                rows.push(this.createContentPreferenceButtons(recruitment));
                rows.push(this.createHostContentConfirmationButtons(recruitment));
            } else {
                rows.push(...this.createElementSelectionButtons(recruitment));
            }
            
            rows.push(this.createCommonButtons(recruitment));
            rows.push(this.createCloseButton(recruitment));
            
            return rows;
        }
    
        /**
         * コンテンツ希望ボタンを作成
         */
        private createContentPreferenceButtons(recruitment: Recruitment): ActionRowBuilder<ButtonBuilder> {
            return new ActionRowBuilder<ButtonBuilder>()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`content_天元_${recruitment.id}`)
                        .setLabel('天元希望')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId(`content_ルシゼロ_${recruitment.id}`)
                        .setLabel('ルシゼロ希望')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId(`content_どれでも可_${recruitment.id}`)
                        .setLabel('どれでも可')
                        .setStyle(ButtonStyle.Secondary)
                );
        }
    
        /**
         * 主催者用のコンテンツ確定ボタンを作成
         */
        private createHostContentConfirmationButtons(recruitment: Recruitment): ActionRowBuilder<ButtonBuilder> {
            return new ActionRowBuilder<ButtonBuilder>()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`confirm_content_天元_${recruitment.id}`)
                        .setLabel('天元に確定')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId(`confirm_content_ルシゼロ_${recruitment.id}`)
                        .setLabel('ルシゼロに確定')
                        .setStyle(ButtonStyle.Success)
                );
        }
    
        /**
         * 属性選択ボタンを作成
         */
        private createElementSelectionButtons(recruitment: Recruitment): ActionRowBuilder<ButtonBuilder>[] {
            const elementRow1 = new ActionRowBuilder<ButtonBuilder>()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`element_火_${recruitment.id}`)
                        .setLabel('火')
                        .setStyle(ButtonStyle.Danger),
                    new ButtonBuilder()
                        .setCustomId(`element_水_${recruitment.id}`)
                        .setLabel('水')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId(`element_土_${recruitment.id}`)
                        .setLabel('土')
                        .setStyle(ButtonStyle.Success)
                );
            
            const elementRow2 = new ActionRowBuilder<ButtonBuilder>()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`element_風_${recruitment.id}`)
                        .setLabel('風')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId(`element_光_${recruitment.id}`)
                        .setLabel('光')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId(`element_闇_${recruitment.id}`)
                        .setLabel('闇')
                        .setStyle(ButtonStyle.Secondary)
                );
            
            return [elementRow1, elementRow2];
        }
            /**
     * 共通ボタンを作成
     */
    private createCommonButtons(recruitment: Recruitment): ActionRowBuilder<ButtonBuilder> {
        return new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`time_select_${recruitment.id}`)
                    .setLabel('参加可能時間を選択')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId(`cancel_${recruitment.id}`)
                    .setLabel('参加取消')
                    .setStyle(ButtonStyle.Danger)
            );
    }

    /**
     * 募集を閉じるボタンを作成
     */
    private createCloseButton(recruitment: Recruitment): ActionRowBuilder<ButtonBuilder> {
        return new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`close_${recruitment.id}`)
                    .setLabel('募集を閉じる')
                    .setStyle(ButtonStyle.Primary)
            );
    }

    /**
     * 参加者を追加する
     */
    async addParticipant(
        recruitmentId: string,
        userId: string,
        username: string,
        preferredElement?: Element
    ): Promise<RecruitmentResult> {
        try {
            const recruitment = await this.getValidRecruitment(recruitmentId);
            if (!recruitment.success) {
                return recruitment;
            }

            const participant = this.getOrCreateParticipant(recruitment.data, userId, username);
            
            if (preferredElement && !participant.preferredElements.includes(preferredElement)) {
                participant.preferredElements.push(preferredElement);
            }
            
            await this.updateRecruitmentMessage(recruitmentId);
            
            return {
                success: true,
                message: preferredElement 
                    ? `${username}さんが${preferredElement}属性で参加表明しました！`
                    : `${username}さんが参加表明しました！`
            };
        } catch (error) {
            return this.handleError('参加者追加エラー', error);
        }
    }

    /**
     * 有効な募集を取得
     */
    private async getValidRecruitment(recruitmentId: string): Promise<RecruitmentResult & { data?: Recruitment }> {
        const recruitment = this.recruitments.get(recruitmentId);
        if (!recruitment) {
            return { 
                success: false, 
                message: "募集が見つかりません。"
            };
        }
        
        if (recruitment.status === 'closed') {
            return { 
                success: false, 
                message: "この募集は既に締め切られています。"
            };
        }

        return {
            success: true,
            message: "募集が見つかりました",
            data: recruitment
        };
    }

    /**
     * 参加者情報を取得または作成
     */
    private getOrCreateParticipant(recruitment: Recruitment, userId: string, username: string): ParticipantData {
        let participant = recruitment.participants.get(userId);
        
        if (!participant) {
            participant = {
                userId,
                username,
                preferredElements: [],
                createdAt: new Date()
            };
            recruitment.participants.set(userId, participant);
        }
        
        return participant;
    }

    /**
     * エラーハンドリング
     */
    private handleError(context: string, error: unknown): RecruitmentResult {
        Logger.error(context, error);
        return {
            success: false,
            message: "操作に失敗しました",
            error: error instanceof Error ? error : new Error(String(error))
        };
    }

    /**
     * 日付の安全なフォーマット
     */
    private formatDateSafe(date: Date | null | undefined): string {
        if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
            return 'Invalid Date';
        }
        return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
    }

    /**
     * 時間の安全なフォーマット
     */
    private formatTimeSafe(date: Date | null | undefined): string {
        if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
            return 'Invalid Time';
        }
        return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    }

    /**
     * 募集を閉じる
     */
    async closeRecruitment(
        recruitmentId: string,
        userId: string
    ): Promise<RecruitmentResult> {
        try {
            const recruitment = await this.getValidRecruitment(recruitmentId);
            if (!recruitment.success || !recruitment.data) {
                return recruitment;
            }

            if (userId !== recruitment.data.hostId) {
                return {
                    success: false,
                    message: "主催者のみが募集を締め切れます。"
                };
            }

            recruitment.data.status = 'closed';
            
            // コンテンツタイプの自動決定
            await this.determineContentType(recruitment.data);
            
            // 参加者選出と属性割り振り
            recruitment.data.selectedParticipants = await this.selectParticipants(recruitment.data);
            await this.assignElementsToParticipants(recruitment.data);
            
            // メッセージの更新と結果通知
            await this.updateRecruitmentAndSendResults(recruitment.data);
            
            return {
                success: true,
                message: "募集を締め切り、メンバーを確定しました。"
            };
        } catch (error) {
            return this.handleError('募集締め切りエラー', error);
    }
}

    /**
     * コンテンツタイプを決定
     */
    private async determineContentType(recruitment: Recruitment): Promise<void> {
        if (!recruitment.confirmedContent && recruitment.contentType === '参加者希望') {
            const contentCounts = {
                '天元': 0,
                'ルシゼロ': 0
            };
            
            for (const [_, participant] of recruitment.participants.entries()) {
                if (participant.preferredContent === '天元') {
                    contentCounts['天元']++;
                } else if (participant.preferredContent === 'ルシゼロ') {
                    contentCounts['ルシゼロ']++;
                }
            }
            
            recruitment.confirmedContent = contentCounts['天元'] >= contentCounts['ルシゼロ'] 
                ? '天元' 
                : 'ルシゼロ';
        }
    }
        /**
     * 募集の更新と結果の送信
     */
        private async updateRecruitmentAndSendResults(recruitment: Recruitment): Promise<void> {
            try {
                await this.updateRecruitmentMessage(recruitment.id);
                
                const channel = await this.safeChannelFetch(recruitment.channelId);
                if (!channel) {
                    throw new RecruitmentError('Channel not found', 'CHANNEL_NOT_FOUND');
                }
                
                const resultEmbed = this.createResultEmbed(recruitment);
                await channel.send({ embeds: [resultEmbed] });
                
                if (recruitment.participants.size > RECRUITMENT_CONSTANTS.MAX_PARTICIPANTS) {
                    await this.sendParticipantLimitMessage(channel);
                }
            } catch (error) {
                Logger.error('結果メッセージ送信エラー:', error);
                throw error;
            }
        }
    
        /**
         * 参加者制限メッセージの送信
         */
        private async sendParticipantLimitMessage(channel: TextChannel): Promise<void> {
            await channel.send({
                content: 
                    `${RECRUITMENT_CONSTANTS.MAX_PARTICIPANTS}人を超える参加希望があったため、` +
                    `主催者を含む${RECRUITMENT_CONSTANTS.MAX_PARTICIPANTS}人が**公平に**選出されました。\n` +
                    `選出は同日の参加回数が少ないプレイヤーを優先しています。`
            });
        }
    
        /**
         * 結果表示用Embedの作成
         */
        private createResultEmbed(recruitment: Recruitment): EmbedBuilder {
            const dateStr = this.formatDateSafe(recruitment.startTime);
            const contentType = this.getDisplayContentType(recruitment);
            const startTime = recruitment.confirmedStartTime || this.formatTimeSafe(recruitment.startTime);
            
            const embed = new EmbedBuilder()
                .setTitle(`【${contentType}】募集結果`)
                .setDescription(
                    `**開催日**: ${dateStr}\n` +
                    `**開始時間**: ${startTime}～\n` +
                    `**主催者**: ${recruitment.hostName}\n` +
                    (recruitment.note ? `**備考**: ${recruitment.note}\n` : '')
                )
                .setColor(config.colors.success)
                .setTimestamp();
    
            // 確定メンバーを表示
            this.addConfirmedMembersToEmbed(embed, recruitment);
            
            return embed;
        }
    
        /**
         * Embedに確定メンバーを追加
         */
        private addConfirmedMembersToEmbed(embed: EmbedBuilder, recruitment: Recruitment): void {
            embed.addFields({
                name: '【確定メンバー】',
                value: ' ',
                inline: false
            });
    
            // 属性ごとに参加者を表示
            for (const element of ELEMENTS) {
                const assignedUser = Array.from(recruitment.participants.values())
                    .find(p => p.assignedElement === element);
                    
                embed.addFields({
                    name: element,
                    value: assignedUser ? assignedUser.username : '(未定)',
                    inline: true
                });
            }
    
            // 補欠リストの表示
            if (recruitment.waitingList?.length) {
                const waitingUsers = recruitment.waitingList
                    .map(id => recruitment.participants.get(id)?.username || id)
                    .join(', ');
                    
                embed.addFields({
                    name: '【補欠メンバー】',
                    value: waitingUsers,
                    inline: false
                });
            }
        }
    
        /**
         * 表示用のコンテンツタイプを取得
         */
        private getDisplayContentType(recruitment: Recruitment): string {
            return recruitment.confirmedContent || recruitment.contentType;
        }
    
        /**
         * 募集メッセージを更新する
         * 不足していたメソッドの実装
         */
        private async updateRecruitmentMessage(recruitmentId: string): Promise<void> {
            try {
                const recruitment = this.recruitments.get(recruitmentId);
                if (!recruitment) {
                    throw new RecruitmentError('Recruitment not found', 'RECRUITMENT_NOT_FOUND');
                }
    
                const channel = await this.safeChannelFetch(recruitment.channelId);
                if (!channel) {
                    throw new RecruitmentError('Channel not found', 'CHANNEL_NOT_FOUND');
                }
    
                try {
                    const message = await channel.messages.fetch(recruitmentId);
                    const embed = this.createRecruitmentEmbed(recruitment);
                    const components = this.createRecruitmentComponents(recruitment);
    
                    await message.edit({
                        embeds: [embed],
                        components
                    });
                } catch (error) {
                    Logger.error('メッセージ更新エラー:', error);
                    throw new RecruitmentError('Failed to update message', 'MESSAGE_UPDATE_FAILED');
                }
            } catch (error) {
                Logger.error('募集更新エラー:', error);
                throw error;
            }
        }
    
            /**
     * 参加者に属性を割り当てる
     * 不足していたメソッドの実装
     */
    private async assignElementsToParticipants(recruitment: Recruitment): Promise<void> {
        try {
            if (!recruitment.selectedParticipants || recruitment.selectedParticipants.length === 0) {
                throw new RecruitmentError('No selected participants', 'NO_SELECTED_PARTICIPANTS');
            }
            
            // 各属性の希望者をマッピング
            const elementPreferences: Record<Element, string[]> = {
                火: [],
                水: [],
                土: [],
                風: [],
                光: [],
                闇: []
            };
            ELEMENTS.forEach(element => {
                elementPreferences[element] = [];
            });
            
            // 選ばれた参加者のみを対象に属性希望をマッピング
            for (const participantId of recruitment.selectedParticipants) {
                const participant = recruitment.participants.get(participantId);
                if (participant) {
                    participant.preferredElements.forEach(element => {
                        elementPreferences[element].push(participantId);
                    });
                }
            }
            
            // 属性の割り当て結果
            const assignedElements: Record<string, Element> = {};
            const assignedUsers: Record<Element, string> = {
                火: '',
                水: '',
                土: '',
                風: '',
                光: '',
                闇: ''
            };
            
            // 1. まず希望者が1人だけの属性から割り当て
            for (const element of ELEMENTS) {
                const preferrers = elementPreferences[element];
                if (preferrers.length === 1) {
                    const userId = preferrers[0];
                    // まだ他の属性が割り当てられていない場合のみ
                    if (!assignedElements[userId]) {
                        assignedElements[userId] = element;
                        assignedUsers[element] = userId;
                        
                        // 割り当てた参加者を他の属性の希望リストから削除
                        ELEMENTS.forEach(e => {
                            if (e !== element) {
                                const index = elementPreferences[e].indexOf(userId);
                                if (index !== -1) {
                                    elementPreferences[e].splice(index, 1);
                                }
                            }
                        });
                    }
                }
            }
            
            // 2. 残りの属性を希望者順に割り当て
            for (const element of ELEMENTS) {
                // すでに割り当てられている場合はスキップ
                if (assignedUsers[element]) continue;
                
                const preferrers = elementPreferences[element];
                // この属性を希望するユーザーがいる場合
                if (preferrers.length > 0) {
                    // まだ属性が割り当てられていないユーザーを優先
                    const unassignedPreferrers = preferrers.filter(userId => !assignedElements[userId]);
                    const userId = unassignedPreferrers.length > 0 ? unassignedPreferrers[0] : preferrers[0];
                    
                    // 以前に割り当てられた属性があれば解除
                    if (assignedElements[userId]) {
                        const previousElement = assignedElements[userId];
                        assignedUsers[previousElement] = '';
                    }
                    
                    // 新しい属性を割り当て
                    assignedElements[userId] = element;
                    assignedUsers[element] = userId;
                    
                    // 割り当てた参加者を他の属性の希望リストから削除
                    ELEMENTS.forEach(e => {
                        if (e !== element) {
                            const index = elementPreferences[e].indexOf(userId);
                            if (index !== -1) {
                                elementPreferences[e].splice(index, 1);
                            }
                        }
                    });
                }
            }
            
            // 3. まだ属性が割り当てられていない場合はランダムに割り当て
            const unassignedElements = ELEMENTS.filter(element => !assignedUsers[element]);
            const unassignedUsers = recruitment.selectedParticipants.filter(userId => !assignedElements[userId]);
            
            for (let i = 0; i < unassignedElements.length && i < unassignedUsers.length; i++) {
                const element = unassignedElements[i];
                const userId = unassignedUsers[i];
                assignedElements[userId] = element;
                assignedUsers[element] = userId;
            }
            
            // 最終的な属性割り当てを参加者データに反映
            for (const [userId, element] of Object.entries(assignedElements)) {
                const participant = recruitment.participants.get(userId);
                if (participant) {
                    participant.assignedElement = element;
                }
            }
        } catch (error) {
            Logger.error('属性割り当てエラー:', error);
            throw error;
        }
    }
}