export declare const NS = "codex-native";
export declare const zh: {
    locale: string;
    nav: string;
    title: string;
    description: string;
    signIn: string;
    deviceCode: string;
    connected: string;
    disconnected: string;
    working: string;
    waiting: string;
    openPage: string;
    code: string;
    refresh: string;
    logout: string;
    cancel: string;
    quota: string;
    quotaUnknown: string;
    error: string;
    loginSuccess: string;
    plan: string;
    used: string;
    instructions: string;
    accountTitle: string;
    usageTitle: string;
    clearUsage: string;
    queryUsage: string;
    queryingUsage: string;
    totalUsage: string;
    lifetimeUsage: string;
    usageDate: string;
    updatedAt: string;
    usageEmpty: string;
    usageNeedsLogin: string;
    dailyUnavailable: string;
    noDailyRows: string;
    ungroupedPeriod: string;
    usageSource: string;
    accountScope: string;
    resetSource: string;
    resetSourceSuffix: string;
    resetUnavailable: string;
    referenceNote: string;
    clearNote: string;
    partialUsage: string;
    officialWindowSource: string;
    nextReset: string;
};
export declare const en: typeof zh;
export type CodexNativeUiKey = keyof typeof zh;
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface LocaleNamespaceMap {
        'codex-native': CodexNativeUiKey;
    }
}
