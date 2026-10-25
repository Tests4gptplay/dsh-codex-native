import type { UsageSnapshot } from './usage.ts';
/** A shared public-response cache, evaluated only on a manual query, never by a timer. */
export declare function createTimelineReader(fetcher?: typeof fetch, now?: () => number): () => Promise<unknown>;
/** This function is reached only by the Settings Query button, never by the agent loop. */
export declare function queryUsage(readOfficial: (method: string) => Promise<unknown>, timeline?: () => Promise<unknown>, now?: () => number): Promise<UsageSnapshot>;
