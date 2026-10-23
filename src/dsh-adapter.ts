/** DSH presentation boundary over the Codex wire/replay adapter. */
import type { GenerateOptions, StreamChunk } from '@deepseek-ai/dsh-llm'
import { CodexAppServerAdapter } from './adapter.ts'
import { presentForDsh } from './presentation.ts'

export class DshCodexAdapter extends CodexAppServerAdapter {
  override async* stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    yield* presentForDsh(super.stream(options))
  }
}
