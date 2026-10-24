import { existsSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const projectRoot = fileURLToPath(new URL('.', import.meta.url))
const releaseRoot = process.env.DSH_RELEASE_ROOT
if (!releaseRoot?.trim()) {
  throw new Error('DSH_RELEASE_ROOT must point to the final cleaned TGZ extraction directory')
}

function requiredFile(path: string, label: string): string {
  if (!existsSync(path) || !statSync(path).isFile()) {
    throw new Error(`${label} does not exist: ${path}`)
  }
  return path
}

const releaseEntry = requiredFile(resolve(releaseRoot, 'lib/index.js'), 'Release entry')
const referenceRoot = resolve(process.env.DSH_REFERENCE_ROOT ?? resolve(projectRoot, '.tmp/dsh-reference'))
const hostEntry = (path: string) => requiredFile(resolve(referenceRoot, path), 'Patched official host source')

// Standalone config: never merge the ordinary suite's broad include pattern.
export default defineConfig({
  root: projectRoot,
  resolve: {
    alias: [
      // Both existing fixtures and the normalizer smoke must use the TGZ export.
      { find: /^\.\.\/src\/adapter\.ts$/, replacement: releaseEntry },
      { find: /^@deepseek-ai\/dsh-llm$/, replacement: hostEntry('packages/llm/llm/src/index.ts') },
      { find: /^@deepseek-ai\/dsh-token-meter$/, replacement: hostEntry('packages/llm/token-meter/src/index.ts') },
      { find: /^@deepseek-ai\/dsh-compaction-basic$/, replacement: hostEntry('packages/compaction/compaction-basic/src/index.ts') },
    ],
  },
  test: {
    include: [
      'tests/compaction-accounting.spec.ts',
      'tests/compaction-pressure.spec.ts',
      'tests/compaction-cached-accounting.spec.ts',
      'tests/release-model-info.spec.ts',
    ],
    pool: 'forks',
    // Keep the packaged entry in Vite so its host imports use the same aliases.
    server: { deps: { inline: [releaseEntry] } },
  },
})
