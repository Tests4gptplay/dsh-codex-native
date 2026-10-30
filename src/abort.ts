/** Cancel this waiter without cancelling other owners of a shared operation. */
export function abortable<T>(task: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (signal === undefined) return task
  return new Promise<T>((resolve, reject) => {
    const abort = (): void => { signal.removeEventListener('abort', abort); reject(signal.reason) }
    if (signal.aborted) reject(signal.reason)
    else signal.addEventListener('abort', abort, { once: true })
    // Always observe the underlying result, including a late rejection after cancellation.
    void task.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort))
  })
}
