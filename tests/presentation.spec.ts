import { describe, expect, it } from 'vitest'
import type { StreamChunk } from '@deepseek-ai/dsh-llm'
import { actionText, presentForDsh } from '../src/presentation.ts'

const thread = {type:'codex-action',actionId:'thread',actionType:'thread/start',category:'lifecycle',phase:'completed',protocolEvent:'thread/start',snapshot:{instructionSources:['C:/private/.codex/AGENTS.md']}}
const moderation = {type:'codex-action',actionId:'turn',actionType:'turn/moderationMetadata',category:'diagnostic',phase:'updated',protocolEvent:'turn/moderationMetadata',snapshot:{metadata:{prompt:{},generation:{},tool_call:{},tool_response:{}}}}
const command = {type:'codex-action',actionId:'cmd',actionType:'commandExecution',category:'action',phase:'completed',protocolEvent:'item/completed',snapshot:{command:'fixture-only'}}
function action(block: object, index: number): StreamChunk[] {
  return [{type:'block-start',index,blockType:'codex-action'},{type:'block-end',index,block}] as StreamChunk[]
}
async function project(chunks: StreamChunk[]): Promise<StreamChunk[]> {
  const result: StreamChunk[]=[]
  for await(const chunk of presentForDsh((async function*(){yield* chunks})(), () => {}))result.push(chunk)
  return result
}
describe('DSH native content boundary',()=>{
  it('drops only private lifecycle/empty moderation while preserving actual command and reply',async()=>{
    const replayState={response:{items:[{type:'message',role:'assistant',content:[{type:'output_text',text:'Reply'}]}]}}
    const result=await project([...action(thread,0),...action(moderation,1),...action(command,2),
      {type:'block-start',index:3,blockType:'text'},
      {type:'text-delta',index:3,text:'Reply'},
      {type:'block-end',index:3,block:{type:'text',text:'Reply'}},
      {type:'finish',reason:{kind:'stop'},replayState} as StreamChunk,
    ])
    expect(JSON.stringify(result)).not.toContain('codex-action')
    expect(JSON.stringify(result)).not.toContain('moderationMetadata')
    expect(JSON.stringify(result)).not.toContain('AGENTS.md')
    expect(result.filter(x=>x.type==='block-start').map(x=>x.index)).toEqual([0,1])
    expect(result).toContainEqual({type:'block-end',index:0,block:{type:'text',text:'Codex · Command: completed.\n\n'}})
    expect(result.at(-1)).toMatchObject({type:'finish',replayState})
    if(result.at(-1)?.type==='finish')expect(result.at(-1)).toHaveProperty('replayState',replayState)
  })
  it('does not swallow actual warning or failure notices',()=>{
    expect(actionText({...moderation,actionType:'warning',snapshot:{message:'Please review your configuration'}})).toContain('Please review')
    expect(actionText({...command,phase:'failed'})).toContain('failed')
    expect(actionText({...command,phase:'declined'})).toContain('declined')
  })
  it('keeps tool and reasoning payloads, remapping only their block indices',async()=>{
    const tool={type:'tool-call',id:'call-1',name:'read',arguments:'{"path":"fixture"}'}
    const result=await project([...action(thread,0),
      {type:'block-start',index:1,blockType:'reasoning'},
      {type:'reasoning-delta',index:1,text:'Thinking'},
      {type:'block-end',index:1,block:{type:'reasoning',text:'Thinking'}},
      {type:'block-start',index:2,blockType:'tool-call'},
      {type:'block-end',index:2,block:tool},
      {type:'finish',reason:{kind:'tool-calls'}},
    ] as StreamChunk[])
    expect(result).toContainEqual({type:'block-end',index:1,block:tool})
    expect(result).toContainEqual({type:'reasoning-delta',index:0,text:'Thinking'})
    expect(result.at(-1)).toEqual({type:'finish',reason:{kind:'tool-calls'}})
  })
  it('does not turn a native diagnostic into an automatic command or retry',async()=>{
    const result=await project([...action(thread,0),...action(moderation,1)])
    expect(result).toEqual([])
  })
})
