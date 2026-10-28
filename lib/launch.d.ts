import type { SubprocessSpawnSpec } from '@deepseek-ai/dsh-subprocess';
/** Layout is the official @openai/codex 0.154.0 wrapper's platform-package layout. */
export declare function windowsCodexBinary(packageJson: string, arch: string): string;
/** Avoid the JS wrapper's second spawn, which omits Windows hide flags. No global monkey patch and no shell. */
export declare function codexSpawnSpec(spec: SubprocessSpawnSpec, platform?: NodeJS.Platform): SubprocessSpawnSpec;
