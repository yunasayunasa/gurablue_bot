import { 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    TextChannel,
    Client
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

export class RecruitmentManager {
    private recruitments: Map<string, Recruitment> = new Map();
    private client: Client;
    
    constructor(client: Client) {
        this.client = client;
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
    ): Promise<Recruitment | null> {
        try {
            // 日付と時間をパース
            const [year, month, day] = dateStr.split('/').map(num => parseInt(num));
            const [hour, minute] = timeStr.split(':').map(num => parseInt(num));
            
            const startTime = new Date(year, month - 1, day, hour, minute);
            
            // 現在時刻より前の時間は無効
            if (startTime < new Date()) {
                Logger.error(`無効な時間: ${dateStr} ${timeStr}`);
                return null;
            }
            
            // チャンネルを取得
            const channel = await this.client.channels.fetch(channelId) as TextChannel;
            if (!channel) {
                Logger.error(`チャンネルが見つかりません: ${channelId}`);
                return null;
            }
            
            // 募集メッセージを送信
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
            
            // 募集メッセージを作成
            const embed = this.createRecruitmentEmbed(recruitment);
            const components = this.createRecruitmentComponents(recruitment);
            
            const message = await channel.send({
                embeds: [embed],
                components: components
            });
            
            // IDを設定して保存
            recruitment.id = message.id;
            this.recruitments.set(message.id, recruitment);
            
            Logger.info(`募集作成: ${message.id} (${contentType}, ${hostName})`);
            return recruitment;
        } catch (error) {
            Logger.error('募集作成エラー:', error);
            return null;
        }
    }
    
    /**
     * 募集を取得する
     */
    getRecruitment(recruitmentId: string): Recruitment | undefined {
        return this.recruitments.get(recruitmentId);
    }
    
    /**
     * 募集メッセージ用のEmbedを作成
     */
    createRecruitmentEmbed(recruitment: Recruitment): EmbedBuilder {
        const dateStr = this.formatDate(recruitment.startTime);
        const timeStr = this.formatTime(recruitment.startTime);
        
        const embed = new EmbedBuilder()
            .setTitle(`【${this.getDisplayContentType(recruitment)}】募集`)
            .setDescription(
                `**開催日時**: ${dateStr} ${timeStr}～\n` +
                `**主催者**: ${recruitment.hostName}\n` +
                (recruitment.note ? `**備考**: ${recruitment.note}\n` : '') +
                `\n**参加者状況** (${recruitment.participants.size}/${config.defaults.participantLimit})\n`
            )
            .setColor(config.colors.primary)
            .setTimestamp();
            
        // 参加者情報
        if (recruitment.status === 'open') {
            // 属性ごとに参加希望者を表示
            const elementParticipants: Partial<Record<Element, string[]>> = {};
            
            // 初期化
            ELEMENTS.forEach(element => {
                elementParticipants[element] = [];
            });
            
            // 参加者を集計
            for (const [_, participant] of recruitment.participants.entries()) {
                participant.preferredElements.forEach(element => {
                    elementParticipants[element]?.push(participant.username);
                });
            }
            
            // 属性ごとの参加者を表示
            for (const element of ELEMENTS) {
                embed.addFields({
                    name: element,
                    value: elementParticipants[element]?.length 
                        ? elementParticipants[element]!.join(', ')
                        : '(未定)',
                    inline: true
                });
            }
            
            // 参加可能時間
            const availableTimes: Record<string, string[]> = {};
            for (const [_, participant] of recruitment.participants.entries()) {
                if (participant.availableFromTime) {
                    if (!availableTimes[participant.availableFromTime]) {
                        availableTimes[participant.availableFromTime] = [];
                    }
                    availableTimes[participant.availableFromTime].push(participant.username);
                }
            }
            
            if (Object.keys(availableTimes).length > 0) {
                let timeText = '';
                
                // 時間順にソート
                const sortedTimes = Object.keys(availableTimes).sort();
                
                for (const time of sortedTimes) {
                    timeText += `${time}～: ${availableTimes[time].join(', ')}\n`;
                }
                
                embed.addFields({
                    name: '【参加可能時間】',
                    value: timeText,
                    inline: false
                });
            }
            
            // コンテンツ希望（参加者希望の場合）
            if (recruitment.contentType === '参加者希望') {
                const contentPreferences: Record<string, string[]> = {
                    '天元': [],
                    'ルシゼロ': [],
                    'どれでも可': []
                };
                
                for (const [_, participant] of recruitment.participants.entries()) {
                    if (participant.preferredContent) {
                        contentPreferences[participant.preferredContent].push(participant.username);
                    }
                }
                
                let contentText = '';
                for (const [content, users] of Object.entries(contentPreferences)) {
                    if (users.length > 0) {
                        contentText += `${content}: ${users.join(', ')}\n`;
                    }
                }
                
                if (contentText) {
                    embed.addFields({
                        name: '【コンテンツ希望】',
                        value: contentText,
                        inline: false
                    });
                }
            }
        } else if (recruitment.status === 'closed') {
            // 募集締め切り済み
            ELEMENTS.forEach(element => {
                const assignedUser = Array.from(recruitment.participants.values())
                    .find(p => p.assignedElement === element);
                
                embed.addFields({
                    name: `${element}`,
                    value: assignedUser ? assignedUser.username : '(未定)',
                    inline: true
                });
            });
            
            // 補欠リストがあれば表示
            if (recruitment.waitingList && recruitment.waitingList.length > 0) {
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
        
        return embed;
    }
    
    /**
     * 募集メッセージのボタンを作成
     */
    createRecruitmentComponents(recruitment: Recruitment): ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] {
        if (recruitment.status === 'closed') {
            // 募集締め切り済み
            return [];
        }
        
        const rows: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] = [];
        
        // コンテンツタイプによって表示するボタンを変更
        if (recruitment.contentType === '参加者希望' && !recruitment.confirmedContent) {
            // コンテンツ希望ボタン
            const contentRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
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
            rows.push(contentRow);
            
            // 主催者用のコンテンツ確定ボタン
            const hostRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                    .setCustomId(`confirm_content_天元_${recruitment.id}`)
                    .setLabel('天元に確定')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(`confirm_content_ルシゼロ_${recruitment.id}`)
                    .setLabel('ルシゼロに確定')
                    .setStyle(ButtonStyle.Success)
            );
            rows.push(hostRow);
        } else {
            // 属性選択ボタン（2行に分割）
            const elementRow1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
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
            
            const elementRow2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
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
            
            rows.push(elementRow1, elementRow2);
        }
        
        // 共通ボタン
        const commonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId(`time_select_${recruitment.id}`)
                .setLabel('参加可能時間を選択')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`cancel_${recruitment.id}`)
                .setLabel('参加取消')
                .setStyle(ButtonStyle.Danger)
            // 前のコードの続き
            new ButtonBuilder()
                .setCustomId(`time_select_${recruitment.id}`)
                .setLabel('参加可能時間を選択')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`cancel_${recruitment.id}`)
                .setLabel('参加取消')
                .setStyle(ButtonStyle.Danger)
        );
        
        // 主催者用の締め切りボタン
        const closeRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId(`close_${recruitment.id}`)
                .setLabel('募集を閉じる')
                .setStyle(ButtonStyle.Primary)
        );
        
        rows.push(commonRow, closeRow);
        
        return rows;
    }
    
    /**
     * 参加者を追加する
     */
    async addParticipant(
        recruitmentId: string,
        userId: string,
        username: string,
        preferredElement?: Element
    ): Promise<{success: boolean, message: string}> {
        const recruitment = this.recruitments.get(recruitmentId);
        if (!recruitment) {
            return { success: false, message: "募集が見つかりません。" };
        }
        
        if (recruitment.status === 'closed') {
            return { success: false, message: "この募集は既に締め切られています。" };
        }
        
        // 既存の参加者情報を取得または新規作成
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
        
        // 属性が指定されていれば追加
        if (preferredElement) {
            if (!participant.preferredElements.includes(preferredElement)) {
                participant.preferredElements.push(preferredElement);
            }
        }
        
        // 募集メッセージを更新
        await this.updateRecruitmentMessage(recruitmentId);
        
        return { 
            success: true, 
            message: preferredElement 
                ? `${username}さんが${preferredElement}属性で参加表明しました！` 
                : `${username}さんが参加表明しました！` 
        };
    }
    
    /**
     * 参加者のコンテンツ希望を設定
     */
    async setParticipantContentPreference(
        recruitmentId: string,
        userId: string,
        username: string,
        preferredContent: "天元" | "ルシゼロ" | "どれでも可"
    ): Promise<{success: boolean, message: string}> {
        const recruitment = this.recruitments.get(recruitmentId);
        if (!recruitment) {
            return { success: false, message: "募集が見つかりません。" };
        }
        
        if (recruitment.status === 'closed') {
            return { success: false, message: "この募集は既に締め切られています。" };
        }
        
        // 既存の参加者情報を取得または新規作成
        let participant = recruitment.participants.get(userId);
        
        if (!participant) {
            participant = {
                userId,
                username,
                preferredElements: [],
                preferredContent,
                createdAt: new Date()
            };
            recruitment.participants.set(userId, participant);
        } else {
            participant.preferredContent = preferredContent;
        }
        
        // 募集メッセージを更新
        await this.updateRecruitmentMessage(recruitmentId);
        
        return { 
            success: true, 
            message: `${username}さんが「${preferredContent}」を希望しました！` 
        };
    }
    
    /**
     * 参加者の参加可能時間を設定
     */
    async setParticipantAvailableTime(
        recruitmentId: string,
        userId: string,
        username: string,
        availableFromTime: string
    ): Promise<{success: boolean, message: string}> {
        const recruitment = this.recruitments.get(recruitmentId);
        if (!recruitment) {
            return { success: false, message: "募集が見つかりません。" };
        }
        
        if (recruitment.status === 'closed') {
            return { success: false, message: "この募集は既に締め切られています。" };
        }
        
        // 既存の参加者情報を取得または新規作成
        let participant = recruitment.participants.get(userId);
        
        if (!participant) {
            participant = {
                userId,
                username,
                preferredElements: [],
                availableFromTime,
                createdAt: new Date()
            };
            recruitment.participants.set(userId, participant);
        } else {
            participant.availableFromTime = availableFromTime;
        }
        
        // 募集メッセージを更新
        await this.updateRecruitmentMessage(recruitmentId);
        
        return { 
            success: true, 
            message: `${username}さんの参加可能時間を「${availableFromTime}～」に設定しました！` 
        };
    }
    
    /**
     * 参加をキャンセルする
     */
    async cancelParticipation(
        recruitmentId: string,
        userId: string
    ): Promise<{success: boolean, message: string}> {
        const recruitment = this.recruitments.get(recruitmentId);
        if (!recruitment) {
            return { success: false, message: "募集が見つかりません。" };
        }
        
        if (recruitment.status === 'closed') {
            return { success: false, message: "この募集は既に締め切られています。" };
        }
        
        // 主催者は参加キャンセルできない
        if (userId === recruitment.hostId) {
            return { success: false, message: "主催者は参加をキャンセルできません。" };
        }
        
        // 参加者から削除
        const participant = recruitment.participants.get(userId);
        if (!participant) {
            return { success: false, message: "参加表明していません。" };
        }
        
        recruitment.participants.delete(userId);
        
        // 募集メッセージを更新
        await this.updateRecruitmentMessage(recruitmentId);
        
        return { 
            success: true, 
            message: `${participant.username}さんの参加を取り消しました。` 
        };
    }
    
    /**
     * コンテンツタイプを確定する（主催者用）
     */
    async confirmContentType(
        recruitmentId: string,
        userId: string,
        contentType: "天元" | "ルシゼロ"
    ): Promise<{success: boolean, message: string}> {
        const recruitment = this.recruitments.get(recruitmentId);
        if (!recruitment) {
            return { success: false, message: "募集が見つかりません。" };
        }
        
        if (recruitment.status === 'closed') {
            return { success: false, message: "この募集は既に締め切られています。" };
        }
        
        // 主催者のみ実行可能
        if (userId !== recruitment.hostId) {
            return { success: false, message: "主催者のみがコンテンツを確定できます。" };
        }
        
        // コンテンツタイプを設定
        recruitment.confirmedContent = contentType;
        
        // 募集メッセージを更新
        await this.updateRecruitmentMessage(recruitmentId);
        
        return { 
            success: true, 
            message: `コンテンツを「${contentType}」に確定しました！` 
        };
    }
    
    /**
     * 募集を閉じる
     */
    async closeRecruitment(
        recruitmentId: string,
        userId: string
    ): Promise<{success: boolean, message: string}> {
        const recruitment = this.recruitments.get(recruitmentId);
        if (!recruitment) {
            return { success: false, message: "募集が見つかりません。" };
        }
        
        if (recruitment.status === 'closed') {
            return { success: false, message: "この募集は既に締め切られています。" };
        }
        
        // 主催者のみ実行可能
        if (userId !== recruitment.hostId) {
            return { success: false, message: "主催者のみが募集を締め切れます。" };
        }
        
        // 募集を締め切り
        recruitment.status = 'closed';
        
        // 参加者が確定していない場合は自動決定
        if (!recruitment.confirmedContent && recruitment.contentType === '参加者希望') {
            // 希望の多い方を採用
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
                // 「どれでも可」は集計しない
            }
            
            recruitment.confirmedContent = contentCounts['天元'] >= contentCounts['ルシゼロ'] 
                ? '天元' 
                : 'ルシゼロ';
        }
        
        // 参加者選出
        recruitment.selectedParticipants = this.selectParticipants(recruitment);
        
        // 属性割り振り
        this.assignElementsToParticipants(recruitment);
        
        // 募集メッセージを更新
        await this.updateRecruitmentMessage(recruitmentId);
        
        // 結果メッセージを送信
        try {
            const channel = await this.client.channels.fetch(recruitment.channelId) as TextChannel;
            const resultEmbed = this.createResultEmbed(recruitment);
            
            await channel.send({
                embeds: [resultEmbed]
            });
            
            if (recruitment.participants.size > config.defaults.participantLimit) {
                await channel.send({
                    content: `6人を超える参加希望があったため、主催者を含む6人が**公平に**選出されました。` +
                              `選出は同日の参加回数が少ないプレイヤーを優先しています。`
                });
            }
        } catch (error) {
            Logger.error('結果メッセージ送信エラー:', error);
        }
        
        return { 
            success: true, 
            message: "募集を締め切り、メンバーを確定しました。" 
        };
    }
    
    /**
     * 参加者選出アルゴリズム
     */
    private selectParticipants(recruitment: Recruitment): string[] {
        // 開催日の日付文字列を取得（YYYY-MM-DD形式）
        const dateStr = this.formatDateString(recruitment.startTime);
        
        // 1. 時間制約を考慮した参加可能ユーザーのフィルタリング
        const confirmedStartTime = this.findEarliestFullParticipationTime(recruitment);
        recruitment.confirmedStartTime = confirmedStartTime;
        
        const eligibleParticipantIds = Array.from(recruitment.participants.values())
            .filter(p => this.isTimeAvailable(p.availableFromTime, confirmedStartTime))
            .map(p => p.userId);
        
        // 2. 主催者を確定参加リストに追加
        const selectedParticipants: string[] = [];
        if (eligibleParticipantIds.includes(recruitment.hostId)) {
            selectedParticipants.push(recruitment.hostId);
        }
        
        // 3. 主催者を除外した応募者リストを作成
        const applicants = eligibleParticipantIds.filter(id => id !== recruitment.hostId);
        
        // 4. 残り枠の人数
        const remainingSlots = config.defaults.participantLimit - selectedParticipants.length;
        
        // 5. 応募者を当日参加回数に基づいて重み付けしてランダムに選出
        const weightedApplicants = applicants.map(userId => {
            // 当日の参加回数を取得（低いほど優先度が高い）
            const participationCount = GlobalParticipationManager.getDailyCount(dateStr, userId);
            
            // コンテンツ希望が一致しない場合は優先度を下げる
            const participant = recruitment.participants.get(userId);
            let contentMatchWeight = 1.0;
            
            if (recruitment.confirmedContent && participant?.preferredContent) {
                if (participant.preferredContent !== 'どれでも可' && 
                    participant.preferredContent !== recruitment.confirmedContent) {
                    contentMatchWeight = 0.5; // 希望と異なるコンテンツは優先度半減
                }
            }
            
            return {
                userId,
                weight: contentMatchWeight * (1 / (participationCount + 1)) // 参加回数0回なら重み1、1回なら1/2、2回なら1/3...
            };
        });
        
        // 応募者が残り枠以下なら全員選出
        if (applicants.length <= remainingSlots) {
            selectedParticipants.push(...applicants);
        } else {
            // 重み付きランダム選出
            const selected = this.weightedRandomSelection(weightedApplicants, remainingSlots);
            selectedParticipants.push(...selected);
            
            // 補欠リスト作成
            recruitment.waitingList = applicants.filter(id => !selectedParticipants.includes(id));
        }
        
        // 8. 選ばれた参加者の当日参加回数をインクリメント
        for (const userId of selectedParticipants) {
            GlobalParticipationManager.recordParticipation(dateStr, userId);
        }
        
        return selectedParticipants;
    }
    
    /**
     * 重み付きランダム選出
     */
    private weightedRandomSelection(
        weightedItems: { userId: string, weight: number }[], 
        count: number
    ): string[] {
        const selected: string[] = [];
        const availableItems = [...weightedItems];
        
        while (selected.length < count && availableItems.length > 0) {
            // 合計重み
            const totalWeight = availableItems.reduce((sum, item) => sum + item.weight, 0);
            
            // ランダム値
            const randomValue = Math.random() * totalWeight;
            
            // 選出
            let cumulativeWeight = 0;
            let selectedIndex = -1;
            
            for (let i = 0; i < availableItems.length; i++) {
            // 選出
            let cumulativeWeight = 0;
            let selectedIndex = -1;
            
            for (let i = 0; i < availableItems.length; i++) {
                cumulativeWeight += availableItems[i].weight;
                if (randomValue <= cumulativeWeight) {
                    selectedIndex = i;
                    break;
                }
            }
            
            if (selectedIndex !== -1) {
                selected.push(availableItems[selectedIndex].userId);
                availableItems.splice(selectedIndex, 1);
            } else {
                // エラー回避のため、先頭を選択
                selected.push(availableItems[0].userId);
                availableItems.splice(0, 1);
            }
        }
        
        return selected;
    }
    
    /**
     * 参加者に属性を割り振る
     */
    private assignElementsToParticipants(recruitment: Recruitment): void {
        if (!recruitment.selectedParticipants) return;
        
        // 既に割り当てられた属性を記録
        const assignedElements = new Set<Element>();
        
        // 参加者の希望属性を集計
        const participantPreferences: { userId: string, elements: Element[] }[] = [];
        
        for (const userId of recruitment.selectedParticipants) {
            const participant = recruitment.participants.get(userId);
            if (participant) {
                participantPreferences.push({
                    userId,
                    elements: participant.preferredElements
                });
            }
        }
        
        // 希望属性が少ない順にソート（希望が1つだけの人を優先）
        participantPreferences.sort((a, b) => a.elements.length - b.elements.length);
        
        // 属性を割り当て
        for (const { userId, elements } of participantPreferences) {
            const participant = recruitment.participants.get(userId);
            if (!participant) continue;
            
            // 希望属性で未割当のものがあれば割り当て
            let assigned = false;
            for (const element of elements) {
                if (!assignedElements.has(element)) {
                    participant.assignedElement = element;
                    assignedElements.add(element);
                    assigned = true;
                    break;
                }
            }
            
            // 希望属性が全て割り当て済みなら、未割当の属性からランダムに割り当て
            if (!assigned) {
                const availableElements = ELEMENTS.filter(e => !assignedElements.has(e));
                if (availableElements.length > 0) {
                    const randomElement = availableElements[Math.floor(Math.random() * availableElements.length)];
                    participant.assignedElement = randomElement;
                    assignedElements.add(randomElement);
                }
            }
        }
    }
    
    /**
     * 最も早い全員参加可能な時間を見つける
     */
    private findEarliestFullParticipationTime(recruitment: Recruitment): string {
        // 参加者の開始可能時間を収集
        const availableTimes: Record<string, number> = {};
        
        // 募集時間をデフォルトに設定
        const defaultTime = this.formatTime(recruitment.startTime);
        availableTimes[defaultTime] = 0;
        
        // 各参加者の時間制約を集計
        for (const [_, participant] of recruitment.participants.entries()) {
            if (participant.availableFromTime) {
                if (!availableTimes[participant.availableFromTime]) {
                    availableTimes[participant.availableFromTime] = 0;
                }
                availableTimes[participant.availableFromTime]++;
            } else {
                // 時間指定がない場合はデフォルト時間で参加可能
                availableTimes[defaultTime]++;
            }
        }
        
        // 開始可能時間を時間順にソート
        const sortedTimes = Object.keys(availableTimes).sort();
        
        // 各時間に参加可能な人数を累積的に集計
        const cumulativeCounts: Record<string, number> = {};
        let runningCount = 0;
        
        for (const time of sortedTimes) {
            runningCount += availableTimes[time];
            cumulativeCounts[time] = runningCount;
        }
        
        // 全員が参加可能な最も早い時間を見つける
        const totalParticipants = recruitment.participants.size;
        for (const time of sortedTimes) {
            if (cumulativeCounts[time] >= totalParticipants) {
                return time;
            }
        }
        
        // 見つからない場合はデフォルト時間を返す
        return defaultTime;
    }
    
    /**
     * 指定された時間に参加可能かチェック
     */
    private isTimeAvailable(availableFromTime: string | undefined, startTime: string): boolean {
        if (!availableFromTime) return true;
        
        // 時間の比較（HH:MM形式）
        const [availableHour, availableMinute] = availableFromTime.split(':').map(n => parseInt(n, 10));
        const [startHour, startMinute] = startTime.split(':').map(n => parseInt(n, 10));
        
        if (availableHour < startHour) return true;
        if (availableHour > startHour) return false;
        return availableMinute <= startMinute;
    }
    
    /**
     * 結果表示用Embedを作成
     */
    private createResultEmbed(recruitment: Recruitment): EmbedBuilder {
        const dateStr = this.formatDate(recruitment.startTime);
        const contentType = this.getDisplayContentType(recruitment);
        const startTime = recruitment.confirmedStartTime || this.formatTime(recruitment.startTime);
        
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
        
        // 補欠リストがあれば表示
        if (recruitment.waitingList && recruitment.waitingList.length > 0) {
            const waitingUsers = recruitment.waitingList
                .map(id => recruitment.participants.get(id)?.username || id)
                .join(', ');
                
            embed.addFields({
                name: '【補欠メンバー】',
                value: waitingUsers,
                inline: false
            });
        }
        
        return embed;
    }
    
    /**
     * 募集メッセージを更新
     */
    async updateRecruitmentMessage(recruitmentId: string): Promise<boolean> {
        const recruitment = this.recruitments.get(recruitmentId);
        if (!recruitment) {
            return false;
        }
        
        try {
            const channel = await this.client.channels.fetch(recruitment.channelId) as TextChannel;
            if (!channel) {
                return false;
            }
            
            const message = await channel.messages.fetch(recruitmentId);
            if (!message) {
                return false;
            }
            
            const embed = this.createRecruitmentEmbed(recruitment);
            const components = recruitment.status === 'open' 
                ? this.createRecruitmentComponents(recruitment)
                : [];
                
            await message.edit({
                embeds: [embed],
                components
            });
            
            return true;
        } catch (error) {
            Logger.error('メッセージ更新エラー:', error);
            return false;
        }
    }
    
    /**
     * 表示用のコンテンツタイプを取得
     */
    private getDisplayContentType(recruitment: Recruitment): string {
        return recruitment.confirmedContent || recruitment.contentType;
    }
    
    /**
     * 日付のフォーマット (YYYY/MM/DD)
     */
    private formatDate(date: Date): string {
        return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
    }
    
    /**
     * 時間のフォーマット (HH:MM)
     */
    private formatTime(date: Date): string {
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return `${hours}:${minutes}`;
    }
    
    /**
     * 日付文字列のフォーマット (YYYY-MM-DD)
     */
    private formatDateString(date: Date): string {
        return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
    }
}