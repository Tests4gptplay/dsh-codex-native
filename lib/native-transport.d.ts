import type { HostConnectionHandle } from '@deepseek-ai/dsh-client-connection';
import type { NativeCodexAccount } from './native-account.ts';
export declare const CODEX_NATIVE_RPC = "/codex-native";
export declare const CODEX_NATIVE_ENDPOINTS: readonly ["status", "quota", "usage", "login/start", "login/status", "login/cancel", "logout"];
export type CodexNativeEndpoint = typeof CODEX_NATIVE_ENDPOINTS[number];
export declare function registerNativeCodexTransport(connection: HostConnectionHandle, account: NativeCodexAccount): () => void;
