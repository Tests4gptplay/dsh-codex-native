/** JSON protocol identifiers are opaque strings, not shell fragments. */

export function isNonEmptyIdentifier(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

/** App Server namespace whose callbacks are owned by the outer Harness loop. */
export const HARNESS_TOOL_NAMESPACE = 'deepseek_harness'
