/** Durable projection and transient hydration of Codex image content. */
import type { ImageAttachmentLimits, ImageAttachmentRef, SaveImageAttachment, StoredImageAttachment } from '@deepseek-ai/dsh-attachment';
import type { CodexAppServerEvent, CodexAppServerHydratedToolResult, CodexAppServerToolResult, JsonValue } from './runner.ts';
/** Attachment operations needed by the Codex image bridge. */
export interface CodexImageStorePort {
    readonly imageLimits: ImageAttachmentLimits;
    validateImage(input: SaveImageAttachment): Promise<void>;
    saveImage(input: SaveImageAttachment): Promise<ImageAttachmentRef>;
    readImage(ref: ImageAttachmentRef, signal?: AbortSignal): Promise<StoredImageAttachment>;
}
/** One App Server event after binary outputs have moved to durable attachments. */
export interface ExternalizedCodexEvent {
    readonly event: CodexAppServerEvent;
    readonly images: readonly ImageAttachmentRef[];
}
/** Durable adapter-private marker placed where App Server expects an image URL. */
export declare function imageAttachmentMarker(ref: ImageAttachmentRef): JsonValue;
/**
 * Bound only marker fields that will be hydrated into model-visible image input.
 * Provider trajectory markers such as imageGeneration.result are never counted.
 */
export declare function boundRequestImageHistory(history: readonly JsonValue[], maxRequestImageBytes: number): JsonValue[];
/**
 * Move provider image bytes out of events and restore durable markers only at
 * App Server transport boundaries. One instance belongs to one model request.
 */
export declare class NativeImageBridge {
    private readonly resolveStore;
    private readonly references;
    private readonly supplied;
    private readonly published;
    private readonly hydrated;
    private readonly harnessCallIds;
    private storeValue;
    constructor(resolveStore: () => CodexImageStorePort | undefined);
    /** Classify durable history images so supplied echoes and historical outputs stay distinct. */
    rememberHistory(history: readonly JsonValue[]): void;
    /** Externalize binary fields in one live App Server event. */
    externalize(event: CodexAppServerEvent): Promise<ExternalizedCodexEvent>;
    /** Replace durable markers with verified data URLs for cold thread injection. */
    hydrateHistory(history: readonly JsonValue[], signal?: AbortSignal): Promise<JsonValue[]>;
    /** Translate one durable user-message content array to App Server v2 UserInput. */
    hydrateUserInput(content: readonly JsonValue[], signal?: AbortSignal): Promise<JsonValue[]>;
    /** Translate one durable Harness tool result to App Server callback content items. */
    hydrateToolResult(result: CodexAppServerToolResult, signal?: AbortSignal): Promise<CodexAppServerHydratedToolResult>;
    private rememberContentMarkers;
    private store;
    private save;
    private publish;
    private externalizeImageGeneration;
    private externalizeRawItem;
    private externalizeRawContent;
    private hydrateItem;
    private hydrateRawContent;
    private hydrateToolOutput;
    private dataUrl;
}
