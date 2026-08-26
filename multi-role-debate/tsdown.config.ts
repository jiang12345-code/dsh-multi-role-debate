/**
 * multi-role-debate — tsdown config (最小版)
 *
 * 不复用 DSH 仓库的 clientConfig/PLATFORM_MODULES/purity gate/CSS Modules —
 * 第一版不需要这些（能力 1+2 不依赖 CSS Modules；不跨插件 value import）。
 * 仅产出 lib/client.js 的 CJS closure-factory（与 DSH 官方格式一致）。
 * 后续若需要 CSS Modules / purity gate，再从 packages/client/tsdown.client.ts 引用官方 clientConfig。
 */
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve as resolvePath } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const pkg = JSON.parse(readFileSync(resolvePath(__dirname, 'package.json'), 'utf-8'))
const id = pkg.name

export default {
  name: `${id}/client`,
  entry: { client: 'lib/client/index.js' },
  outDir: 'lib',
  format: 'cjs',
  platform: 'browser',
  dts: false,
  sourcemap: true,
  clean: false,
  // 不依赖 harness 内部的 PLATFORM_MODULES / PRELOADED_CLIENT_EXTERNALS —
  // 因为宿主运行时（`window.__ModuleLoader__`）已经提供 React/ctx 等全局，
  // 此 bundle 不再 import 它们；只内联我们自己的代码。
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production'),
  },
  outputOptions: {
    entryFileNames: 'client.js',
    banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(id)}, factory: (require) => {`,
    footer: 'return module.exports; } });',
    intro: 'var module = { exports: {} }; var exports = module.exports;',
  },
}
