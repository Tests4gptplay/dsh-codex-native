/** DSH presentation boundary over the Codex wire/replay adapter. */
import type { GenerateOptions, StreamChunk } from '@deepseek-ai/dsh-llm';
import { CodexAppServerAdapter } from './adapter.ts';
export declare class DshCodexAdapter extends CodexAppServerAdapter {
    private readonly shownWarnings;
    stream(options: GenerateOptions): AsyncIterable<StreamChunk>;
    disposeSession(sessionId: string): Promise<void>;
    dispose(): Promise<void>;
}
