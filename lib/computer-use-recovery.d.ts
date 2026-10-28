/** On-demand maintenance only: never launches a helper or controls the desktop. */
import type { Context } from '@deepseek-ai/cordis';
export declare const PATCHED_HASH = "1071e8cc945eddfc466637cf096852e670d21afa396fe7cca70b107c3de3efc5";
export declare const COMPUTER_USE_GUIDE = "# DSH Windows Computer Use recovery\nUse the installed Computer Use skill and its documented @oai/sky API; this maintenance tool does not replace it.\nCall codex_computer_use_recovery(action=\"status\") to list installed helper paths and patch states. If multiple runtimes exist, use the path belonging to the failing runtime, not the newest directory by guess.\n- FrameArrived timed out on Windows 10: a known native frame callback/bitmap conversion wait can block capture. A longer JavaScript timeout does not fix that native wait. The bundled MTA patch supports only the exact known @oai/sky 0.7.13 binary; an unknown hash is not evidence of the same defect. Check status first.\n- repair: explain that the local binary modification invalidates its original signature; get user agreement, then pass acceptUnsigned=true and the exact target from status. An original backup is retained next to the executable. Never patch unsupported versions or repeatedly retry a failed capture.\n- File in use / sharing violation / access denied: a running screenshot helper may hold the executable, but an ACL denial is not proof of a lock. release stops only processes whose executable path equals the selected helper. This can interrupt another task using that same runtime. Obtain permission to interrupt that component before passing allowStop=true. DSH, Codex, node_repl and parent processes are not stopped. Then retry repair once.\n- After release or repair, reacquire the documented Computer Use connection/window handle and perform one user-authorized screenshot. Do not move the pointer, press keys, or switch windows merely to validate capture. Installation success alone is not a screenshot success.\n- Esc / user stop is intentional cancellation, not a timeout. Stop computer control and wait for explicit renewed permission; never use recovery to bypass it.\n- Missing sky/global/window handle after a reset: initialize @oai/sky again through the documented REPL and enumerate windows again. Do not reuse stale IDs or kill processes for a JavaScript ReferenceError.\n- Transport timeout without FrameArrived: report the exact error and distinguish native capture from connection failure. Do not assume this patch fixes every timeout.\n- rollback restores the verified original backup, but may also require the separately authorized release action.\nAll repair bytes, process recovery code and this guide are bundled in the plugin. No external BAT, Python installation, helper launch, or filesystem-wide search is required.";
export declare function patchHelper(bytes: Buffer): Buffer;
export declare function discoverHelpers(root?: string | undefined): Promise<{
    target: string;
    state: string;
}[]>;
export declare function releaseScript(target: string): string;
export declare function replaceHelper(target: string, action: 'repair' | 'rollback', signal: AbortSignal, replace?: (temp: string, backup: string) => Promise<void>): Promise<{
    changed: boolean;
    backup?: never;
    previous?: never;
    screenshotValidated?: never;
} | {
    changed: boolean;
    backup: string;
    previous: string;
    screenshotValidated: boolean;
}>;
export declare function registerComputerUseRecovery(ctx: Context): void;
