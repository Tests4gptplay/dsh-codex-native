/** Codex questions presented by DSH's native, Agent-scoped question UI. */
import type { Context } from '@deepseek-ai/cordis'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import { SessionId } from '@deepseek-ai/dsh-session'
import type { AskUserQuestionItem } from '@deepseek-ai/dsh-user-questions'
import { object } from './wire.ts'
import type { JsonObject } from './wire.ts'

/** Native blocking RPCs and nonblocking agent-message questions share one UI. */
export interface CodexQuestionHandler {
  ask(params: JsonObject, sessionId: string | undefined, signal: AbortSignal): Promise<JsonObject | null>
  notify(item: JsonObject, sessionId: string | undefined, signal?: AbortSignal): void
}

function text(value: unknown, label: string): string {
  if (typeof value !== 'string') throw new Error(`Codex question has invalid ${label}`)
  return value
}

function entries(value: unknown): unknown[] {
  if (!Array.isArray(value) || value.length === 0) throw new Error('Codex question list is empty')
  return value
}

export function codexQuestions(params: JsonObject): AskUserQuestionItem[] {
  return entries(params.questions).map(value => {
    const question = object(value, 'question')
    return {
      id: text(question.id, 'id'),
      question: text(question.question, 'question'),
      ...(typeof question.header === 'string' ? { header: question.header } : {}),
      ...(question.options == null || Array.isArray(question.options) && question.options.length === 0 ? {} : {
        options: entries(question.options).map(value => {
          const option = object(value, 'question option')
          return {
            label: text(option.label, 'option label'),
            ...(typeof option.description === 'string' ? { description: option.description } : {}),
          }
        }),
      }),
    }
  })
}

export function codexAsyncQuestions(item: JsonObject): AskUserQuestionItem[] {
  return entries(item.questions).map((value, index) => {
    const question = object(value, 'async question')
    return {
      id: String(index),
      question: text(question.title, 'title'),
      ...(question.options == null || Array.isArray(question.options) && question.options.length === 0 ? {} : {
        options: entries(question.options).map(label => ({ label: text(label, 'option label') })),
      }),
    }
  })
}

function isCancelled(error: unknown): boolean {
  return error !== null && typeof error === 'object'
    && 'code' in error && error.code === 'ASK_CANCELLED'
}

interface QuestionSession {
  readonly seen: Set<string>
  readonly pending: Map<string, AbortController>
}

/** Own only pending question lifetimes; DSH owns presentation and notifications. */
export class CodexUserQuestions implements CodexQuestionHandler {
  private readonly lifetime = new AbortController()
  private readonly sessions = new Map<string, QuestionSession>()

  constructor(private readonly ctx: Context) {
    ctx.on('session/disposed', session => this.disposeSession(String(session.id)))
    ctx.effect(() => () => this.dispose(), 'dsh-codex-native: close user questions')
  }

  private owner(sessionId: string | undefined) {
    const agent = sessionId === undefined ? undefined : this.ctx.get('agents')?.get(SessionId(sessionId))
    if (agent === undefined) throw new Error('Codex question requires its live DSH session')
    return agent
  }

  private service() {
    const service = this.ctx.get('userQuestions')
    if (service === undefined) throw new Error('DSH userQuestions service is unavailable')
    return service
  }

  async ask(params: JsonObject, sessionId: string | undefined, signal: AbortSignal): Promise<JsonObject | null> {
    const combined = AbortSignal.any([signal, this.lifetime.signal])
    try {
      const result = await this.service().ask({
        agent: this.owner(sessionId),
        questions: codexQuestions(params),
        signal: combined,
      })
      combined.throwIfAborted()
      return {
        answers: Object.fromEntries(result.answers.map(answer => [
          answer.id,
          { answers: answer.custom?.trim() ? [answer.custom] : answer.selected },
        ])),
      }
    } catch (error) {
      if (!combined.aborted && isCancelled(error)) return null
      throw error
    }
  }

  notify(item: JsonObject, sessionId: string | undefined, signal?: AbortSignal): void {
    if (sessionId === undefined) return
    const id = text(item.id, 'async item id')
    const session = this.sessions.get(sessionId) ?? { seen: new Set<string>(), pending: new Map() }
    this.sessions.set(sessionId, session)
    if (session.seen.has(id)) return
    session.seen.add(id)
    const controller = new AbortController()
    session.pending.set(id, controller)
    const combined = AbortSignal.any([
      controller.signal, this.lifetime.signal, ...(signal === undefined ? [] : [signal]),
    ])
    // Async Codex questions are notifications, not JSON-RPC calls. Keep streaming,
    // then admit the human's answer through the normal DSH user-message inbox.
    void this.answerAsync(item, sessionId, combined).catch(error => {
      if (!combined.aborted && !isCancelled(error)) {
        this.ctx.logger.warn(`Codex user question: ${String(error)}`)
      }
    }).finally(() => {
      session.pending.delete(id)
    })
  }

  private async answerAsync(item: JsonObject, sessionId: string, signal: AbortSignal): Promise<void> {
    const agent = this.owner(sessionId)
    const questions = codexAsyncQuestions(item)
    const answer = await this.service().ask({ agent, questions, signal })
    signal.throwIfAborted()
    const replies = questions.flatMap(question => {
      const response = answer.answers.find(value => value.id === question.id)
      const custom = response?.custom
      const values = [...response?.selected ?? [], ...(custom?.trim() ? [custom] : [])]
      return values.length === 0 ? [] : [`${question.question}\n${values.join('\n')}`]
    })
    if (replies.length === 0) return
    // The submitted human answer is the same native user message shown in Chat
    // and admitted to the active task, including its pending-steering echo.
    agent.steer(createUserMessage({
      source: { kind: 'user' },
      content: [{ type: 'text', text: replies.join('\n\n') }],
    }))
  }

  private disposeSession(sessionId: string): void {
    const session = this.sessions.get(sessionId)
    if (session === undefined) return
    for (const pending of session.pending.values()) pending.abort()
    this.sessions.delete(sessionId)
  }

  dispose(): void {
    this.lifetime.abort()
    for (const sessionId of this.sessions.keys()) this.disposeSession(sessionId)
  }
}
