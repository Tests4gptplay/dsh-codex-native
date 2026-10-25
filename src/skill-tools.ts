/** DSH-wide skill search and lazy reads, shared by HTTP and local model adapters. */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-working-directory'
import type {} from '@deepseek-ai/dsh-system-prompt'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { NativeCodexSkills, searchNativeSkills } from './native-skills.ts'
import { jsonValue } from './wire.ts'

export const CODEX_SKILL_DISCOVERY_PROMPT =
  'Codex skills are available through codex_skill_search and codex_skill_read, including local authoring workflows and installed connector skills. Search by task or service name when relevant, then read the matching skill before using it. The complete catalog is not preloaded. Connector entries take priority over copies from the same plugin. Read any remaining pages before following a skill; local references resolve from resourceBase, and connector references can use native skills.read with the returned skill:// package.'

/** Register compact discovery instructions and tools without adding the full catalog to ctx.skills. */
export function registerCodexSkillTools(ctx: Context, catalog: NativeCodexSkills): void {
  ctx.systemPrompt.section({
    name: 'dsh-codex-skill-discovery', order: 70, text: CODEX_SKILL_DISCOVERY_PROMPT,
  })
  ctx.tools.register(defineTool({
    name: 'codex_skill_search',
    description: 'Find installed Codex skills by task or service, covering local files and remote HTTP connectors. Returns summaries and ids for codex_skill_read; does not execute skills or install plugins.',
    parameters: {
      query: { type: 'string', description: 'Keywords to match names and descriptions. Omit to browse.' },
      source: { type: 'string', enum: ['all', 'local', 'connector'], description: 'Source filter; defaults to all.' },
      offset: { type: 'integer', description: 'Zero-based result offset; defaults to 0.' },
      limit: { type: 'integer', description: 'Number of results, 1–20; defaults to 8.' },
      refresh: { type: 'boolean', description: 'Rescan after skills or connected plugins change; defaults to false.' },
    },
    output: {
      schema: { type: 'json' },
      render: (_, value) => [{ type: 'text', text: JSON.stringify(value) }],
    },
    execute: async (args, exec) => {
      if (!exec.agent) throw new Error('Codex skill search requires a session')
      const cwd = await ctx.workingDirectory.ensure(exec.agent, exec.signal)
      const snapshot = await catalog.catalog(cwd, exec.signal, args.refresh)
      return jsonValue(searchNativeSkills(snapshot, args.query, args.source, args.offset, args.limit), 'skill search')
    },
    presentCall: args => ({ card: 'generic', title: 'Search Codex skills', kind: 'search', rawInput: args }),
  }))
  ctx.tools.register(defineTool({
    name: 'codex_skill_read',
    description: 'Read a Codex skill selected by codex_skill_search, with its source and resource base. Reads only the requested skill, without executing it.',
    parameters: {
      id: { type: 'string', required: true, description: 'Exact id returned by codex_skill_search in this workspace.' },
      offset: { type: 'integer', description: 'First line, starting at 1; defaults to 1.' },
      limit: { type: 'integer', description: 'Number of lines, 1–1000; defaults to 400. Continue with nextOffset if present.' },
    },
    output: {
      schema: { type: 'json' },
      render: (_, value) => [{ type: 'text', text: JSON.stringify(value) }],
    },
    execute: async (args, exec) => {
      if (!exec.agent) throw new Error('Codex skill read requires a session')
      const cwd = await ctx.workingDirectory.ensure(exec.agent, exec.signal)
      return jsonValue(await catalog.read(cwd, args.id, exec.signal, args.offset, args.limit), 'skill read')
    },
    presentCall: args => ({ card: 'generic', title: 'Read Codex skill', kind: 'read', rawInput: args }),
  }))
}
