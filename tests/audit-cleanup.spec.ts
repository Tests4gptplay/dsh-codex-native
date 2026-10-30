import {it,expect} from 'vitest'
import {mkdtemp,writeFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {NativeCodexSkills,searchNativeSkills} from '../src/native-skills.ts'
import {Config} from '../src/index.ts'
import {assertCompletedTurn} from '../src/protocol.ts'
import {codexAppServerArgv} from '../src/runner.ts'
it('does not manufacture provider Retry-After from a plain capacity message',()=>{
 let error:any;try{assertCompletedTurn({kind:'notification',method:'turn/completed',params:{turn:{status:'failed',error:{message:'Selected model is at capacity'}}}})}catch(e){error=e}
 expect(error.code).toBe('MODEL_CAPACITY');expect(error.message).toBe('Selected model is at capacity');expect(error.failure.providerRetryAfterMs).toBeUndefined()
})
it('search accepts requested 21 results with exact unchanged summaries',()=>{
 const skills=Array.from({length:25},(_,i)=>({id:`local:${i}`,name:`s${String(i).padStart(2,'0')}`,description:'synthetic',source:'local' as const,path:`/synthetic/${i}`,pluginId:null,remoteMarketplace:null,remotePluginId:null,skillName:'synthetic',dependencies:null}))
 const result=searchNativeSkills({skills,warnings:[]},'', 'all',0,21);expect(result.skills).toHaveLength(21);expect(result.nextOffset).toBe(21);expect(result.total).toBe(25)
})
it('read accepts requested 1001 lines without truncating the chosen page',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'native-audit-owned-'));const path=join(dir,'SKILL.md');const contents=Array.from({length:1002},(_,i)=>`synthetic line ${i+1}`).join('\n');await writeFile(path,contents)
 const service=new NativeCodexSkills({spawn:()=>{throw Error('No process permitted in this pure case')},env:{},maxJsonRpcLineBytes:0,maxStderrBytes:1024,disposeGraceMs:1,maxContextTokens:10000})
 ;(service as any).cached={cwd:dir,catalog:{skills:[{id:'local:test',name:'synthetic',source:'local',path,skillName:'synthetic',dependencies:null}],warnings:[]}}
 try{const result=await service.read(dir,'local:test',new AbortController().signal,1,1001);expect(result.contents).toBe(contents.split('\n').slice(0,1001).join('\n'));expect(result.nextOffset).toBe(1002)}finally{await service.dispose();await rm(dir,{recursive:true})}
})
it('accepts explicit 10001 skill token setting and transports that exact choice',()=>{
 const config=Config({skillsMaxContextTokens:10001});expect(config.skillsMaxContextTokens).toBe(10001);expect(codexAppServerArgv(undefined,true,'custom','native',config.skillsMaxContextTokens)).toContain('skills.max_context_tokens=10001')
})
