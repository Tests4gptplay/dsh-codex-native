import { appServerCallId } from '../src/call-ids.ts'
import { describe, expect, it } from 'vitest'
import { MessageId, ToolCallId } from '@deepseek-ai/dsh-llm'
import type { GenerateOptions } from '@deepseek-ai/dsh-llm'
import { appServerHistory, appServerToolResults, AppServerEventMapper, extendAppServerHistory } from '../src/protocol.ts'
import type { JsonValue } from '../src/runner.ts'

// Independent service-side contract oracle: no copy of the production alias algorithm.
function validate(items: readonly JsonValue[]): void {
  for (const [index,item] of items.entries()) {
    if (item && typeof item==='object' && !Array.isArray(item) && typeof item.call_id==='string' && [...item.call_id].length>64) {
      throw new Error(`Invalid 'input[${index}].call_id': string too long. Expected a string with maximum length 64, but got a string with length ${[...item.call_id].length} instead. invalid_request_error string_above_max_length`)
    }
  }
}
function request(ids: string[], text='日记问题'): GenerateOptions {
  const messages: GenerateOptions['messages'][number][] = Array.from({length:18},(_,i)=>({id:MessageId(`user-${i}`),role:'user',source:{kind:'user'},content:[{type:'text',text:`fixture ${i}`}]}))
  for(const [i,id] of ids.entries()) {
    messages.push({id:MessageId(`call-${i}`),role:'assistant',source:{kind:'model',provider:'another-provider',model:'qa'},content:[{type:'tool-call',id:ToolCallId(id),name:'qa_probe',arguments:JSON.stringify({literal:id})}]})
    messages.push({id:MessageId(`result-${i}`),role:'tool',toolCallId:ToolCallId(id),toolName:'qa_probe',source:{kind:'tool'},content:[{type:'text',text:`result ${i}`}]} as GenerateOptions['messages'][number])
  }
  messages.push({id:MessageId('last-user'),role:'user',source:{kind:'user'},content:[{type:'text',text}]})
  return {provider:'codex-local',model:'qa-model',messages}
}
const callId=(item:JsonValue):string=>(item as {call_id:string}).call_id

describe('Responses call_id service compatibility',()=>{
  for(const n of [63,64,65,83])it(`pairs historical call/output at length ${n}`,()=>{
    const id='x'.repeat(n), options=request([id]), before=JSON.stringify(options), history=appServerHistory(options)
    validate(history)
    expect(callId(history[18]!)).toBe(callId(history[19]!))
    expect(callId(history[18]!)).not.toBe(id);expect(callId(history[18]!).length).toBeLessThanOrEqual(64)
    expect((history[18] as any).arguments).toBe(JSON.stringify({literal:id}))
    expect(JSON.stringify(options)).toBe(before)
    expect(appServerCallId(appServerToolResults(options,history)[0]!.callId)).toBe(callId(history[18]!))
  })
  it('recovers both diary question and subsequent hello without deleting the poisoned history',()=>{
    const id='c'.repeat(83), first=appServerHistory(request([id])), next=appServerHistory(request([id],'你好'))
    validate(first);validate(next);expect(first).toHaveLength(21);expect(next).toHaveLength(21)
    expect(callId(first[18]!)).toBe(callId(next[18]!));expect(next[20]).toMatchObject({content:[{text:'你好'}]})
  })
  it('does not conflate many IDs sharing all first64 characters',()=>{
    const ids=Array.from({length:20},(_,i)=>'p'.repeat(64)+String(i).padStart(19,'0'))
    const history=appServerHistory(request(ids));validate(history)
    const mapped=ids.map((_,i)=>callId(history[18+2*i]!));expect(new Set(mapped).size).toBe(ids.length)
    mapped.forEach((id,i)=>expect(callId(history[19+2*i]!)).toBe(id))
  })
  it.each(['界'.repeat(65),'🙂'.repeat(65),'é'.repeat(83), '\ud800'.repeat(83), '\ud801'.repeat(83)])('handles unicode and malformed UTF16 without changing message payloads %#',id=>{
    const h=appServerHistory(request([id]));validate(h);expect(callId(h[18]!)).toMatch(/^[A-Za-z0-9_-]{1,64}$/)
    expect((h[18] as any).arguments).toBe(JSON.stringify({literal:id}))
  })
  it('distinguishes unpaired surrogates rather than hashing replacement characters',()=>{
    expect(callId(appServerHistory(request(['\ud800'.repeat(83)]))[18]!)).not.toBe(callId(appServerHistory(request(['\ud801'.repeat(83)]))[18]!))
  })
  it('normalizes legacy provider replay and paired Harness result consistently on cold/retry reconstruction',()=>{
    const id='r'.repeat(83), options=request([id]);const messages=[...options.messages];const old=messages[18]!
    messages[18]={...old,source:{kind:'model',provider:'codex-local',model:'qa-model',replayState:{response:{kind:'codex-app-server',version:4,contextItems:[],items:[{type:'function_call',call_id:id,namespace:'deepseek_harness',name:'qa_probe',arguments:'{}'}]}}}} as typeof old
    const a=appServerHistory({...options,messages}),b=appServerHistory(JSON.parse(JSON.stringify({...options,messages})))
    validate(a);expect(a).toEqual(b);expect(callId(a[18]!)).toBe(callId(a[19]!))
  })
  it('uses identical IDs for newly emitted raw tool replay, history extension and tool outcomes',()=>{
    const id='n'.repeat(83), mapper=new AppServerEventMapper([],['qa_probe'])
    const chunks=mapper.toolCall({id:ToolCallId(id),name:'qa_probe',arguments:'{}'})
    expect(chunks).toContainEqual(expect.objectContaining({type:'block-end',block:expect.objectContaining({id})}))
    const replay=mapper.replayState().items;expect(callId(replay[0]!)).toBe(id)
    const extended=extendAppServerHistory(extendAppServerHistory([],replay),[{type:'function_call_output',call_id:id,output:'ok'}]);validate(extended)
    expect(callId(extended[0]!)).toBe(callId(extended[1]!))
  })
})

describe('raw protocol identity fields',()=>{
  it.each([63,64,65,83].flatMap(n=>['界','🙂'].map(char=>[n,char] as const)))('bounds unicode IDs with %s code points %#',(n,char)=>{
    const id=char.repeat(n),h=appServerHistory(request([id]));validate(h)
    expect(callId(h[18]!)).toBe(callId(h[19]!))
    expect(callId(h[18]!)).not.toBe(id)
  })
  it('normalizes provider echoes once and preserves program linkage without descending into payloads',()=>{
    const id='g'.repeat(83), mapper=new AppServerEventMapper([],['qa_probe'])
    mapper.accept({kind:'notification',method:'rawResponseItem/completed',params:{threadId:'qa',turnId:'qa',item:{type:'function_call',id:'raw',call_id:id,namespace:'deepseek_harness',name:'qa_probe',arguments:JSON.stringify({call_id:id}),caller:{type:'program',caller_id:id}}}})
    mapper.toolCall({id:ToolCallId(id),name:'qa_probe',arguments:JSON.stringify({call_id:id})})
    const items=mapper.replayState().items;validate(extendAppServerHistory([],items));expect(items).toHaveLength(1)
    expect(mapper.canReuseThread()).toBe(false)
    expect((items[0] as any).caller.caller_id).toBe(id);expect((items[0] as any).arguments).toBe(JSON.stringify({call_id:id}))
    const wire=extendAppServerHistory([],items);expect(extendAppServerHistory(wire,items)).toEqual(wire)
  })
  it('keeps paired custom/native tool call IDs compatible during cold replay',()=>{
    const id='native'.repeat(14), out=extendAppServerHistory([],[{type:'custom_tool_call',call_id:id,name:'qa_custom',input:'untouched'},{type:'custom_tool_call_output',call_id:id,output:'untouched'}])
    validate(out);expect(callId(out[0]!)).toBe(callId(out[1]!));expect((out[0] as any).input).toBe('untouched')
  })
  it('retires a live native-tool thread with long raw IDs, not just Harness callbacks',()=>{
    const mapper=new AppServerEventMapper(),id='native'.repeat(14)
    for(const item of [{type:'custom_tool_call',call_id:id,name:'qa',input:'x'},{type:'custom_tool_call_output',call_id:id,output:'y'}]) mapper.accept({kind:'notification',method:'rawResponseItem/completed',params:{threadId:'qa',turnId:'qa',item}})
    validate(extendAppServerHistory([],mapper.replayState().items));expect(mapper.canReuseThread()).toBe(false)
    const restored=new AppServerEventMapper(extendAppServerHistory([],mapper.replayState().items))
    expect(restored.canReuseThread()).toBe(true)
  })
})


describe('raw versus wire domains',()=>{
 it('keeps a legitimate short ID equal to a long-ID alias distinct without a reserved-prefix gate',()=>{
  const long='collision'.repeat(11),short=appServerCallId(long),h=appServerHistory(request([long,short]))
  validate(h);expect(callId(h[18]!)).toBe(short);expect(callId(h[20]!)).not.toBe(short)
  expect(callId(h[18]!)).toBe(callId(h[19]!));expect(callId(h[20]!)).toBe(callId(h[21]!))
  const results=appServerToolResults(request([long,short]),h);expect(results.map(r=>appServerCallId(r.callId))).toEqual([callId(h[18]!),callId(h[20]!)])
 })
 it('does not encode injected wire echoes twice or persist their wire IDs as new raw replay',()=>{
  const raw='legacy'.repeat(14),history=appServerHistory(request([raw])),mapper=new AppServerEventMapper(history,['qa_probe'])
  for(const item of history)mapper.accept({kind:'notification',method:'rawResponseItem/completed',params:{threadId:'qa',turnId:'qa',item}})
  expect(mapper.replayState().items).toEqual([])
  expect(extendAppServerHistory(history,[])).toEqual(history)
 })
})
