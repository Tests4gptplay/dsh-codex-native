/** Cancel this waiter without cancelling other owners of a shared operation. */
export declare function abortable<T>(task: Promise<T>, signal?: AbortSignal): Promise<T>;
