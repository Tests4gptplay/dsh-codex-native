/** Read-only account history and reference grouping. No model hooks, timers, or persistence. */
export interface UsageDay {
    date: string;
    tokens: string;
}
export interface ResetReference {
    date: string;
    announcedAt: string;
}
export interface UsageWindow {
    name: string;
    usedPercent: number | null;
    resetsAt: number | null;
}
export interface UsageSnapshot {
    queriedAt: string;
    lifetimeTokens: string | null;
    days: UsageDay[] | null;
    incomplete: boolean;
    resets: ResetReference[];
    resetSource: 'codex-reset.com' | 'unavailable';
    windows: UsageWindow[];
}
export interface UsagePeriod {
    id: string;
    startDate: string | null;
    endDate: string;
    days: UsageDay[];
    tokens: string;
}
export declare function normalizeUsage(value: unknown): Pick<UsageSnapshot, 'days' | 'lifetimeTokens' | 'incomplete'>;
/** Only documented, announced resets. Predictions and banked credits are not reset events. */
export declare function normalizeResets(value: unknown, now: number): ResetReference[];
export declare function normalizeWindows(value: unknown): UsageWindow[];
export declare function sumUsage(days: readonly UsageDay[]): string;
/** Assign whole official date buckets, not fabricated hourly fractions, to reference periods. */
export declare function groupUsage(days: readonly UsageDay[], resets: readonly ResetReference[]): UsagePeriod[];
