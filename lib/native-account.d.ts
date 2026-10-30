import type { SubprocessHandle, SubprocessSpawnSpec } from '@deepseek-ai/dsh-subprocess';
import type { UsageSnapshot } from './usage.ts';
import type { CodexModel } from './adapter.ts';
type LoginMode = 'browser' | 'device';
export type LoginPhase = 'pending' | 'authenticated' | 'failed' | 'cancelled';
export interface LoginFlow {
    id: string;
    phase: LoginPhase;
    mode: LoginMode;
    authUrl?: string;
    verificationUrl?: string;
    userCode?: string;
    error?: string;
}
type Spawn = (spec: SubprocessSpawnSpec) => SubprocessHandle | Promise<SubprocessHandle>;
interface AccountOptions {
    env?: Readonly<Record<string, string>>;
    disposeGraceMs?: number;
    maxStderrBytes?: number;
    maxJsonRpcLineBytes?: number;
}
export declare class NativeCodexAccount {
    private readonly spawn;
    private readonly options;
    private active;
    private readonly connections;
    private flow;
    private disposed;
    private readonly lifetime;
    private loginAttempt;
    constructor(spawn: Spawn, options?: AccountOptions);
    private open;
    private withConnection;
    status(signal?: AbortSignal): Promise<{
        authenticated: boolean;
        email?: string;
        planType?: string;
    }>;
    /** Refresh the models available to the signed-in account when DSH requests its picker catalog. */
    models(signal?: AbortSignal): Promise<CodexModel[]>;
    quota(signal?: AbortSignal): Promise<unknown>;
    /** Manual, read-only account-wide history. No token accumulation hook or background loop. */
    usage(signal?: AbortSignal): Promise<UsageSnapshot>;
    start(mode: LoginMode, caller?: AbortSignal): Promise<LoginFlow>;
    private observeLogin;
    loginStatus(id: string): LoginFlow;
    cancel(id: string): Promise<LoginFlow>;
    logout(signal?: AbortSignal): Promise<{
        authenticated: false;
    }>;
    dispose(): Promise<void>;
}
export {};
