import { type ReactNode } from 'react';
import type { NativeCodexRpc } from './native-rpc.ts';
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots';
type Translator = TranslateNS<'codex-native'>;
/** DSH-native account controls plus a manually queried usage view. */
export declare function CodexNativeSection({ rpc, t }: {
    rpc: NativeCodexRpc;
    t: Translator;
}): ReactNode;
export {};
