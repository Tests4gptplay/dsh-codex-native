/** TEST ONLY: exercise the official DSH AssistantMarkdown decision, not a replacement renderer. */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { resolve } from 'node:path'
import { mkdirSync, writeFileSync } from 'node:fs'
import { presentForDsh } from '../src/presentation.ts'
import type { StreamChunk } from '@deepseek-ai/dsh-llm'

// Leaf widgets are a neutral SSR shell; the official switch deciding 'unknownBlock' is NOT mocked.
vi.mock('@deepseek-ai/dsh-client-ui-primitives',()=>({
  MarkdownText:({text}:{text:string})=>createElement('p',null,text),
  JsonBlock:({label,payload}:{label:string;payload:unknown})=>createElement('details',null,createElement('summary',null,label),createElement('pre',null,JSON.stringify(payload))),
}))
afterEach(()=>vi.unstubAllGlobals())
const reference=process.env.DSH_REFERENCE_ROOT
const suite=reference ? describe : describe.skip
suite('official DSH 0.2.1 rendering contract with reported Codex events',()=>{
  it('reproduces unknown blocks before, and removes them after, without dropping the answer',async()=>{
    vi.stubGlobal('document',{baseURI:'http://localhost/fixture/'})
    const folder=resolve(reference!,'packages/client/ui-chat/src/client/chat')
    vi.doMock(resolve(folder,'ReasoningRow.tsx'),()=>({ReasoningRow:({text}:{text:string})=>createElement('span',null,text)}))
    const {AssistantMarkdown}=await import(/* @vite-ignore */ resolve(folder,'AssistantMarkdown.tsx'))
    const blocks=[
      {type:'codex-action',category:'lifecycle',actionType:'thread/start',actionId:'t',phase:'completed',snapshot:{threadId:'fixture'}},
      {type:'codex-action',category:'diagnostic',actionType:'turn/moderationMetadata',actionId:'m',phase:'updated',snapshot:{metadata:{prompt:{},generation:{},tool_call:{},tool_response:{}}}},
      {type:'codex-action',category:'action',actionType:'commandExecution',actionId:'c',phase:'completed',protocolEvent:'item/completed',snapshot:{}},
    ]
    const props={streaming:false,groupPart:undefined,useDisclosure:()=>({expanded:false,setExpanded:()=>{},toggle:()=>{}}),useGroupAction:()=>({current:null}),usePresentation:(select: (v: object)=>unknown)=>select({}),loadImage:async()=>'',renderSlot:()=>null,t:(key:string)=>key==='message.unknownBlock'?'未知内容块':key}
    const before=renderToStaticMarkup(createElement(AssistantMarkdown,{...props,blocks:[...blocks.map(block=>({kind:'other',block})),{kind:'text',text:'Actual answer survives.'}]}))
    const chunks=[] as StreamChunk[]
    blocks.forEach((block,index)=>chunks.push({type:'block-start',index,blockType:'codex-action'},{type:'block-end',index,block} as StreamChunk))
    chunks.push({type:'block-start',index:3,blockType:'text'},{type:'text-delta',index:3,text:'Actual answer survives.'},{type:'block-end',index:3,block:{type:'text',text:'Actual answer survives.'}})
    const visible: object[]=[]
    for await(const c of presentForDsh((async function*(){yield* chunks})(), () => {})){
      if(c.type==='block-end')visible.push(c.block.type==='text'?{kind:'text',text:c.block.text}:{kind:'other',block:c.block})
    }
    const after=renderToStaticMarkup(createElement(AssistantMarkdown,{...props,blocks:visible}))
    expect(before).toContain('未知内容块')
    expect(after).not.toContain('未知内容块')
    expect(after).not.toContain('moderationMetadata')
    expect(after).toContain('Command: completed')
    expect(after).toContain('Actual answer survives.')
    const output=process.env.DSH_REPRO_OUTPUT
    if(output){
      mkdirSync(output,{recursive:true})
      const wrap=(body:string)=>'<!doctype html><meta charset="utf-8"><title>Official DSH rendering contract — fixture replay</title><h1>Official DSH rendering-contract fixture</h1><p>Mock Codex stdio events. Neutral leaf widgets; not an authenticated Desktop session.</p>'+body
      writeFileSync(resolve(output,'before.html'),wrap(before))
      writeFileSync(resolve(output,'after.html'),wrap(after))
    }
  })
})
