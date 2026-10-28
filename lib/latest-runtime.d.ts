import type { SubprocessSpawnSpec } from '@deepseek-ai/dsh-subprocess';
interface Manifest {
    version: string;
    optionalDependencies?: Record<string, string>;
}
interface Packages {
    manifest(spec: string, options: Record<string, unknown>): Promise<Manifest>;
    extract(spec: string, destination: string, options: Record<string, unknown>): Promise<unknown>;
}
export interface Runtime {
    version: string;
    executable: string;
}
export declare class LatestCodexRuntime {
    private readonly warn;
    private readonly root;
    private readonly source;
    private pending;
    private current;
    private readonly platform;
    private readonly key;
    private readonly triple;
    constructor(warn: (message: string) => void, root?: string, source?: Packages);
    private executable;
    private bundled;
    /** Concurrent opens share only the current refresh, never a permanent version lock. */
    resolve(): Promise<Runtime>;
    private refresh;
    spawnSpec(spec: SubprocessSpawnSpec): Promise<SubprocessSpawnSpec>;
}
export {};
