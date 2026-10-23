// Development-only adversarial protocol fixture. Never imported by plugin runtime.
import { createInterface } from 'node:readline'
import { appendFileSync } from 'node:fs'
const mode = process.env.TEST_ACCOUNT_MODE
const marker = process.env.TEST_ACCOUNT_MARKER
const write = (value) => process.stdout.write(JSON.stringify(value) + '\n')
const loginId = `fixture-${process.pid}`
createInterface({ input: process.stdin }).on('line', line => {
  const request = JSON.parse(line)
  appendFileSync(marker, `${request.method}\n`)
  if (request.method === 'initialize') {
    if (mode !== 'stall-initialize') write({ id: request.id, result: {} })
  } else if (request.method === 'account/login/start') {
    write({ id: request.id, result: { loginId, authUrl: 'https://example.invalid/fixture', verificationUrl: 'https://example.invalid/device', userCode: 'TEST-ONLY' } })
  } else if (request.method === 'account/login/cancel') {
    if (mode !== 'stall-cancel') write({ id: request.id, result: {} })
  } else if (request.method === 'account/read' && mode === 'delayed-success') {
    setTimeout(() => write({ id: request.id, result: { account: { type: 'chatgpt', email: 'test@example.invalid', planType: 'pro' } } }), 100)
  }
})
// Keep the test child alive when it deliberately ignores a request.
setInterval(() => {}, 1000)
