/** Codex-native web search projected into the Harness web capability. */
import type { WebSearchRequest, WebSearchResult } from '@deepseek-ai/dsh-web';
import type { CodexAppServerRunnerPort } from './runner.ts';
/** Main-model route inherited by one auxiliary search. */
export interface CodexSearchTarget {
    readonly provider: string;
    readonly model: string;
}
/** Construction values for {@link CodexWebSearchProvider}. */
export interface CodexWebSearchProviderOptions {
    readonly modelProvider: string;
    readonly runner: CodexAppServerRunnerPort;
}
/** One-shot Codex App Server search using an explicitly resolved main-model target. */
export declare class CodexWebSearchProvider {
    private readonly options;
    constructor(options: CodexWebSearchProviderOptions);
    search(target: CodexSearchTarget, request: WebSearchRequest, signal?: AbortSignal): Promise<WebSearchResult>;
}
