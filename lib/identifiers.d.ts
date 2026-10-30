/** JSON protocol identifiers are opaque strings, not shell fragments. */
export declare function isNonEmptyIdentifier(value: unknown): value is string;
/** App Server namespace whose callbacks are owned by the outer Harness loop. */
export declare const HARNESS_TOOL_NAMESPACE = "deepseek_harness";
