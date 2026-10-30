// Behavior regressions for lifecycle fixes. Real implementation with controlled peers. No real child process, credentials, network.
import { it, expect } from 'vitest';
import { PassThrough } from 'node:stream';
import { NativeCodexAccount } from '../src/native-account.ts';
import { registerNativeCodexTransport } from '../src/native-transport.ts';
import { CodexSessionCache } from '../src/session-cache.ts';
import { LatestCodexRuntime } from '../src/latest-runtime.ts';
const pause=(ms=30)=>new Promise(r=>setTimeout(r,ms));
function peer(index=0, opts:any={}) {
  const input=new PassThrough(),output=new PassThrough();
  const done=Promise.withResolvers(); let stopped=false, buffer='';
  const seen:string[]=[];
  input.setEncoding('utf8'); input.on('data',(chunk:string)=>{
    buffer+=chunk;let nl;
    while((nl=buffer.indexOf('\n'))>=0){
      const line=buffer.slice(0,nl);buffer=buffer.slice(nl+1);if(!line)continue;
      const r=JSON.parse(line);seen.push(r.method); if(r.id===undefined)continue;
      if(opts.silent===r.method)continue;
      if(opts.delayInit && r.method==='initialize'){setTimeout(()=>{if(!stopped)output.write(JSON.stringify({id:r.id,result:{}})+'\n')},opts.delayInit);continue;}
      let result:any={};
      if(r.method==='account/read')result={account:null};
      if(r.method==='account/login/start')result={loginId:'synthetic-'+index,authUrl:'http://example.invalid/simulated'};
      if(r.method==='model/list')result={data:[],nextCursor:'repeated-cursor'};
      output.write(JSON.stringify(opts.error && r.method==='account/read'
       ? {id:r.id,error:{message:'synthetic password=FAKE_QA_ONLY'}} : {id:r.id,result})+'\n');
    }
  });
  return {seen, get stopped(){return stopped}, handle:{stdin:input,stdout:output,done:done.promise,
    terminate(){if(stopped)return;stopped=true;output.end();done.resolve({exitCode:0,signal:null})},
    waitForExit:async()=>true,collected:{stderr:{readFrom:()=>({text:''})}}} as any};
}
it('A01: account launch preserves configured environment and cancellation',async()=>{
  let spec:any; const p=peer(); const a=new NativeCodexAccount((s:any)=>{spec=s;return p.handle},{env:{CODEX_HOME:'/synthetic-only/qa-home'}});
  try{await a.status();expect(spec.env).toEqual({CODEX_HOME:'/synthetic-only/qa-home'});expect(spec.signal).toBeInstanceOf(AbortSignal);}
  finally{await a.dispose()}
});
it('A02: overlapping login starts cancel obsolete initialization and retain no orphan',async()=>{
  const peers:any[]=[];const a=new NativeCodexAccount(()=>{const p=peer(peers.length,{delayInit:peers.length===1?20:0});peers.push(p);return p.handle});
  try{
    const [one,two]=await Promise.allSettled([a.start('browser'),a.start('browser')]);
    expect(one.status).toBe('rejected');expect(two.status).toBe('fulfilled');if(two.status==='fulfilled')await a.cancel(two.value.id);expect(peers.every(p=>p.stopped)).toBe(true);
  }finally{await a.dispose()}
});
it('A03: simultaneous same-session acquisition allows exactly one owned lease',async()=>{
  const threads:any[]=[];const runner={open:async()=>{const t={threadId:'t'+threads.length,closed:false, async *stream(){},async dispose(){this.closed=true}};threads.push(t);return t}};
  const cache=new CodexSessionCache({runner:runner as any,maxSessions:8,idleTimeoutMs:600000,onCleanupError:()=>{}});
  const req:any={sessionId:'synthetic-one',epoch:{v:1},thread:{model:'synthetic-model',modelProvider:'openai',system:'',dynamicTools:[]},history:[],loadInjectedHistory:async()=>[],loadUserInput:async(x:any)=>x,loadToolResult:async(x:any)=>x,toolResults:[]};
  const results=await Promise.allSettled([cache.begin(req),cache.begin(req)]);const steps=results.flatMap(x=>x.status==='fulfilled'?[x.value]:[]);
  try {expect(threads.length).toBe(1);expect(results.filter(x=>x.status==='rejected')).toHaveLength(1);await cache.disposeSession('synthetic-one');expect(threads.filter(t=>!t.closed)).toHaveLength(0)}
  finally{for(const step of steps)await step.discard();await cache.dispose()}
});
it('A04: aborted admitted HTTP request releases stalled account operation',async()=>{
  const p=peer(0,{silent:'account/read'});const a=new NativeCodexAccount(()=>p.handle);let handler:any;
  const dispose=registerNativeCodexTransport({fetch:{register:(r:any)=>{if(r.path==='/api/codex-native/status')handler=r.fetch;return async()=>{}}}} as any,a);
  const ctrl=new AbortController();let settled=false;
  const req=new Request('http://localhost/api/codex-native/status',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({type:'client-request',rpcId:'audit-rpc',method:'codex-native/status',payload:{}}),signal:ctrl.signal});
  const result=handler(req).then((x:any)=>{settled=true;return x});
  try {await pause();expect(p.seen).toContain('account/read');ctrl.abort();await pause();expect(settled).toBe(true);expect(p.stopped).toBe(true)}
  finally{await a.dispose();await result;await dispose()}
});
it('A05: runtime caller cancellation exits without waiting for metadata',async()=>{
  const gate=Promise.withResolvers<any>();const source={manifest:()=>gate.promise,extract:async()=>{throw new Error('not reached')}};
  const runtime=new LatestCodexRuntime(()=>{},'/workspace/shared/dsh-six-qa/codex-native/code-basis-audit-20261029/no-runtime-writes',source);
  const ctrl=new AbortController();let settled=false;
  const pending=runtime.spawnSpec({argv:['node','codex.js','app-server'],env:{},signal:ctrl.signal} as any).then(()=>{settled=true},()=>{settled=true});
  try{ctrl.abort();await pause();expect(settled).toBe(true)}
  finally{gate.reject(new Error('synthetic offline'));await pending}
});
it('A06: protocol errors redact synthetic credential-shaped text',async()=>{
  const p=peer(0,{error:true});const a=new NativeCodexAccount(()=>p.handle);
  try{await expect(a.status()).rejects.toThrow('password=[redacted]')}
  finally{await a.dispose()}
});
it('A08: repeated model pagination cursor is an error, not an unbounded loop',async()=>{
 const p=peer();const a=new NativeCodexAccount(()=>p.handle);
 try{await expect(a.models()).rejects.toThrow('repeated a pagination cursor');expect(p.seen.filter(x=>x==='model/list')).toHaveLength(2)}finally{await a.dispose()}
});
it('A09: cancelling one shared runtime refresh caller preserves another owner',async()=>{
 const gate=Promise.withResolvers<any>();let calls=0,upstream:AbortSignal|undefined;
 const runtime=new LatestCodexRuntime(()=>{},'/synthetic-no-writes',{manifest:async(_s,opts)=>{calls++;upstream=opts.signal as AbortSignal;return gate.promise},extract:async()=>{throw new Error('not reached')}});
 const one=new AbortController();const two=new AbortController();
 const first=runtime.resolve(one.signal).then(()=> 'ok',()=> 'cancelled');const second=runtime.resolve(two.signal).then(()=> 'ok',()=> 'cancelled');
 one.abort();expect(await first).toBe('cancelled');expect(calls).toBe(1);expect(upstream?.aborted).toBe(false);
 two.abort();expect(await second).toBe('cancelled');expect(upstream?.aborted).toBe(true);gate.reject(new Error('synthetic offline'));
});
it('A10: disposing or logging out cancels an account initialization before a login id exists',async()=>{
 for(const action of ['dispose','logout'] as const){
  let index=0;const peers:any[]=[];const a=new NativeCodexAccount(()=>{const p=peer(index,{silent:index++===0?'initialize':undefined});peers.push(p);return p.handle});
  const pending=a.start('browser').then(()=> 'ok',()=> 'cancelled');
  await pause();await a[action]();expect(await pending).toBe('cancelled');expect(peers.every(x=>x.stopped)).toBe(true);await a.dispose();
 }
});
it('A11: cache disposal during acquire cannot create a late unowned lease',async()=>{
 let opens=0;const runner={open:async()=>{opens++;return{threadId:'x',async *stream(){},async dispose(){}}}};
 const cache=new CodexSessionCache({runner:runner as any,maxSessions:8,idleTimeoutMs:600000,onCleanupError:()=>{}});
 const req:any={sessionId:'synthetic-one',epoch:{v:1},thread:{model:'synthetic',modelProvider:'openai',system:'',dynamicTools:[]},history:[],loadInjectedHistory:async()=>[],toolResults:[]};
 const result=cache.begin(req).then(()=> 'ok',()=> 'cancelled');await cache.dispose();expect(await result).toBe('cancelled');expect(opens).toBe(0);
});
it('A12: another turn completion cannot finish the owned thread stream',async()=>{
 const {ManagedCodexThread}=await import('../src/thread.ts');
 const events:any[]=[{kind:'notification',method:'turn/completed',params:{threadId:'qa-thread',turn:{id:'foreign',status:'completed'}}},{kind:'notification',method:'turn/completed',params:{threadId:'qa-thread',turn:{id:'owned',status:'completed'}}}];
 const connection:any={closed:false,signal:new AbortController().signal,request:async()=>({turn:{id:'owned'}}),next:async()=>({done:false,value:events.shift()})};
 const thread=new ManagedCodexThread({timeoutMs:0,connection,threadId:'qa-thread',abort(){},dispose:async()=>{},startedEvent:{kind:'thread-started',threadId:'qa-thread',userAgent:'synthetic',instructionSources:[]}});
 const received=[];for await(const e of thread.stream({input:[]}))received.push(e);
 expect(received.filter(e=>e.kind==='notification').map((e:any)=>e.params.turn.id)).toEqual(['owned']);await thread.dispose();
});
it('A13: cancelled caller rejects early and a late provider child is still terminated',async()=>{
 const gate=Promise.withResolvers<any>();const a=new NativeCodexAccount(()=>gate.promise);const ctrl=new AbortController();
 const result=a.status(ctrl.signal).then(()=> 'ok',()=> 'cancelled');ctrl.abort();expect(await result).toBe('cancelled');
 const p=peer();gate.resolve(p.handle);await pause();expect(p.stopped).toBe(true);await a.dispose();
});
it('A14: disposing skill discovery cancels a pending subprocess provider and cleans its late child',async()=>{
 const {NativeCodexSkills}=await import('../src/native-skills.ts');const gate=Promise.withResolvers<any>();
 const skills=new NativeCodexSkills({spawn:()=>gate.promise,env:{},disposeGraceMs:3000,maxJsonRpcLineBytes:1024,maxStderrBytes:1024,maxContextTokens:10000});
 const result=skills.catalog('/synthetic',new AbortController().signal).then(()=> 'ok',()=> 'cancelled');await skills.dispose();expect(await result).toBe('cancelled');const p=peer();gate.resolve(p.handle);await pause();expect(p.stopped).toBe(true);
});
