import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'
const official = resolve(process.env.DSH_REFERENCE_ROOT ?? '.tmp/dsh-reference', 'packages/client/ui-primitives/src')
export default defineConfig({
  resolve: {
    dedupe: ['react', 'react-dom', 'clsx'],
    alias: {
      '@deepseek-ai/dsh-client-ui-primitives': resolve('tests/official-primitives.ts'),
      '#dsh-primitives': official,
    },
  },
  test: {
    include: ['tests/**/*.spec.{ts,tsx}'], pool: 'forks',
    // Process ordinary module CSS and ?inline CSS used for original UI evidence.
    css: { include: /.+/, modules: { classNameStrategy: 'scoped' } },
    server: { deps: { inline: [/@deepseek-ai\/dsh-client-ui-/, /katex/] } },
  },
})
