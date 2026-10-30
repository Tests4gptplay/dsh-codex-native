/** Responses API call_id is at most 64 characters, unlike Harness tool IDs. */
import { createHash } from 'node:crypto'
import type { JsonValue } from './runner.ts'

/** Encode a RAW identity once. All IDs share this domain, including short IDs that
 * happen to equal another ID's alias. Do not apply this to an already-wire history. */
export function appServerCallId(id: string): string {
  // Full 256-bit digest, ASCII 47 chars. UTF-16LE preserves even distinct lone
  // surrogates in legacy JS IDs (UTF-8 replacement encoding would conflate them).
  return `dsh_${createHash('sha256').update('dsh-codex-native/call-id/v1\0').update(id, 'utf16le').digest('base64url')}`
}

/** Project RAW protocol identity fields only; never descend into arguments/output/text. */
export function appServerItemCallIds<T extends JsonValue>(item: T): T {
  if (item === null || typeof item !== 'object' || Array.isArray(item)) return item
  let result: Record<string, JsonValue> = item
  if (typeof item.call_id === 'string') {
    const id = appServerCallId(item.call_id)
    if (id !== item.call_id) result = { ...result, call_id: id }
  }
  const caller = item.caller
  if (caller !== null && typeof caller === 'object' && !Array.isArray(caller)
    && typeof caller.caller_id === 'string') {
    const id = appServerCallId(caller.caller_id)
    if (id !== caller.caller_id) result = { ...result, caller: { ...caller, caller_id: id } }
  }
  return result as T
}

/** A live server that itself emits an oversized raw identity needs cold replay. */
export function requiresCallIdReplay(item: JsonValue): boolean {
  if (item === null || typeof item !== 'object' || Array.isArray(item)) return false
  if (typeof item.call_id === 'string' && item.call_id.length > 64) return true
  const caller = item.caller
  return caller !== null && typeof caller === 'object' && !Array.isArray(caller)
    && typeof caller.caller_id === 'string' && caller.caller_id.length > 64
}
