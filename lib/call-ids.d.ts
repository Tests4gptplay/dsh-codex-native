import type { JsonValue } from './runner.ts';
/** Encode a RAW identity once. All IDs share this domain, including short IDs that
 * happen to equal another ID's alias. Do not apply this to an already-wire history. */
export declare function appServerCallId(id: string): string;
/** Project RAW protocol identity fields only; never descend into arguments/output/text. */
export declare function appServerItemCallIds<T extends JsonValue>(item: T): T;
/** A live server that itself emits an oversized raw identity needs cold replay. */
export declare function requiresCallIdReplay(item: JsonValue): boolean;
