export const RECRUITMENT_CONSTANTS = {
    MAX_PARTICIPANTS: 6,
    MIN_PARTICIPANTS: 1,
    TIME_FORMAT: 'HH:mm',
    DATE_FORMAT: 'YYYY-MM-DD',
    CONTENT_TYPES: {
        TENGEN: '天元',
        LUCILLIUS: 'ルシゼロ',
        ANY: 'どれでも可'
    },
    WEIGHTS: {
        CONTENT_MATCH: 1.0,
        CONTENT_MISMATCH: 0.5
    }
} as const;