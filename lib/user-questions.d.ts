/** Codex questions presented by DSH's native, Agent-scoped question UI. */
import type { Context } from '@deepseek-ai/cordis';
import type { AskUserQuestionItem } from '@deepseek-ai/dsh-user-questions';
import type { JsonObject } from './wire.ts';
/** Native blocking RPCs and nonblocking agent-message questions share one UI. */
export interface CodexQuestionHandler {
    ask(params: JsonObject, sessionId: string | undefined, signal: AbortSignal): Promise<JsonObject | null>;
    notify(item: JsonObject, sessionId: string | undefined, signal?: AbortSignal): void;
}
export declare function codexQuestions(params: JsonObject): AskUserQuestionItem[];
export declare function codexAsyncQuestions(item: JsonObject): AskUserQuestionItem[];
/** Own only pending question lifetimes; DSH owns presentation and notifications. */
export declare class CodexUserQuestions implements CodexQuestionHandler {
    private readonly ctx;
    private readonly lifetime;
    private readonly sessions;
    constructor(ctx: Context);
    private owner;
    private service;
    ask(params: JsonObject, sessionId: string | undefined, signal: AbortSignal): Promise<JsonObject | null>;
    notify(item: JsonObject, sessionId: string | undefined, signal?: AbortSignal): void;
    private answerAsync;
    private disposeSession;
    dispose(): void;
}
