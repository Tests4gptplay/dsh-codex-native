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

