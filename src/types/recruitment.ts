import { Element } from '../structures/Recruitment';

export type RecruitmentStatus = 'open' | 'closed';
export type ContentPreference = '天元' | 'ルシゼロ' | 'どれでも可';

export interface ParticipantPreference {
    userId: string;
    elements: Element[];
    contentType?: ContentPreference;
}

export interface RecruitmentResult {
    success: boolean;
    message: string;
    error?: Error;
}

export class RecruitmentError extends Error {
    constructor(
        message: string,
        public code: string,
        public details?: any
    ) {
        super(message);
        this.name = 'RecruitmentError';
    }
}
