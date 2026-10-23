/** Process exit evidence shared by model and account stdio connections. */
import { LlmError } from '@deepseek-ai/dsh-llm'
import type { SubprocessHandle, SubprocessOutcome } from '@deepseek-ai/dsh-subprocess'
import { JsonRpcConnection } from './wire.ts'

/** Keep diagnostics useful without echoing common credentials into chat errors. */
export function diagnosticText(value: string): string {
  return value.replace(/\x1b\[[0-9;]*[A-Za-z]/gu, '')
    .replace(/Bearer\s+[^\s"'<>]+/giu, 'Bearer [redacted]')
    .replace(/\bsk-[A-Za-z0-9_-]+/gu, '[redacted-key]')
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/gu, '[redacted-token]')
    .replace(/((?:access_token|refresh_token|id_token|api[_-]?key|authorization|password)["']?\s*[:=]\s*["']?)[^\s,"'}&]+/giu, '$1[redacted]')
    .replace(/(https?:\/\/[^\s?#]+)\?[^\s]*/giu, '$1?[redacted-query]')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/giu, '[redacted-email]')
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
