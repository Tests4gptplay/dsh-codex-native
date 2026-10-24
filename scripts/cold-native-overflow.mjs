import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { createRequire } from 'node:module'
import { createInterface } from 'node:readline'

// Run from the plugin repository with its pinned @openai/codex dependency.
const fixturePackageRoot = process.env.DSH_CODEX_FIXTURE_ROOT ?? process.cwd()
const require = createRequire(join(fixturePackageRoot, 'package.json'))
const entry = join(dirname(require.resolve('@openai/codex/package.json')), 'bin/codex.js')
const destination = new URL('../cold-native-overflow-results.json', import.meta.url)
const MODEL = 'gpt-5.6-sol'
const CONTEXT_WINDOW = 8_192
const AUTO_COMPACT_LIMIT = 6_000
const history = [
  { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'ARTIFICIAL_OLD_HISTORY '.repeat(8_000) }] },
  { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'ARTIFICIAL_PREVIOUS_ASSISTANT' }] },
  { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'continue' }] },
]
const disabled = ['apps', 'browser_use', 'browser_use_external', 'browser_use_full_cdp_access', 'code_mode', 'code_mode_buffered_exec', 'code_mode_host', 'code_mode_only', 'computer_use', 'hooks', 'image_generation', 'in_app_browser', 'mcp_2026_07_28', 'multi_agent', 'multi_agent_v2', 'plugins', 'remote_plugin', 'request_permissions_tool', 'shell_tool', 'skill_search', 'standalone_web_search', 'tool_call_mcp_elicitation', 'unified_exec', 'view_image', 'web_search_cached', 'web_search_request']

function timeout(promise, label, ms = 25_000) {
  let timer
  return Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${label} timed out`)), ms) })]).finally(() => clearTimeout(timer))
}

function itemSummary(item) {
  return { type: item?.type, role: item?.role, id: item?.id,
    textChars: Array.isArray(item?.content) ? item.content.reduce((n, part) => n + (part.text?.length ?? 0), 0) : undefined }
}

function eventSummary(message) {
  const p = message.params ?? {}
  return { method: message.method, turnId: p.turnId ?? p.turn?.id,
    ...(p.item === undefined ? {} : { item: itemSummary(p.item) }),
    ...(p.turn === undefined ? {} : { turn: p.turn }),
    ...(p.tokenUsage === undefined ? {} : { tokenUsage: p.tokenUsage }),
    ...(p.error === undefined ? {} : { error: p.error }),
    ...(message.method === 'error' ? { params: p } : {}),
  }
}

class Rpc {
  pending = new Map()
  nextId = 1
  messages = []
  stderr = ''
  waiters = []
  constructor(child, trace) {
    this.child = child
    this.trace = trace
    createInterface({ input: child.stdout }).on('line', line => {
      let message
      try { message = JSON.parse(line) } catch { return }
      if (message.id !== undefined && this.pending.has(message.id)) {
        const pending = this.pending.get(message.id)
        this.pending.delete(message.id)
        message.error === undefined ? pending.resolve(message.result) : pending.reject(new Error(JSON.stringify(message.error)))
        return
      }
      this.messages.push(message)
      trace.push({ kind: 'notification', ...eventSummary(message) })
      for (const notify of this.waiters) notify()
      if (message.id !== undefined && message.method !== undefined) {
        this.child.stdin.write(JSON.stringify({ id: message.id, error: { code: -32001, message: 'isolated fixture declines server request' } }) + '\n')
      }
    })
    child.stderr.setEncoding('utf8')
    child.stderr.on('data', chunk => { this.stderr += chunk })
    child.once('exit', (code, signal) => {
      for (const pending of this.pending.values()) pending.reject(new Error(`app-server exited ${code}/${signal}: ${this.stderr.slice(-3000)}`))
      this.pending.clear()
    })
  }
  async request(method, params) {
    const id = this.nextId++
    const pending = Promise.withResolvers()
    this.pending.set(id, pending)
    this.trace.push({ kind: 'request', method })
    this.child.stdin.write(JSON.stringify({ id, method, params }) + '\n')
    return timeout(pending.promise, method)
  }
  notify(method, params) { this.child.stdin.write(JSON.stringify({ method, params }) + '\n') }
  async completed(turnId) {
    const waiting = Promise.withResolvers()
    const check = () => {
      const message = this.messages.find(message => message.method === 'turn/completed' && message.params?.turn?.id === turnId)
      if (message) waiting.resolve(message.params.turn)
    }
    this.waiters.push(check)
    check()
    return timeout(waiting.promise, 'turn/completed').finally(() => { this.waiters = this.waiters.filter(item => item !== check) })
  }
}

function sendStream(response, item, id) {
  response.writeHead(200, { 'content-type': 'text/event-stream' })
  const events = [
    { type: 'response.created', response: { id, status: 'in_progress' } },
    { type: 'response.output_item.done', output_index: 0, item },
    { type: 'response.completed', response: { id, status: 'completed', output: [item], usage: {
      input_tokens: 200, output_tokens: 30, total_tokens: 230,
      input_tokens_details: { cached_tokens: 0 }, output_tokens_details: { reasoning_tokens: 0 },
    } } },
  ]
  for (const event of events) response.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`)
  response.end()
}

async function stop(child) {
  if (child.exitCode !== null || child.signalCode !== null) return
  const ended = new Promise(resolve => child.once('exit', resolve))
  child.stdin.end()
  child.kill('SIGTERM')
  const timer = setTimeout(() => child.kill('SIGKILL'), 2_000)
  await timeout(ended, 'stop', 5_000)
  clearTimeout(timer)
}

const isolatedRoot = await mkdtemp(join(tmpdir(), 'dsh-cold-overflow-'))
const isolatedCodexHome = join(isolatedRoot, 'codex-config')
const workspace = join(isolatedRoot, 'workspace')
await mkdir(isolatedCodexHome)
await mkdir(workspace)
let currentRun
const report = { binary: 'official @openai/codex 0.154.0', contextWindow: CONTEXT_WINDOW, autoCompactLimit: AUTO_COMPACT_LIMIT,
  history: history.map(itemSummary), artificialOnly: true, runs: [] }
const server = createServer((request, response) => {
  const buffers = []
  request.on('data', buffer => buffers.push(buffer))
  request.on('end', () => {
    const text = Buffer.concat(buffers).toString('utf8')
    let body
    try { body = text === '' ? {} : JSON.parse(text) } catch { body = {} }
    const remoteCompact = request.url?.includes('/responses/compact') === true
    const v2Compact = JSON.stringify(body.input ?? []).includes('"type":"compaction_trigger"')
    const compact = remoteCompact || v2Compact
    const record = { kind: 'http', method: request.method, path: request.url, compact,
      bodyBytes: Buffer.byteLength(text), input: Array.isArray(body.input) ? body.input.map(itemSummary) : body.input,
      bodyKeys: Object.keys(body) }
    currentRun?.trace.push(record)
    currentRun?.http.push(record)
    if (compact) {
      currentRun.compactions++
      const item = { type: 'compaction', encrypted_content: 'ARTIFICIAL_LOCAL_COMPACT_CHECKPOINT' }
      if (remoteCompact) {
        response.writeHead(200, { 'content-type': 'application/json' })
        response.end(JSON.stringify({ output: [item] }))
      } else sendStream(response, item, `compaction-${currentRun.index}`)
    } else if (request.url?.includes('/responses')) {
      if (currentRun?.compactions > 0) {
        sendStream(response, { type: 'message', id: 'fixture-answer', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: 'ARTIFICIAL_DONE' }] }, `answer-${currentRun.index}`)
      } else {
        response.writeHead(200, { 'content-type': 'text/event-stream' })
        const event = { type: 'response.failed', sequence_number: 1, response: {
          id: `overflow-${currentRun.index}`, object: 'response', status: 'failed',
          error: { message: 'ARTIFICIAL context length exceeded', code: 'context_length_exceeded' },
          usage: null,
        } }
        response.end(`event: response.failed\ndata: ${JSON.stringify(event)}\n\n`)
      }
    } else {
      response.writeHead(404, { 'content-type': 'application/json' })
      response.end('{"error":{"message":"fixture endpoint not found"}}')
    }
  })
})

try {
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve) })
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('missing local port')
  await writeFile(join(isolatedCodexHome, 'config.toml'), [
    `model = "${MODEL}"`, 'model_provider = "cold-fixture"',
    `model_context_window = ${CONTEXT_WINDOW}`, `model_auto_compact_token_limit = ${AUTO_COMPACT_LIMIT}`,
    'check_for_update_on_startup = false', 'web_search = "disabled"',
    '[analytics]', 'enabled = false',
    '[model_providers.cold-fixture]', 'name = "OpenAI"',
    `base_url = "http://127.0.0.1:${address.port}/v1"`, 'wire_api = "responses"',
    'requires_openai_auth = false', 'supports_websockets = false',
    'request_max_retries = 0', 'stream_max_retries = 0', 'stream_idle_timeout_ms = 10000', '',
  ].join('\n'))
  for (let index = 1; index <= 2; index++) {
    currentRun = { index, http: [], trace: [], compactions: 0 }
    report.runs.push(currentRun)
    const child = spawn(process.execPath, [entry, 'app-server', '--stdio', '--strict-config', ...disabled.flatMap(name => ['--disable', name])], {
      cwd: workspace,
      env: { PATH: process.env.PATH, LANG: 'C.UTF-8', CODEX_HOME: isolatedCodexHome,
        CODEX_INTERNAL_ORIGINATOR_OVERRIDE: 'deepseek-harness-cold-fixture', NO_PROXY: '127.0.0.1,localhost' },
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    const rpc = new Rpc(child, currentRun.trace)
    try {
      await rpc.request('initialize', { clientInfo: { name: 'deepseek-harness-cold-fixture', version: '0.1.0' }, capabilities: { experimentalApi: true } })
      rpc.notify('initialized', {})
      const started = await rpc.request('thread/start', { model: MODEL, modelProvider: 'cold-fixture', cwd: workspace,
        approvalPolicy: 'never', sandbox: 'read-only', baseInstructions: 'Respond to the latest request.', developerInstructions: '',
        personality: 'none', environments: [], runtimeWorkspaceRoots: [], selectedCapabilityRoots: [], dynamicTools: [],
        ephemeral: true, historyMode: 'legacy', experimentalRawEvents: true })
      currentRun.threadId = started.thread.id
      await rpc.request('thread/inject_items', { threadId: started.thread.id, items: history })
      const turn = await rpc.request('turn/start', { threadId: started.thread.id, input: [] })
      currentRun.terminal = await rpc.completed(turn.turn.id)
    } catch (error) {
      currentRun.fixtureError = String(error)
    } finally {
      await stop(child)
      currentRun.stderr = rpc.stderr.slice(-5000).replaceAll(isolatedRoot, '<isolated-fixture>')
    }
    console.log(JSON.stringify({ run: index, http: currentRun.http.map(item => ({ path: item.path, compact: item.compact, bodyBytes: item.bodyBytes })), terminal: currentRun.terminal, fixtureError: currentRun.fixtureError }))
  }
} catch (error) {
  report.fixtureError = String(error)
} finally {
  server.closeAllConnections()
  await new Promise(resolve => server.close(resolve))
  await rm(isolatedRoot, { recursive: true, force: true })
  await writeFile(destination, JSON.stringify(report, null, 2) + '\n')
  console.log(`Report: ${destination.pathname}`)
}
if (report.fixtureError || report.runs.some(run => run.fixtureError)) process.exitCode = 1
