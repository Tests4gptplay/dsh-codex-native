import type { NativeCodexAccount } from './native-account.ts';
import type { HostConnectionHandle } from '@deepseek-ai/dsh-client-connection';
export declare const CODEX_NATIVE_RPC = "/codex-native";
export declare const CODEX_NATIVE_ENDPOINTS: readonly ["status", "quota", "login/start", "login/status", "login/cancel", "logout"];
export type CodexNativeEndpoint = typeof CODEX_NATIVE_ENDPOINTS[number];
/** Bound to the DSH connection service, not a custom HTTP listener. */
export declare function registerNativeCodexTransport(connection: HostConnectionHandle, account: NativeCodexAccount): () => void;
