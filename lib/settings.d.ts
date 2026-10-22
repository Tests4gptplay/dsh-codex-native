/** User-editable Codex capability settings exposed through DSH settings. */
import z from '@deepseek-ai/schemastery';
/** Settings address shared by the Host section and the browser card. */
export declare const CODEX_SETTINGS_NAMESPACE = "llm-codex-app-server";
/** The focused capability subset that may change without reloading the provider. */
export interface CodexCapabilitySettings {
    /** Offer Codex's pinned native image-generation capability on ordinary model turns. */
    imageGenerationEnabled?: boolean;
    /** Let this provider take over Harness `web_search` calls made by its own agents. */
    webSearchEnabled?: boolean;
    /** Search-only Codex model; blank or absent follows the initiating main model. */
    webSearchModel?: string;
    /** Maximum merged source count returned by one Harness `web_search` call. */
    webSearchMaxResults?: number;
}
/** Shared fields used by both the plugin composition schema and settings section. */
export declare const codexCapabilitySettingsFields: {
    imageGenerationEnabled: z<boolean, boolean>;
    webSearchEnabled: z<boolean, boolean>;
    webSearchModel: z<string, string>;
    webSearchMaxResults: z<number, number>;
};
/** Settings-service schema rendered and persisted for the Codex capability card. */
export declare const CodexCapabilitySettingsSchema: z<CodexCapabilitySettings>;
/** One validated snapshot used for an operation or App Server process. */
export interface ResolvedCodexCapabilitySettings {
    readonly imageGenerationEnabled: boolean;
    readonly webSearchEnabled: boolean;
    readonly webSearchModel?: string;
    readonly webSearchMaxResults: number;
}
/** Resolve defaults and constraints that programmatic callers can bypass in the schema. */
export declare function resolveCodexCapabilitySettings(settings: CodexCapabilitySettings): ResolvedCodexCapabilitySettings;
