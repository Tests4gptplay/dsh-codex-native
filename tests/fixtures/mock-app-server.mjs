// TEST ONLY: private stdio peer. No network, credentials, filesystem commands or production registration.
import { createInterface } from 'node:readline'
import { writeSync } from 'node:fs'
const mode = process.env.TEST_CODEX_SCENARIO ?? 'answer'
const write = value => process.stdout.write(JSON.stringify(value) + '\n')
const notify = (method, params) => write({ method, params })
function answer() {
  if (mode === 'exit-during-turn') {
    writeSync(2, 'Fixture fatal process exit; access_token=fixture-secret\n')
    process.exit(42)
  }
  notify('turn/moderationMetadata', {threadId:'test-thread',turnId:'test-turn',metadata:{prompt:{},generation:{},tool_call:{},tool_response:{}}})
  if (mode === 'error') {
    notify('turn/completed',{threadId:'test-thread',turn:{id:'test-turn',status:'failed',error:{message:'Fixture model rejected this request'}}})
    return
  }
  const item = {type:'commandExecution',id:'test-command',command:'echo fixture (not executed)',status:'completed',aggregatedOutput:'fixture'}
  notify('item/started',{threadId:'test-thread',turnId:'test-turn',item:{...item,status:'inProgress'}})
  notify('item/completed',{threadId:'test-thread',turnId:'test-turn',item})
  notify('item/agentMessage/delta',{threadId:'test-thread',turnId:'test-turn',itemId:'test-message',delta:'Mock Codex reply preserved.'})
  notify('rawResponseItem/completed',{threadId:'test-thread',turnId:'test-turn',item:{type:'message',id:'test-raw',role:'assistant',content:[{type:'output_text',text:'Mock Codex reply preserved.'}]}})
  notify('item/completed',{threadId:'test-thread',turnId:'test-turn',item:{type:'agentMessage',id:'test-message',text:'Mock Codex reply preserved.'}})
  notify('turn/completed',{threadId:'test-thread',turn:{id:'test-turn',status:'completed',error:null}})
}
createInterface({input:process.stdin}).on('line',line=>{
  const request=JSON.parse(line)
  if(request.id===undefined)return
  if(request.method==='initialize')write({id:request.id,result:{userAgent:'fixture-codex/0.154.0'}})
  else if(request.method==='thread/start')write({id:request.id,result:{thread:{id:'test-thread'},instructionSources:['C:/fixture/.codex/AGENTS.md']}})
  else if(request.method==='thread/inject_items')write({id:request.id,result:{}})
  else if(request.method==='turn/start'){
    write({id:request.id,result:{turn:{id:'test-turn',status:'inProgress'}}})
    setImmediate(answer)
  }else write({id:request.id,result:{}})
}).on('close',()=>process.exit(0))
