import { CalendarUI } from '../utils/CalendarUI';
import { ContentType } from '../structures/Recruitment';
import { Logger } from '../utils/Logger';

export interface RecruitSession {
    id: string;
    userId: string;
    contentType: ContentType;
    step: 'date_selection' | 'time_selection' | 'note_input';
    calendarUI: CalendarUI;
    selectedDate?: Date;
    selectedTime?: string;
    expiry: number;
}

export class RecruitSessionManager {
    private sessions: Map<string, RecruitSession> = new Map();
    
    // セッション作成
    createSession(userId: string, contentType: ContentType): string {
        const sessionId = `session_${userId}_${Date.now()}`;
        
        this.sessions.set(sessionId, {
            id: sessionId,
            userId,
            contentType,
            step: 'date_selection',
            calendarUI: new CalendarUI(),
            expiry: Date.now() + 10 * 60 * 1000, // 10分でタイムアウト
        });
        
        Logger.info(`募集セッション作成: ${sessionId} (ユーザー: ${userId}, コンテンツ: ${contentType})`);
        return sessionId;
    }
    
    // セッション取得
    getSession(sessionId: string): RecruitSession | undefined {
        const session = this.sessions.get(sessionId);
        
        if (session && session.expiry < Date.now()) {
            // 期限切れの場合は削除
            this.sessions.delete(sessionId);
            return undefined;
        }
        
        return session;
    }
    
    // セッション更新
    updateSession(sessionId: string, data: Partial<RecruitSession>): boolean {
        if (!this.sessions.has(sessionId)) return false;
        
        const session = this.sessions.get(sessionId)!;
        Object.assign(session, data);
        return true;
    }
    
    // セッション削除
    deleteSession(sessionId: string): boolean {
        return this.sessions.delete(sessionId);
    }
    
    // IDからセッションを検索
    findSessionByCustomId(customId: string): RecruitSession | undefined {
        // カスタムIDからセッションIDを抽出
        const sessionIdMatch = customId.match(/.*_([^_]+)$/);
        if (!sessionIdMatch) return undefined;
        
        const sessionId = sessionIdMatch[1];
        return this.getSession(sessionId);
    }
    
    // 有効期限切れのセッションをクリーンアップ
    cleanup(): void {
        const now = Date.now();
        for (const [sessionId, session] of this.sessions.entries()) {
            if (session.expiry < now) {
                this.sessions.delete(sessionId);
                Logger.info(`期限切れの募集セッションを削除: ${sessionId}`);
            }
        }
    }
    
    // 定期的なクリーンアップを開始
    startCleanupInterval(): NodeJS.Timeout {
        return setInterval(() => this.cleanup(), 60 * 1000); // 1分ごとにクリーンアップ
    }
}