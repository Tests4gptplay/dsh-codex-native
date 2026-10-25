/** DSH-wide skill search and lazy reads, shared by HTTP and local model adapters. */
import type { Context } from '@deepseek-ai/cordis';
import { NativeCodexSkills } from './native-skills.ts';
export declare const CODEX_SKILL_DISCOVERY_PROMPT = "Codex skills are available through codex_skill_search and codex_skill_read, including local authoring workflows and installed connector skills. Search by task or service name when relevant, then read the matching skill before using it. The complete catalog is not preloaded. Connector entries take priority over copies from the same plugin. Read any remaining pages before following a skill; local references resolve from resourceBase, and connector references can use native skills.read with the returned skill:// package.";
/** Register compact discovery instructions and tools without adding the full catalog to ctx.skills. */
export declare function registerCodexSkillTools(ctx: Context, catalog: NativeCodexSkills): void;
