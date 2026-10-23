import { type ReactNode } from 'react';
import type { NativeCodexRpc } from './native-rpc.ts';
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots';
type Translator = TranslateNS<'codex-native'>;
/** Primary DSH settings surface for native Codex OAuth and account usage. */
export declare function CodexNativeSection({ rpc, t }: {
    rpc: NativeCodexRpc;
    t: Translator;
}): ReactNode;
export {};
