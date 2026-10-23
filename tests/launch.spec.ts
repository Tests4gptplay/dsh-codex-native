import { afterEach, describe, expect, it } from 'vitest'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import LocalSubprocessRuntime from '@deepseek-ai/dsh-subprocess-local'
import type { SubprocessSpawnSpec } from '@deepseek-ai/dsh-subprocess'
import { codexSpawnSpec, windowsCodexBinary } from '../src/launch.ts'
import { codexCliEntry } from '../src/runner.ts'
import { JsonRpcConnection } from '../src/wire.ts'
const directories:string[]=[]
afterEach(()=>{for(const p of directories.splice(0))rmSync(p,{recursive:true,force:true})})
function temporary():string{const p=mkdtempSync(join(tmpdir(),'codex-launch-test-'));directories.push(p);return p}
describe('plugin-owned official Codex launch',()=>{
  it('resolves the official Windows optional-package layout without a shell',()=>{
    const home=temporary(),manifest=join(home,'package.json')
    writeFileSync(manifest,'{"name":"fixture-codex"}')
    // Own the alias as well as the vendor file. Otherwise a global NODE_PATH in
    // a Windows runner can resolve the real installed alias instead of the fixture.
    const alias=join(home,'node_modules','@openai','codex-win32-x64')
    mkdirSync(alias,{recursive:true})
    writeFileSync(join(alias,'package.json'),'{"name":"@openai/codex-win32-x64","version":"0.0.0"}')
    const binary=join(alias,'vendor','x86_64-pc-windows-msvc','bin','codex.exe')
    mkdirSync(join(binary,'..'),{recursive:true});writeFileSync(binary,'test-only placeholder, not executed')
    expect(windowsCodexBinary(manifest,'x64')).toBe(binary)
  })
  it('does not alter other platforms or unrelated DSH commands',()=>{
    const spec:SubprocessSpawnSpec={argv:['unrelated','argument'],cwd:tmpdir(),stdio:{stdin:'pipe',stdout:'pipe',stderr:'pipe'},graceMs:1000,env:{}}
    expect(codexSpawnSpec(spec,'linux')).toBe(spec)
    expect(codexSpawnSpec(spec,'win32')).toBe(spec)
  })
  it.runIf(process.platform==='win32')('initializes the real official binary under DSH without the Node wrapper or credentials',async()=>{
    const home=temporary(),ctx=new Context()
    await ctx.plugin(LocalSubprocessRuntime)
    const spec=codexSpawnSpec({argv:[process.execPath,codexCliEntry(),'app-server','--stdio'],cwd:home,stdio:{stdin:'pipe',stdout:'pipe',stderr:{maxBytes:65536}},graceMs:1000,env:{CODEX_HOME:home}})
    expect(spec.argv[0]).toMatch(/codex\.exe$/i)
    expect(spec.argv[1]).toBe('app-server')
    expect(spec.argv).not.toContain(codexCliEntry())
    const child=ctx.subprocess.spawn(spec)
    const rpc=new JsonRpcConnection(child.stdin!,child.stdout!,8*1024*1024)
    try{
      const init=await rpc.request('initialize',{clientInfo:{name:'dsh-native-test',version:'test'}})
      expect(init).toBeTruthy()
      await rpc.notify('initialized',{})
      const status=await rpc.request('account/read',{refreshToken:false})
      expect(status).toHaveProperty('account',null)
    }finally{
      rpc.dispose(); child.terminate()
      await child.waitForExit(AbortSignal.timeout(6000))
      await ctx.fiber.dispose()
    }
  },30000)
})
