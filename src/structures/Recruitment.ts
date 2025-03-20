export type Element = "火" | "水" | "土" | "風" | "光" | "闇";
export const ELEMENTS: Element[] = ["火", "水", "土", "風", "光", "闇"];

// 既存の型定義の近くに追加
export type RecruitmentStatus = "open" | "closed" | "completed" | "canceled";
export type ContentPreference = "天元" | "ルシゼロ" | "どれでも可";

export type ContentType = "天元" | "ルシゼロ" | "参加者希望";

export interface ParticipantData {
    userId: string;
    username: string;
    preferredElements: Element[];
    preferredContent?: ContentPreference;
    availableFromTime?: string;
    assignedElement?: Element;
    createdAt: Date;
}

export interface Recruitment {
    id: string;
    contentType: ContentType;
    confirmedContent?: ContentPreference;
    startTime: Date;
    hostId: string;
    hostName: string;
    channelId: string;
    note?: string;
    participants: Map<string, ParticipantData>;
    status: RecruitmentStatus;
    waitingList?: string[];
    selectedParticipants?: string[];
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
    
    // GlobalParticipationManager クラス内に追加
    static async getParticipationCounts(): Promise<Record<string, number>> {
        // 現在の日付を取得 (YYYY-MM-DD 形式)
        const today = new Date().toISOString().split('T')[0];
        
        // 今日の参加データを取得
        const todayData = this.dailyData.get(today);
        
        // 結果オブジェクトを作成
        const result: Record<string, number> = {};
        
        // データが存在する場合は変換
        if (todayData) {
            todayData.forEach((count, userId) => {
                result[userId] = count;
            });
        }
        
        return result;
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
// src/structures/Recruitment.ts に追加
export interface Recruitment {
    id: string;
    contentType: ContentType;
    startTime: Date;
    hostId: string;
    hostName: string;
    channelId: string;
    note?: string;
    participants: Map<string, ParticipantData>;
    status: RecruitmentStatus;
    waitingList?: string[];  // 追加
    confirmedContent?: ContentPreference;  // 追加
    selectedParticipants?: string[];  // 追加
    confirmedStartTime?: string;  // 追加
  }
  
  export interface ParticipantData {
    userId: string;
    username: string;
    preferredElements: Element[];
    createdAt: Date;
    preferredContent?: ContentPreference;  // 追加
    availableFromTime?: string;  // 追加
    assignedElement?: Element;  // 追加
  }