import { afterEach, describe, expect, it } from 'vitest'
import { fileURLToPath } from 'node:url'
import { Context } from '@deepseek-ai/cordis'
import LocalSubprocessRuntime from '@deepseek-ai/dsh-subprocess-local'
import { MessageId } from '@deepseek-ai/dsh-llm'
import type { StreamChunk } from '@deepseek-ai/dsh-llm'
import { DshCodexAdapter } from '../src/dsh-adapter.ts'
import { CodexAppServerRunner } from '../src/runner.ts'
const contexts: Context[]=[]
afterEach(async()=>{for(const ctx of contexts.splice(0))await ctx.fiber.dispose()})
async function execute(mode: 'answer' | 'error'): Promise<StreamChunk[]> {
  const ctx=new Context(); contexts.push(ctx)
  await ctx.plugin(LocalSubprocessRuntime)
  const runner=new CodexAppServerRunner({timeoutMs:15000,disposeGraceMs:1000,maxJsonRpcLineBytes:1024*1024,maxStderrBytes:65536,env:{},
    // Dependency injection is confined to this TEST. No mock selector enters the shipped plugin.
    spawn:spec=>ctx.subprocess.spawn({...spec,argv:[process.execPath,fileURLToPath(new URL('./fixtures/mock-app-server.mjs',import.meta.url))],env:{...spec.env,TEST_CODEX_SCENARIO:mode}}),
  })
  const adapter=new DshCodexAdapter({provider:'codex-local',displayName:'test',modelProvider:'openai',models:[{id:'fixture-model',name:'test',inputModalities:['text'],reasoningEfforts:[]}],maxRetries:0,maxRequestImageBytes:1048576,maxCachedSessions:1,sessionIdleTimeoutMs:600000,onCleanupError:()=>{},resolveAttachments:()=>undefined,runner})
  const chunks: StreamChunk[]=[]
  try{
    for await(const c of adapter.stream({provider:'codex-local',model:'fixture-model',messages:[{id:MessageId('test-user'),role:'user',source:{kind:'user'},content:[{type:'text',text:'fixture'}]}]}))chunks.push(c)
    return chunks
  }finally{await adapter.dispose()}
}
describe('actual child-process stdio -> plugin -> DSH content',()=>{
  it('replays the reported moderation and lifecycle events without unknown chat blocks',async()=>{
    const chunks=await execute('answer')
    expect(chunks.some(c=>c.type==='finish')).toBe(true)
    const blocks=chunks.flatMap(c=>c.type==='block-end'?[c.block]:[])
    expect(blocks.every(b=>['text','reasoning','image','tool-call'].includes(b.type))).toBe(true)
    expect(JSON.stringify(blocks)).toContain('Mock Codex reply preserved.')
    expect(JSON.stringify(blocks)).toContain('Command: completed')
    expect(JSON.stringify(blocks)).not.toContain('codex-action')
    expect(JSON.stringify(blocks)).not.toContain('moderationMetadata')
  },30000)
  it('preserves a genuine model failure instead of hiding it as diagnostic cleanup',async()=>{
    await expect(execute('error')).rejects.toThrow(/Fixture model rejected/)
  },30000)
})
