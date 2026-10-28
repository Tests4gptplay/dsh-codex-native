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
export declare class NativeCodexAccount {
    private readonly spawn;
    private active;
    private readonly connections;
    private flow;
    private disposed;
    constructor(spawn: Spawn);
    private open;
    private withConnection;
    status(): Promise<{
        authenticated: boolean;
        email?: string;
        planType?: string;
    }>;
    /** Refresh the models available to the signed-in account when DSH requests its picker catalog. */
    models(): Promise<CodexModel[]>;
    quota(): Promise<unknown>;
    /** Manual, read-only account-wide history. No token accumulation hook or background loop. */
    usage(): Promise<UsageSnapshot>;
    start(mode: LoginMode): Promise<LoginFlow>;
    private observeLogin;
    loginStatus(id: string): LoginFlow;
    cancel(id: string): Promise<LoginFlow>;
    logout(): Promise<{
        authenticated: false;
    }>;
    dispose(): Promise<void>;
}
export {};
