from pathlib import Path
import subprocess
p=Path.cwd()
def replace(path, old, new, count=1):
 f=p/path;s=f.read_text();n=s.count(old)
 if n!=count: raise ValueError((path,n,old[:90]))
 f.write_text(s.replace(old,new))
replace('src/wire.ts','  private stopped = false\n','  private stopped = false\n  private failure: Error | undefined\n  private readonly stopSignal = new AbortController()\n')
replace('src/wire.ts',"    output.once('end', this.onEnd)\n", "    output.once('end', this.onEnd)\n    output.once('close', this.onEnd)\n    input.once('close', this.onEnd)\n")
replace('src/wire.ts','  private readonly onData = (chunk: string): void => {', '''  /** Observed pipe state only; no heartbeat, polling, or model request. */
  get closed(): boolean {
    return this.stopped || this.output.readableEnded || this.output.destroyed
      || this.input.destroyed || this.input.writableEnded
  }

  private readonly onData = (chunk: string): void => {''')
replace('src/wire.ts', '''    if (this.stopped) throw new LlmError('Codex App Server connection is closed', 'TRANSPORT')
    const line = `${JSON.stringify(envelope)}\\n`
    if (this.input.write(line)) return
    await once(this.input, 'drain')''', '''    if (this.closed) throw this.failure ?? new LlmError('Codex App Server connection is closed', 'TRANSPORT')
    const line = `${JSON.stringify(envelope)}\\n`
    if (this.input.write(line)) return
    try {
      await once(this.input, 'drain', { signal: this.stopSignal.signal })
    } catch (error: unknown) {
      throw this.failure ?? error
    }''')
replace('src/wire.ts', '''    try {
      await this.send({ method, id, params })
    } catch (error: unknown) {
      this.pending.delete(rpcKey(id))
      waiter.reject(error)
    }
    return waiter.promise''','''    // Adopt the response immediately: a pipe failure can reject it while a
    // backpressured write is still waiting for drain.
    void this.send({ method, id, params }).catch((error: unknown) => {
      this.pending.delete(rpcKey(id))
      waiter.reject(error)
    })
    return waiter.promise''')
replace('src/wire.ts', '''    this.stopped = true
    this.detach()
    for (const pending of this.pending.values()) pending.waiter.reject(error)''','''    this.stopped = true
    this.failure = error
    this.stopSignal.abort(error)
    this.detach()
    for (const pending of this.pending.values()) pending.waiter.reject(error)''')
replace('src/wire.ts', '''    this.stopped = true
    this.detach()
    const error = new LlmError('Codex App Server connection disposed', 'ABORTED')''','''    this.stopped = true
    const error = new LlmError('Codex App Server connection disposed', 'ABORTED')
    this.failure = error
    this.stopSignal.abort(error)
    this.detach()''')
replace('src/wire.ts', "    this.output.off('end', this.onEnd)\n", "    this.output.off('end', this.onEnd)\n    this.output.off('close', this.onEnd)\n    this.input.off('close', this.onEnd)\n")
replace('src/wire.ts', "    this.output.off('error', this.onError)\n    this.input.off('error', this.onError)\n", '''    // Keep the once-only error handlers through stream teardown. Late EPIPE
    // must not become an unhandled EventEmitter error in the DSH host.
''')
(p/'src/process-connection.ts').write_text('''/** Process exit evidence shared by model and account stdio connections. */
import { LlmError } from '@deepseek-ai/dsh-llm'
import type { SubprocessHandle, SubprocessOutcome } from '@deepseek-ai/dsh-subprocess'
import { JsonRpcConnection } from './wire.ts'

/** Keep diagnostics useful without echoing common credentials into chat errors. */
export function diagnosticText(value: string): string {
  return value.replace(/\\x1b\\[[0-9;]*[A-Za-z]/gu, '')
    .replace(/Bearer\\s+[^\\s"'<>]+/giu, 'Bearer [redacted]')
    .replace(/\\bsk-[A-Za-z0-9_-]+/gu, '[redacted-key]')
    .replace(/\\beyJ[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+/gu, '[redacted-token]')
    .replace(/((?:access_token|refresh_token|id_token|api[_-]?key|authorization|password)["']?\\s*[:=]\\s*["']?)[^\\s,"'}&]+/giu, '$1[redacted]')
    .replace(/(https?:\\/\\/[^\\s?#]+)\\?[^\\s]*/giu, '$1?[redacted-query]')
    .replace(/\\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}\\b/giu, '[redacted-email]')
    .trim().slice(-2_000)
}

/** No new process or polling: observe the handle the DSH host already owns. */
export function connectCodexProcess(child: SubprocessHandle, maxLineBytes: number) {
  if (!child.stdin || !child.stdout) throw new LlmError('Codex App Server subprocess did not expose protocol pipes', 'TRANSPORT')
  const rpc = new JsonRpcConnection(child.stdin, child.stdout, maxLineBytes)
  let outcome: SubprocessOutcome | undefined
  let launchFailure: string | undefined
  let cleanupRequested = false
  let exitDuringCleanup = false
  // This rejection handler is attached before initialize, including when spawn
  // fails without ever producing a stdout end event.
  void child.done.then(result => {
    outcome = result
    exitDuringCleanup = cleanupRequested
    rpc.fail(new LlmError('Codex App Server process exited', 'TRANSPORT'))
  }, (error: unknown) => {
    launchFailure = diagnosticText(error instanceof Error ? error.message : String(error))
    rpc.fail(new LlmError('Codex App Server process failed to start', 'TRANSPORT', { cause: error }))
  })
  return {
    rpc,
    markCleanup(): void { cleanupRequested = true },
    /** Called AFTER cleanup so stdout EOF cannot hide the later exit evidence. */
    failure(value: unknown): Error {
      const error = value instanceof Error ? value : new Error(String(value))
      if (error instanceof LlmError && error.code !== 'TRANSPORT') return error
      const exit = outcome === undefined
        ? 'exit status not reported'
        : `exit=${String(outcome.exitCode)}, signal=${String(outcome.signal)}${exitDuringCleanup ? ' (observed during cleanup)' : ''}`
      let stderr = ''
      try { stderr = diagnosticText(child.collected?.stderr?.readFrom(0).text ?? '') } catch { /* optional evidence */ }
      const details = [exit, ...(launchFailure ? [`launch: ${launchFailure}`] : []), stderr ? `stderr: ${stderr}` : 'no stderr reported'].join('; ')
      return new LlmError(`${error.message} [local Codex process; ${details}]`, 'TRANSPORT', { cause: error })
    },
  }
}
''')
replace('src/runner.ts', '  SubprocessOutcome,\n','')
replace('src/runner.ts', "import { SAFE_MODEL_ID } from './identifiers.ts'\n", "import { SAFE_MODEL_ID } from './identifiers.ts'\nimport { connectCodexProcess } from './process-connection.ts'\n")
replace('src/runner.ts', '  readonly threadId: string\n  stream(request:', '  readonly threadId: string\n  /** True only after the owned process/pipe has actually closed. */\n  readonly closed?: boolean\n  stream(request:')
s=(p/'src/runner.ts').read_text();start=s.index('function readStderr(');end=s.index('function thrown(',start);s=s[:start]+s[end:];(p/'src/runner.ts').write_text(s)
replace('src/runner.ts', '''    await child.done.catch(() => {
      // Exit and wait failures are already reported by the connection or the checks above.
    })
''','''    // done is already observed by connectCodexProcess; do not await it again
    // without a bound after waitForExit has reported an unsuccessful teardown.
''')
replace('src/runner.ts', '    let connection: JsonRpcConnection | undefined\n','    let connection: JsonRpcConnection | undefined\n    let processConnection: ReturnType<typeof connectCodexProcess> | undefined\n')
s=(p/'src/runner.ts').read_text();start=s.index('      connection = new JsonRpcConnection(');end=s.index('      const initialized = ',start)
s=s[:start]+'''      processConnection = connectCodexProcess(child, this.options.maxJsonRpcLineBytes)
      connection = processConnection.rpc
      const activeConnection = connection
      const diagnostics = processConnection
'''+s[end:];(p/'src/runner.ts').write_text(s)
replace('src/runner.ts', '''        if (disposeTask !== undefined) return disposeTask
        if (!lifetime.signal.aborted) lifetime.abort(CONSUMER_REASON)''', '''        if (disposeTask !== undefined) return disposeTask
        diagnostics.markCleanup()
        if (!lifetime.signal.aborted) lifetime.abort(CONSUMER_REASON)''')
replace('src/runner.ts', '        dispose,\n        startedEvent:', '        dispose,\n        failure: error => diagnostics.failure(error),\n        startedEvent:')
replace('src/runner.ts', '''      let failure = operationFailure(error, timedOut, request.signal)
      if (!lifetime.signal.aborted)''', '''      let failure = operationFailure(error, timedOut, request.signal)
      processConnection?.markCleanup()
      if (!lifetime.signal.aborted)''')
replace('src/runner.ts', '      throw failure\n    } finally {', '      throw processConnection?.failure(failure) ?? failure\n    } finally {')
replace('src/thread.ts', '  readonly dispose: () => Promise<void>\n', '  readonly dispose: () => Promise<void>\n  readonly failure?: (error: LlmError) => Error\n')
replace('src/thread.ts', '  async * stream(request:', '''  get closed(): boolean {
    return this.state.kind === 'disposed' || this.options.connection.closed
  }

  async * stream(request:''')
replace('src/thread.ts', '    if (primary !== undefined) throw primary\n', '    if (primary !== undefined) throw this.options.failure?.(primary) ?? primary\n')
replace('src/session-cache.ts', '  private readonly threadTask: Promise<CodexAppServerThreadPort>\n', '  private readonly threadTask: Promise<CodexAppServerThreadPort>\n  private thread: CodexAppServerThreadPort | undefined\n')
replace('src/session-cache.ts', '    this.threadTask = runner.open({ ...request.thread, signal })', '''    this.threadTask = runner.open({ ...request.thread, signal }).then(thread => {
      this.thread = thread
      return thread
    })''')
replace('src/session-cache.ts', "    if (this.state.kind === 'disposed') return undefined\n", "    if (this.state.kind === 'disposed' || this.thread?.closed === true) return undefined\n")
replace('src/native-account.ts', "import { JsonRpcConnection, object } from './wire.ts'\n", "import { JsonRpcConnection, object } from './wire.ts'\nimport { connectCodexProcess } from './process-connection.ts'\n")
replace('src/native-account.ts', '  close(): Promise<void>\n', '  close(): Promise<void>\n  failure(error: unknown): Error\n')
replace('src/native-account.ts', '''    const rpc = new JsonRpcConnection(child.stdin, child.stdout, 8 * 1024 * 1024)
    let closed = false
    const close = async (): Promise<void> => {
      if (closed) return
      closed = true
      rpc.dispose()
      child.terminate()
      await child.waitForExit().catch(() => {})
    }''', '''    const diagnostics = connectCodexProcess(child, 8 * 1024 * 1024)
    const rpc = diagnostics.rpc
    let closeTask: Promise<void> | undefined
    const close = (): Promise<void> => {
      closeTask ??= (async () => {
        rpc.dispose()
        diagnostics.markCleanup()
        child.terminate()
        await child.waitForExit(AbortSignal.timeout(6_000)).catch(() => {})
      })()
      return closeTask
    }''')
replace('src/native-account.ts', '      return { child, rpc, close }', '      return { child, rpc, close, failure: diagnostics.failure }')
replace('src/native-account.ts', '''      await close()
      throw error''', '''      await close()
      throw diagnostics.failure(error)''')
replace('src/native-account.ts', '''    try { return await fn(conn.rpc) }
    finally''', '''    try { return await fn(conn.rpc) }
    catch (error: unknown) {
      await conn.close()
      throw conn.failure(error)
    }
    finally''')
replace('src/native-account.ts', '''      await conn.close()
      throw error''', '''      await conn.close()
      throw conn.failure(error)''')
replace('src/native-account.ts', '''    } catch (error: unknown) {
      if (this.active === conn) this.flow = { id: loginId, phase: 'failed', mode: this.flow?.mode ?? 'browser', error: error instanceof Error ? error.message.slice(0, 180) : 'Codex login transport failed' }
''', '''    } catch (error: unknown) {
      await conn.close()
      if (this.active === conn) this.flow = { id: loginId, phase: 'failed', mode: this.flow?.mode ?? 'browser', error: conn.failure(error).message }
''')
replace('src/native-transport.ts', 'error.message.slice(0, 160)', 'error.message.slice(0, 3_000)')
replace('tests/native-account.spec.ts', '  const terminated = vi.fn()', '''  const done = Promise.withResolvers<{ exitCode: number; signal: null }>()
  const terminated = vi.fn(() => {
    output.end()
    done.resolve({ exitCode: 0, signal: null })
  })''')
replace('tests/native-account.spec.ts', 'done: Promise.resolve({ exitCode: 0 }),', 'done: done.promise,')
replace('tests/fixtures/mock-app-server.mjs', "import { createInterface } from 'node:readline'", "import { createInterface } from 'node:readline'\nimport { writeSync } from 'node:fs'")
replace('tests/fixtures/mock-app-server.mjs', 'function answer() {', '''function answer() {
  if (mode === 'exit-during-turn') {
    writeSync(2, 'Fixture fatal process exit; access_token=fixture-secret\\n')
    process.exit(42)
  }''')
replace('tests/mock-stdio.spec.ts', "mode: 'answer' | 'error'", "mode: 'answer' | 'error' | 'exit-during-turn'")
replace('tests/mock-stdio.spec.ts', "  it('preserves a genuine model failure", '''  it('reports stderr from an actual terminated subprocess without an unhandled rejection',async()=>{
    const error = await execute('exit-during-turn').catch(error => error)
    expect(error).toBeInstanceOf(Error)
    expect(error.message).toContain('Fixture fatal process exit')
    expect(error.message).toContain('local Codex process')
    expect(error.message).toContain('exit=')
    expect(error.message).not.toContain('fixture-secret')
  },30000)
  it('preserves a genuine model failure''')
replace('package.json','"version": "0.2.1-alpha.5"','"version": "0.2.1-alpha.6"')
for name, heading, section in [
 ('README.md','## Current preview: v0.2.1-alpha.5', '''## Protocol stream fix in alpha.6

Repairs hanging requests after local stdio closure, captures process exit diagnostics, and recreates an already-closed cached connection on the next request from recorded history. No heartbeat, watchdog, polling or automatic mid-task replay is added. The initiating cause of the user's original process exit is not yet established from machine logs. See [reproduction and acceptance scope](docs/PROTOCOL_STREAM_FIX.md).

'''),
 ('README.zh.md','## 当前测试版：v0.2.1-alpha.5', '''## alpha.6 协议断流修复

修复本地标准输入输出断开后请求挂起、退出详情丢失及失效缓存连接复用；下一次请求可从已有记录重建连接。不新增心跳、Watchdog、轮询或执行途中自动重放。尚未从用户机器日志确定最初退出原因，不宣称解决所有 Codex 崩溃。[复现与验证范围](docs/PROTOCOL_STREAM_FIX.md)。

''')]:
 f=p/name;s=f.read_text();assert heading in s;s=s.replace(heading,section+heading.replace('alpha.5','alpha.6'),1)
 s=s.replace('#v0.2.1-alpha.5','#v0.2.1-alpha.6').replace('/tag/v0.2.1-alpha.5','/tag/v0.2.1-alpha.6').replace('/download/v0.2.1-alpha.5/dsh-codex-native-0.2.1-alpha.5.tgz','/download/v0.2.1-alpha.6/dsh-codex-native-0.2.1-alpha.6.tgz')
 f.write_text(s)
ci=subprocess.check_output(['git','show','8189032c2d6628338502a9efb2e4c667ce0530a0:.github/workflows/ci.yml'],text=True)
ci=ci.replace('branches: [main]',"branches: [main, 'fix/protocol-stream-lifecycle']",1)
(p/'.github/workflows/ci.yml').write_text(ci)
print('Applied exact lifecycle patch and restored existing CI; temporary helper must be removed before commit.')
