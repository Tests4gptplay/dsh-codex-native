import type { SubprocessHandle } from '@deepseek-ai/dsh-subprocess';
import { JsonRpcConnection } from './wire.ts';
/** Keep diagnostics useful without echoing common credentials into chat errors. */
export declare function diagnosticText(value: string): string;
/** No new process or polling: observe the handle the DSH host already owns. */
export declare function connectCodexProcess(child: SubprocessHandle, maxLineBytes: number): {
    rpc: JsonRpcConnection;
    markCleanup(): void;
    /** Called AFTER cleanup so stdout EOF cannot hide the later exit evidence. */
    failure(value: unknown): Error;
};
