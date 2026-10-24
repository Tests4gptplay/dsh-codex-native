// TEST ONLY: no network, credentials, external commands, or production selector.
import { createInterface } from 'node:readline'
const scenario = process.argv[2]
const send = value => process.stdout.write(JSON.stringify(value) + '\n')
createInterface({ input: process.stdin }).on('line', line => {
  const r = JSON.parse(line)
  process.stderr.write(`AUDIT_RECEIVED:${r.method}\n`)
  if (r.id === undefined) return
  if (r.method === 'initialize') {
    if (scenario === 'silent-initialize') return
    send({ id: r.id, result: { userAgent: 'isolated-audit' } })
  } else if (r.method === 'account/read' || r.method === 'account/rateLimits/read' || r.method === 'account/usage/read') {
    if (scenario === 'silent-query') return
    send({ id: r.id, result: { account: null } })
  } else if (r.method === 'account/login/start') {
    send({ id: r.id, result: { loginId: `audit-${process.pid}`, authUrl: 'https://example.invalid/unused', verificationUrl: 'https://example.invalid/unused', userCode: 'NOT-A-CODE' } })
  } else if (r.method === 'account/login/cancel') {
    if (scenario === 'silent-cancel') return
    send({ id: r.id, result: {} })
  } else if (r.method === 'thread/start') {
    send({ id: r.id, result: { thread: { id: 'audit-thread' }, instructionSources: [] } })
  } else if (r.method === 'turn/start') {
    send({ id: r.id, result: { turn: { id: 'audit-turn' } } })
    setTimeout(() => send({ method: 'turn/completed', params: { threadId: 'audit-thread', turn: { id: 'audit-turn', status: 'completed', error: null } } }), 180)
  } else send({ id: r.id, result: {} })
}).on('close', () => process.exit(0))
