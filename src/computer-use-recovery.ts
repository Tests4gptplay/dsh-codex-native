/** On-demand maintenance only: never launches a helper or controls the desktop. */
import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { createHash, randomUUID } from 'node:crypto'
import { readFile, readdir, realpath, writeFile, unlink } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { release } from 'node:os'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { profile } from './computer-use-profile.ts'

const exec = promisify(execFile)
export const PATCHED_HASH = '1071e8cc945eddfc466637cf096852e670d21afa396fe7cca70b107c3de3efc5'
const hash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex')
export const COMPUTER_USE_GUIDE = `# DSH Windows Computer Use recovery
Use the installed Computer Use skill and its documented @oai/sky API; this maintenance tool does not replace it.
Call codex_computer_use_recovery(action="status") to list installed helper paths and patch states. If multiple runtimes exist, use the path belonging to the failing runtime, not the newest directory by guess.
- FrameArrived timed out on Windows 10: a known native frame callback/bitmap conversion wait can block capture. A longer JavaScript timeout does not fix that native wait. The bundled MTA patch supports only the exact known @oai/sky 0.7.13 binary; an unknown hash is not evidence of the same defect. Check status first.
- repair: explain that the local binary modification invalidates its original signature; get user agreement, then pass acceptUnsigned=true and the exact target from status. An original backup is retained next to the executable. Never patch unsupported versions or repeatedly retry a failed capture.
- File in use / sharing violation / access denied: a running screenshot helper may hold the executable, but an ACL denial is not proof of a lock. release stops only processes whose executable path equals the selected helper. This can interrupt another task using that same runtime. Obtain permission to interrupt that component before passing allowStop=true. DSH, Codex, node_repl and parent processes are not stopped. Then retry repair once.
- After release or repair, reacquire the documented Computer Use connection/window handle and perform one user-authorized screenshot. Do not move the pointer, press keys, or switch windows merely to validate capture. Installation success alone is not a screenshot success.
- Esc / user stop is intentional cancellation, not a timeout. Stop computer control and wait for explicit renewed permission; never use recovery to bypass it.
- Missing sky/global/window handle after a reset: initialize @oai/sky again through the documented REPL and enumerate windows again. Do not reuse stale IDs or kill processes for a JavaScript ReferenceError.
- Transport timeout without FrameArrived: report the exact error and distinguish native capture from connection failure. Do not assume this patch fixes every timeout.
- rollback restores the verified original backup, but may also require the separately authorized release action.
All repair bytes, process recovery code and this guide are bundled in the plugin. No external BAT, Python installation, helper launch, or filesystem-wide search is required.`

export function patchHelper(bytes: Buffer): Buffer {
  if (hash(bytes) !== profile.originalSha256) throw new Error('Unsupported helper binary; no changes made')
  const output = Buffer.from(bytes)
  for (const region of profile.regions) {
    const before = Buffer.from(region.original, 'hex')
    const after = Buffer.from(region.patched, 'hex')
    if (before.length !== after.length || !bytes.subarray(region.offset, region.offset + before.length).equals(before)) {
      throw new Error('Patch region mismatch: ' + region.name)
    }
    after.copy(output, region.offset)
  }
  if (hash(output) !== PATCHED_HASH) throw new Error('Invalid bundled patch')
  return output
}

export async function discoverHelpers(root = process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, 'OpenAI', 'Codex', 'runtimes', 'cua_node')) {
  if (!root) return []
  let entries
  try { entries = await readdir(root, { withFileTypes: true }) }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error }
  const found: Array<{ target: string; state: string }> = []
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const target = join(root, entry.name, 'bin', 'node_modules', '@oai', 'sky', 'bin', 'windows', 'codex-computer-use.exe')
    try {
      const digest = hash(await readFile(target))
      found.push({ target: await realpath(target), state: digest === PATCHED_HASH ? 'patched' : digest === profile.originalSha256 ? 'original' : 'unsupported' })
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error }
  }
  return found
}

const quote = (value: string) => "'" + value.replaceAll("'", "''") + "'"
export function releaseScript(target: string): string {
  return `$ErrorActionPreference='Stop'; $target=${quote(target)}
$stopped=@()
Get-CimInstance Win32_Process -Filter "Name='codex-computer-use.exe'" | Where-Object { $_.ExecutablePath -eq $target } | ForEach-Object {
  $before=$_
  $current=Get-CimInstance Win32_Process -Filter ("ProcessId=" + $before.ProcessId)
  if ($current -and $current.ExecutablePath -eq $target -and $current.CreationDate -eq $before.CreationDate) {
    Stop-Process -Id $current.ProcessId -Force -ErrorAction Stop
    $stopped += $current.ProcessId
  }
}
ConvertTo-Json -Compress -InputObject @($stopped)`
}
async function powershell(script: string, signal: AbortSignal) {
  const { stdout } = await exec('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand',
    Buffer.from(script, 'utf16le').toString('base64')], { windowsHide: true, timeout: 15_000, signal, maxBuffer: 64 * 1024 })
  return stdout.trim()
}

export async function replaceHelper(target: string, action: 'repair' | 'rollback', signal: AbortSignal,
  replace = async (temp: string, backup: string) => {
    await powershell(`$ErrorActionPreference='Stop'; [IO.File]::Replace(${quote(temp)},${quote(target)},${quote(backup)},$false)`, signal)
  }) {
  const original = await readFile(target)
  const current = hash(original)
  const expected = action === 'repair' ? profile.originalSha256 : PATCHED_HASH
  if (current === (action === 'repair' ? PATCHED_HASH : profile.originalSha256)) return { changed: false }
  if (current !== expected) throw new Error('Unsupported or changed helper; no changes made')
  const backup = target + '.dsh-original'
  let next: Buffer
  if (action === 'repair') {
    next = patchHelper(original)
    try { await writeFile(backup, original, { flag: 'wx' }) }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error }
    if (hash(await readFile(backup)) !== profile.originalSha256) throw new Error('Original backup mismatch')
  } else {
    try { next = await readFile(backup) }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      // Accept the already-tested local patch even when installed before this plugin version.
      next = Buffer.from(original)
      for (const region of profile.regions) Buffer.from(region.original, 'hex').copy(next, region.offset)
      if (hash(next) !== profile.originalSha256) throw new Error('Cannot reconstruct verified original')
      await writeFile(backup, next, { flag: 'wx' })
    }
    if (hash(next) !== profile.originalSha256) throw new Error('Original backup mismatch')
  }
  signal.throwIfAborted()
  const temp = target + '.dsh-' + randomUUID() + '.tmp'
  const previous = target + '.dsh-' + randomUUID() + '.previous'
  await writeFile(temp, next, { flag: 'wx' })
  try {
    if (hash(await readFile(target)) !== current) throw new Error('Helper changed during preparation')
    await replace(temp, previous)
  } finally {
    await unlink(temp).catch(error => { if (error.code !== 'ENOENT') throw error })
  }
  if (hash(await readFile(target)) !== hash(next)) throw new Error('Replacement verification failed; retained backup: ' + backup)
  return { changed: true, backup, previous, screenshotValidated: false }
}

export function registerComputerUseRecovery(ctx: Context): void {
  ctx.tools.register(defineTool({
    name: 'codex_computer_use_recovery',
    description: 'Windows Computer Use maintenance. Read guide when starting desktop control or diagnosing capture timeout/file locks. Repair changes the helper signature; release interrupts only the selected helper, not DSH or Codex.',
    parameters: {
      action: { type: 'string', enum: ['guide', 'status', 'repair', 'release', 'rollback'], required: true },
      target: { type: 'string', description: 'Exact helper path returned by status; required for repair, release and rollback.' },
      acceptUnsigned: { type: 'boolean', description: 'For repair only: true after user agrees to a locally modified, unsigned helper.' },
      allowStop: { type: 'boolean', description: 'For release only: true after user authorizes interrupting the selected screenshot helper, including other tasks sharing it.' },
    },
    output: { schema: { type: 'json' }, render: (_, value) => [{ type: 'text', text: JSON.stringify(value) }] },
    execute: async (args, run) => {
      if (args.action === 'guide') return { guide: COMPUTER_USE_GUIDE }
      if (process.platform !== 'win32') throw new Error('Windows only')
      const helpers = await discoverHelpers()
      if (args.action === 'status') return { windows: release(), helpers }
      const selected = helpers.find(item => args.target && item.target.toLowerCase() === resolve(args.target).toLowerCase())
      if (!selected) throw new Error('Select an exact helper path from status')
      if (args.action === 'release') {
        if (!args.allowStop) throw new Error('release requires user-authorized allowStop=true')
        return { stoppedPids: JSON.parse(await powershell(releaseScript(selected.target), run.signal)), target: selected.target }
      }
      if (args.action === 'repair') {
        if (!/^10\.0\.1\d{4}(?:\.|$)/u.test(release())) throw new Error('This patch is for Windows 10 only')
        if (!args.acceptUnsigned) throw new Error('repair requires acceptUnsigned=true after user agreement')
      }
      if (args.action !== 'repair' && args.action !== 'rollback') throw new Error('Unknown action')
      return await replaceHelper(selected.target, args.action, run.signal)
    },
  }))
}
