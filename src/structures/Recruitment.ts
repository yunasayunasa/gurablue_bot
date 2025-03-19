export type Element = "火" | "水" | "土" | "風" | "光" | "闇";
export const ELEMENTS: Element[] = ["火", "水", "土", "風", "光", "闇"];

export type ContentType = "天元" | "ルシゼロ" | "参加者希望";

export interface ParticipantData {
    userId: string;
    username: string;
    preferredElements: Element[];
    preferredContent?: "天元" | "ルシゼロ" | "どれでも可";
    availableFromTime?: string;
    assignedElement?: Element;
    createdAt: Date;
}

export interface Recruitment {
    id: string;
    contentType: ContentType;
    confirmedContent?: "天元" | "ルシゼロ";
    startTime: Date;
    hostId: string;
    hostName: string;
    channelId: string;
    note?: string;
    participants: Map<string, ParticipantData>;
    status: "open" | "closed";
    selectedParticipants?: string[];
    waitingList?: string[];
    confirmedStartTime?: string;
}

// 当日の参加状況を管理するグローバルデータ
export class GlobalParticipationManager {
    private static dailyData: Map<string, Map<string, number>> = new Map();
    
    // 日付ごとの参加データを取得
    static getDailyCount(date: string, userId: string): number {
        if (!this.dailyData.has(date)) {
            this.dailyData.set(date, new Map());
        }
        return this.dailyData.get(date)?.get(userId) || 0;
    }
    
    // 参加回数を記録
    static recordParticipation(date: string, userId: string): void {
        if (!this.dailyData.has(date)) {
            this.dailyData.set(date, new Map());
        }
        const currentCount = this.dailyData.get(date)?.get(userId) || 0;
        this.dailyData.get(date)?.set(userId, currentCount + 1);
    }
}