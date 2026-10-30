import{it,expect}from'vitest'
import{Config}from'../src/index.ts'
import{CodexAppServerAdapter}from'../src/adapter.ts'
import type{CodexModel}from'../src/adapter.ts'
function adapter(models:CodexModel[],live:CodexModel[]){return new CodexAppServerAdapter({provider:'synthetic',displayName:'synthetic',modelProvider:'openai',models,fetchModels:async()=>live,maxRetries:0,maxRequestImageBytes:0,maxCachedSessions:1,sessionIdleTimeoutMs:1000,onCleanupError:()=>{},resolveAttachments:()=>undefined,runner:{open:async()=>{throw Error('No process')},async*stream(){throw Error('No process')}}})}
it('default catalog remains available without invented context capacity',async()=>{
 const models=Config({}).models! as CodexModel[];expect(models.length).toBeGreaterThan(0);expect(models.every(m=>m.contextWindow===undefined)).toBe(true)
 const a=adapter(models,[]);try{expect((await a.listModels('synthetic')).length).toBe(models.length);const m=await a.resolveModel('synthetic',models[0]!.id);expect(m.context).toBeUndefined();expect(m.pressureCompaction).toBe('provider')}finally{await a.dispose()}
})
it('live model metadata remains usable when no capacity is reported',async()=>{
 const a=adapter([],[{id:'actual-live-name',name:'Live',inputModalities:['text','image'],reasoningEfforts:['high']}]);try{const models=await a.listModels('synthetic');expect(models[0]).toMatchObject({id:'actual-live-name',name:'Live'});expect((await a.resolveModel('synthetic','actual-live-name')).context).toBeUndefined()}finally{await a.dispose()}
})
it('an explicitly configured capacity remains available with normal live catalog',async()=>{
 const a=adapter([{id:'chosen',name:'Configured',contextWindow:12345,inputModalities:['text'],reasoningEfforts:[]}],[{id:'chosen',name:'Live',inputModalities:['text'],reasoningEfforts:[]}]);try{expect((await a.resolveModel('synthetic','chosen')).context).toEqual({contextWindow:12345})}finally{await a.dispose()}
})
it('a genuine injected live capacity is used when user did not configure one',async()=>{
 const a=adapter([],[{id:'chosen',name:'Live',contextWindow:54321,inputModalities:['text'],reasoningEfforts:[]}]);try{expect((await a.resolveModel('synthetic','chosen')).context).toEqual({contextWindow:54321})}finally{await a.dispose()}
})
