/** Native operation approvals use the Host approval seam, not ordinary questions.
 * This does not assert that the DSH tool execution pipeline or sandbox ran.
 */
import type { Context } from '@deepseek-ai/cordis';
import type { ApprovalOutcome } from '@deepseek-ai/dsh-user-approval';
export type NativeApprovalMethod = 'item/commandExecution/requestApproval' | 'item/fileChange/requestApproval';
type RecordValue = Readonly<Record<string, unknown>>;
type Decision = 'accept' | 'decline' | 'cancel';
export interface NativeApprovalRequest {
    readonly method: NativeApprovalMethod;
    readonly params: RecordValue;
}
export interface NativeApprovalOwner {
    readonly sessionId?: string;
    readonly threadId: string;
    readonly turnId: string;
    readonly signal: AbortSignal;
    /** The matching native action snapshot, if already received. Never a DSH call id. */
    readonly operation?: RecordValue;
}
export interface NativeApprovalResult {
    /** Absent means the caller must respond with a protocol error, never an approval. */
    readonly decision?: Decision;
    readonly resolution: 'answered' | 'declined' | 'rejected';
    readonly outcome: ApprovalOutcome;
    readonly diagnostic?: string;
}
/** Session-owned, cancellation-bound bridge to the composed Host answerer. */
export declare class CodexNativeApprovals {
    private readonly ctx;
    private readonly lifetime;
    private readonly pending;
    constructor(ctx: Context);
    resolve(request: NativeApprovalRequest, owner: NativeApprovalOwner): Promise<NativeApprovalResult>;
    private awaitDecision;
    private disposeSession;
    dispose(): void;
}
export {};
