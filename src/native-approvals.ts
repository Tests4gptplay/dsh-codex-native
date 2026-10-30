/** Native operation approvals use the Host approval seam, not ordinary questions.
 * This does not assert that the DSH tool execution pipeline or sandbox ran.
 */
import type { Context } from '@deepseek-ai/cordis'
import type { SessionId, SessionSeq } from '@deepseek-ai/dsh-session'
import type { ApprovalOutcome, ApprovalRequest } from '@deepseek-ai/dsh-user-approval'
import type {} from '@deepseek-ai/dsh-user-approval'

export type NativeApprovalMethod = 'item/commandExecution/requestApproval' | 'item/fileChange/requestApproval'
type Agent = ApprovalRequest['agent']
type RecordValue = Readonly<Record<string, unknown>>
type Decision = 'accept' | 'decline' | 'cancel'

export interface NativeApprovalRequest {
  readonly method: NativeApprovalMethod
  readonly params: RecordValue
}
export interface NativeApprovalOwner {
  readonly sessionId?: string
  readonly threadId: string
  readonly turnId: string
  readonly signal: AbortSignal
  /** The matching native action snapshot, if already received. Never a DSH call id. */
  readonly operation?: RecordValue
}
export interface NativeApprovalResult {
  /** Absent means the caller must respond with a protocol error, never an approval. */
  readonly decision?: Decision
  readonly resolution: 'answered' | 'declined' | 'rejected'
  readonly outcome: ApprovalOutcome
  readonly diagnostic?: string
}

function permits(params: RecordValue, decision: Decision): boolean {
  return params.availableDecisions === undefined || params.availableDecisions === null
    || Array.isArray(params.availableDecisions) && params.availableDecisions.includes(decision)
}
function noGrant(params: RecordValue, outcome: Exclude<ApprovalOutcome, 'allowed-once'>, diagnostic: string): NativeApprovalResult {
  if (outcome === 'unavailable') return { resolution: 'rejected', outcome, diagnostic }
  const preferred: Decision[] = outcome === 'cancelled' ? ['cancel', 'decline'] : ['decline', 'cancel']
  const decision = preferred.find(value => permits(params, value))
  return {
    ...(decision === undefined ? {} : { decision }),
    resolution: 'declined', outcome, diagnostic,
  }
}
/** An approval cannot describe an operation using only its optional reason.
 * File details are supplied by the preceding native action item; command
 * approvals can instead describe a managed network destination without a shell
 * command. Missing details are an integration gap, not a user/policy rejection. */
function hasOperationDetails(request: NativeApprovalRequest, owner: NativeApprovalOwner): boolean {
  const values = [request.params, ...(owner.operation === undefined ? [] : [owner.operation])]
  if (request.method === 'item/fileChange/requestApproval') {
    return values.some(value => Array.isArray(value.changes) && value.changes.length > 0)
  }
  return values.some(value => {
    if (typeof value.command === 'string' && value.command.trim().length > 0) return true
    const network = value.networkApprovalContext
    return network !== null && typeof network === 'object' && !Array.isArray(network)
      && typeof (network as RecordValue).host === 'string' && (network as RecordValue).host !== ''
      && typeof (network as RecordValue).protocol === 'string' && (network as RecordValue).protocol !== ''
  })
}

function operationReason(request: NativeApprovalRequest, owner: NativeApprovalOwner): string {
  // Keep the exact requested operation visible. Do not reduce this to an optional
  // natural-language reason or invent a Harness ToolCallId for a native item.
  return `Codex requests one-time approval for a native ${request.method === 'item/commandExecution/requestApproval' ? 'command' : 'file change'}. This is not a session or permanent grant.\n`
    + JSON.stringify({ request: request.params, ...(owner.operation === undefined ? {} : { operation: owner.operation }) }, null, 2)
}

/** Same public log fold used by Host ApprovalService, retaining the opening
 * sequence as the identity instead of merely checking that some turn is open. */
function openTurn(agent: Agent): number | undefined {
  for (let seq = agent.session.seq - 1; seq >= 0; seq -= 1) {
    const type = agent.session.eventAt(seq as SessionSeq)?.type
    if (type === 'turn/start') return seq
    if (type === 'turn/end') return undefined
  }
  return undefined
}

/** Session-owned, cancellation-bound bridge to the composed Host answerer. */
export class CodexNativeApprovals {
  private readonly lifetime = new AbortController()
  private readonly pending = new Map<string, Set<AbortController>>()

  constructor(private readonly ctx: Context) {
    ctx.on('session/disposed', session => this.disposeSession(String(session.id)))
    ctx.effect(() => () => this.dispose(), 'dsh-codex-native: close native approvals')
  }

  async resolve(request: NativeApprovalRequest, owner: NativeApprovalOwner): Promise<NativeApprovalResult> {
    const { params } = request
    if (request.method !== 'item/commandExecution/requestApproval' && request.method !== 'item/fileChange/requestApproval') {
      return noGrant(params, 'unavailable', 'This native approval method has no Host bridge contract.')
    }
    if (params.threadId !== owner.threadId || params.turnId !== owner.turnId
      || typeof params.itemId !== 'string' || params.itemId.length === 0
      || owner.operation !== undefined && (owner.operation.id !== params.itemId
        || owner.operation.type !== (request.method === 'item/commandExecution/requestApproval' ? 'commandExecution' : 'fileChange'))) {
      return noGrant(params, 'unavailable', 'Native approval does not match the active thread, turn, and item.')
    }
    if (!hasOperationDetails(request, owner)) {
      return noGrant(params, 'unavailable', 'Native operation details are unavailable for approval presentation; no permission was granted. This was not a user rejection.')
    }
    if (owner.sessionId === undefined) return noGrant(params, 'unavailable', 'Native approval requires its live DSH session.')
    const sessionId = owner.sessionId
    const agent: Agent | undefined = this.ctx.get('agents')?.get(sessionId as SessionId)
    const approval = this.ctx.get('approval')
    if (agent === undefined || String(agent.session.id) !== sessionId) {
      return noGrant(params, 'unavailable', 'Native approval has no matching live DSH Agent.')
    }
    const hostTurn = openTurn(agent)
    if (hostTurn === undefined) return noGrant(params, 'unavailable', 'Native approval requires an open DSH turn.')
    if (approval === undefined) return noGrant(params, 'unavailable', 'DSH approval service is unavailable; this was not a user rejection.')
    if (!permits(params, 'accept')) {
      return noGrant(params, 'unavailable', 'Native request does not offer a one-time accept decision; broader grants are not supported by the Host approval seam.')
    }
    const controller = new AbortController()
    const requests = this.pending.get(sessionId) ?? new Set<AbortController>()
    requests.add(controller)
    this.pending.set(sessionId, requests)
    const signal = AbortSignal.any([owner.signal, controller.signal, this.lifetime.signal])
    try {
      if (signal.aborted) return noGrant(params, 'cancelled', 'Native approval was cancelled before a decision.')
      const requestTask: Promise<ApprovalOutcome> = Promise.resolve().then(() => {
        if (signal.aborted || this.ctx.get('agents')?.get(sessionId as SessionId) !== agent || openTurn(agent) !== hostTurn) return 'cancelled'
        return approval.request({
          agent,
          toolName: request.method === 'item/commandExecution/requestApproval' ? 'codex-native.commandExecution' : 'codex-native.fileChange',
          reason: operationReason(request, owner), signal,
        })
      })
      // Host implementations are expected to observe signal. Still do not let a
      // late/non-cooperative answerer keep this adapter alive or issue a grant.
      const outcome = await this.awaitDecision(requestTask, signal)
      if (signal.aborted || this.ctx.get('agents')?.get(sessionId as SessionId) !== agent || openTurn(agent) !== hostTurn) {
        return noGrant(params, 'cancelled', 'Native approval was cancelled or its owning Agent/DSH turn changed.')
      }
      if (outcome === 'allowed-once') return { decision: 'accept', resolution: 'answered', outcome }
      if (outcome === 'rejected') return noGrant(params, outcome, 'DSH approval policy or its answerer rejected this native operation.')
      if (outcome === 'cancelled') return noGrant(params, outcome, 'DSH cancelled this native approval.')
      return noGrant(params, 'unavailable', 'DSH approval answerer is unavailable; this was not a user rejection.')
    } catch {
      return signal.aborted
        ? noGrant(params, 'cancelled', 'Native approval was cancelled.')
        : noGrant(params, 'unavailable', 'DSH approval could not commit a decision; no native permission was granted.')
    } finally {
      requests.delete(controller)
      if (requests.size === 0 && this.pending.get(sessionId) === requests) this.pending.delete(sessionId)
    }
  }

  private awaitDecision(task: Promise<ApprovalOutcome>, signal: AbortSignal): Promise<ApprovalOutcome> {
    return new Promise((resolve, reject) => {
      const abort = (): void => { signal.removeEventListener('abort', abort); resolve('cancelled') }
      signal.addEventListener('abort', abort, { once: true })
      task.then(value => { signal.removeEventListener('abort', abort); resolve(value) }, error => {
        signal.removeEventListener('abort', abort); reject(error)
      })
      if (signal.aborted) abort()
    })
  }

  private disposeSession(sessionId: string): void {
    for (const controller of this.pending.get(sessionId) ?? []) controller.abort()
    this.pending.delete(sessionId)
  }
  dispose(): void {
    this.lifetime.abort()
    for (const sessionId of this.pending.keys()) this.disposeSession(sessionId)
  }
}
