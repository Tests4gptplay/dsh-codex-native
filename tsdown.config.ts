import { defineConfig } from 'tsdown'

const PACKAGE_ID = 'dsh-codex-native'

export default defineConfig([
  {
    name: PACKAGE_ID,
    entry: ['src/index.ts'],
    outDir: 'lib',
    format: ['esm'],
    platform: 'node',
    target: 'es2024',
    dts: false,
    clean: true,
    deps: {
      neverBundle: [
        '@deepseek-ai/cordis',
        '@deepseek-ai/dsh-llm',
        '@deepseek-ai/dsh-subprocess',
        '@deepseek-ai/dsh-tools',
        '@deepseek-ai/dsh-web',
        '@deepseek-ai/schemastery',
        '@openai/codex',
      ],
    },
  },
  {
    name: PACKAGE_ID + '/client',
    entry: { client: 'src/client/index.ts' },
    outDir: 'lib',
    format: 'cjs',
    platform: 'browser',
    target: 'es2022',
    dts: false,
    clean: false,
    sourcemap: false,
    deps: {
      neverBundle: [
        'react', 'react/jsx-runtime', 'react-dom', 'react-dom/client',
        '@deepseek-ai/cordis', '@deepseek-ai/dsh-client-connection/client',
        '@deepseek-ai/dsh-client-locale/client',
        '@deepseek-ai/dsh-client-ui-slots',
        '@deepseek-ai/dsh-client-ui-renderer/client',
        '@deepseek-ai/dsh-client-ui-settings/client',
      ],
    },
    outputOptions: {
      entryFileNames: 'client.js',
      banner: 'window.__ModuleLoader__.load({ id: ' + JSON.stringify(PACKAGE_ID) + ', factory: (require) => {',
      footer: 'return module.exports; } });',
      intro: 'var module = { exports: {} }; var exports = module.exports;',
    },
  },
])
