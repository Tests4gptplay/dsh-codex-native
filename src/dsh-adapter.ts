/** DSH presentation boundary over the Codex wire/replay adapter. */
import type { GenerateOptions, StreamChunk } from '@deepseek-ai/dsh-llm'
import { CodexAppServerAdapter, type CodexAdapterOptions } from './adapter.ts'
import { presentForDsh } from './presentation.ts'

export class DshCodexAdapter extends CodexAppServerAdapter {
  private readonly shownWarnings = new Map<string, Set<string>>()

  constructor(options: CodexAdapterOptions, private readonly reportDiagnostic: (message: string) => void) {
    super(options)
  }

  override async* stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    const sessionId = options.purpose === 'compaction' || options.sessionId === undefined
      ? undefined : String(options.sessionId)
    let warnings = sessionId === undefined ? undefined : this.shownWarnings.get(sessionId)
    if (warnings === undefined) {
      warnings = new Set<string>()
      if (sessionId !== undefined) this.shownWarnings.set(sessionId, warnings)
    }
    // Reconstruct displayed notices from the supplied history after resume or reload.
    for (const message of options.messages) {
      const source = message.source
      if (source?.kind !== 'model' || source.provider !== options.provider) continue
      for (const block of message.content) {
        if (block.type !== 'text') continue
        for (const notice of block.text.matchAll(/^Codex: [\s\S]*?\n\n/gm)) warnings.add(notice[0])
      }
    }
    yield* presentForDsh(super.stream(options), this.reportDiagnostic, warnings)
  }

  override disposeSession(sessionId: string): Promise<void> {
    this.shownWarnings.delete(sessionId)
    return super.disposeSession(sessionId)
  }

  override dispose(): Promise<void> {
    this.shownWarnings.clear()
    return super.dispose()
  }
}
