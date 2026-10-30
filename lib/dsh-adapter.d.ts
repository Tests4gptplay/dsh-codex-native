/** DSH presentation boundary over the Codex wire/replay adapter. */
import type { GenerateOptions, StreamChunk } from '@deepseek-ai/dsh-llm';
import { CodexAppServerAdapter, type CodexAdapterOptions } from './adapter.ts';
export declare class DshCodexAdapter extends CodexAppServerAdapter {
    private readonly reportDiagnostic;
    private readonly shownWarnings;
    constructor(options: CodexAdapterOptions, reportDiagnostic: (message: string) => void);
    stream(options: GenerateOptions): AsyncIterable<StreamChunk>;
    disposeSession(sessionId: string): Promise<void>;
    dispose(): Promise<void>;
}
