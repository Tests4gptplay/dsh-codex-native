import type { SubprocessHandle, SubprocessSpawnSpec } from '@deepseek-ai/dsh-subprocess';
import { type JsonValue } from './wire.ts';
type Request = (method: string, params: Record<string, JsonValue>) => Promise<unknown>;
export type SkillSource = 'local' | 'connector';
export interface NativeSkill {
    id: string;
    name: string;
    description: string;
    source: SkillSource;
    path: string | null;
    pluginId: string | null;
    remoteMarketplace: string | null;
    remotePluginId: string | null;
    skillName: string;
    dependencies: unknown;
}
export interface SkillCatalog {
    skills: NativeSkill[];
    warnings: string[];
}
/** Query enabled local skills and installed remote plugin skills without starting a model turn. */
export declare function discoverNativeSkills(request: Request, cwd: string): Promise<SkillCatalog>;
export declare function searchNativeSkills(catalog: SkillCatalog, query?: string, source?: 'all' | SkillSource, offset?: number, limit?: number): {
    total: number;
    nextOffset: number | null;
    skills: {
        id: string;
        name: string;
        description: string;
        source: SkillSource;
    }[];
    warnings: string[];
};
interface Options {
    spawn(spec: SubprocessSpawnSpec): SubprocessHandle | Promise<SubprocessHandle>;
    env: Readonly<Record<string, string>>;
    maxJsonRpcLineBytes: number;
    maxStderrBytes: number;
    disposeGraceMs: number;
    maxContextTokens?: number;
}
/** Owns temporary discovery processes and a refreshable, last-workspace metadata cache. */
export declare class NativeCodexSkills {
    private readonly options;
    private cached;
    private readonly active;
    private disposed;
    private readonly lifetime;
    constructor(options: Options);
    private connection;
    catalog(cwd: string, signal: AbortSignal, refresh?: boolean): Promise<SkillCatalog>;
    read(cwd: string, id: string, signal: AbortSignal, offset?: number, limit?: number): Promise<{
        id: string;
        name: string;
        source: SkillSource;
        path: string | null;
        resourceBase: string;
        dependencies: unknown;
        offset: number;
        totalLines: number;
        nextOffset: number | null;
        contents: string;
    }>;
    dispose(): Promise<void>;
}
export {};
