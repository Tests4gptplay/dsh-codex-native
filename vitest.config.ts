import { resolve } from 'node:path'
import { configDefaults, defineConfig } from 'vitest/config'
const referenceRoot = resolve(process.env.DSH_REFERENCE_ROOT ?? '.tmp/dsh-reference')
const official = resolve(referenceRoot, 'packages/client/ui-primitives/src')
export default defineConfig({
  resolve: {
    dedupe: ['react', 'react-dom', 'clsx'],
    alias: {
      '@deepseek-ai/dsh-client-ui-primitives': resolve('tests/official-primitives.ts'),
      '#dsh-primitives': official,
      // Exercise the complete official host source with the paired API patch.
      '@deepseek-ai/dsh-token-meter': resolve(referenceRoot, 'packages/llm/token-meter/src/index.ts'),
      '@deepseek-ai/dsh-compaction-basic': resolve(referenceRoot, 'packages/compaction/compaction-basic/src/index.ts'),
    },
  },
  test: {
    include: ['tests/**/*.spec.{ts,tsx}'], pool: 'forks',
    exclude: [...configDefaults.exclude, 'tests/release-model-info.spec.ts'],
    // Process ordinary module CSS and ?inline CSS used for original UI evidence.
    css: { include: /.+/, modules: { classNameStrategy: 'scoped' } },
    server: { deps: { inline: [/@deepseek-ai\/dsh-client-ui-/, /katex/] } },
  },
})
