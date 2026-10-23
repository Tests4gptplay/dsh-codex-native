/** UI boundary only. Keep Codex replay state and DSH tools intact; do not ship protocol diagnostics as chat blocks. */
import type { StreamChunk } from '@deepseek-ai/dsh-llm'

function object(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : undefined
}

/** Render meaningful native actions with standard DSH text, never an unsupported custom block. */
export function actionText(value: unknown): string | undefined {
  const action = object(value)
  if (action?.type !== 'codex-action') return undefined
  const snapshot = object(action.snapshot)
  const name = String(action.actionType ?? '')
  const phase = String(action.phase ?? '')
  if (action.category === 'diagnostic') {
    if (!['error', 'warning', 'configWarning', 'guardianWarning', 'deprecationNotice'].includes(name)) return undefined
    const detail = snapshot?.message ?? object(snapshot?.error)?.message
    return typeof detail === 'string' && detail.trim() ? `Codex: ${detail}\n\n` : undefined
  }
  if (action.category !== 'action') return undefined
  if (!['completed', 'failed', 'declined', 'rejected'].includes(phase)) return undefined
  // Raw items have already been kept by the protocol mapper for replay; avoid duplicate visible actions.
  if (action.protocolEvent === 'rawResponseItem/completed') return undefined
  const labels: Record<string, string> = {
    commandExecution: 'Command', fileChange: 'File changes', webSearch: 'Web search',
    imageGeneration: 'Image generation', mcpToolCall: 'MCP tool', dynamicToolCall: 'Tool',
  }
  const label = labels[name] ?? name
  if (!label) return undefined
  return `Codex · ${label}: ${phase}.\n\n`
}

/** Map wire blocks to the native DSH vocabulary, with consecutive indices and unchanged finish/replay/tool payloads. */
export async function* presentForDsh(source: AsyncIterable<StreamChunk>): AsyncIterable<StreamChunk> {
  const indices = new Map<number, number>()
  const privateBlocks = new Set<number>()
  const shown = new Set<string>()
  let nextIndex = 0
  for await (const chunk of source) {
    if (chunk.type === 'block-start' && chunk.blockType === 'codex-action') {
      privateBlocks.add(chunk.index)
      continue
    }
    if (chunk.type === 'block-end' && chunk.block.type === 'codex-action') {
      privateBlocks.delete(chunk.index)
      const text = actionText(chunk.block)
      const action = chunk.block as unknown as Record<string, unknown>
      const key = `${String(action.actionId)}:${String(action.actionType)}:${String(action.phase)}`
      if (text !== undefined && !shown.has(key)) {
        shown.add(key)
        const index = nextIndex++
        yield { type: 'block-start', index, blockType: 'text' }
        yield { type: 'text-delta', index, text }
        yield { type: 'block-end', index, block: { type: 'text', text } }
      }
      continue
    }
    if ('index' in chunk && typeof chunk.index === 'number') {
      if (privateBlocks.has(chunk.index)) continue
      let index = indices.get(chunk.index)
      if (index === undefined) { index = nextIndex++; indices.set(chunk.index, index) }
      yield { ...chunk, index }
    } else {
      yield chunk
    }
  }
}
