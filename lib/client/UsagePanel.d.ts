import { type ReactNode } from 'react';
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots';
import type { NativeCodexRpc } from './native-rpc.ts';
import type { UsageSnapshot } from '../usage.ts';
type Translator = TranslateNS<'codex-native'>;
interface ViewProps {
    snapshot: UsageSnapshot | null;
    busy: boolean;
    enabled: boolean;
    error: string;
    open: ReadonlySet<string>;
    onQuery: () => void;
    onClear: () => void;
    onToggle: (id: string) => void;
    t: Translator;
}
/** Pure view, also used by offline rendering tests. Never starts a query. */
export declare function UsageView({ snapshot, busy, enabled, error, open, onQuery, onClear, onToggle, t }: ViewProps): ReactNode;
/** Query and clear are manual actions; expanding, mounting and clearing never call the backend. */
export declare function UsagePanel({ rpc, t, enabled }: {
    rpc: NativeCodexRpc;
    t: Translator;
    enabled: boolean;
}): ReactNode;
export {};
