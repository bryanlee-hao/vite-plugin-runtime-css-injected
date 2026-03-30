# vite-plugin-runtime-css-injected

[![npm version](https://img.shields.io/npm/v/vite-plugin-runtime-css-injected)](https://www.npmjs.com/package/vite-plugin-runtime-css-injected)
[![gzip size](https://img.shields.io/badge/gzip-0.8kB-brightgreen)](https://github.com/bryanlee-hao/vite-plugin-runtime-css-injected)
[![MIT license](https://img.shields.io/badge/license-MIT-blue)](https://img.shields.io/github/license/bryanlee-hao/vite-plugin-runtime-css-injected)

[中文](./README.zh-CN.md) | [English](./README.md)

A **Vite 8** plugin package for browser libraries and micro-frontend scenarios:

- `runtimeCssInjectedPlugin`: injects built CSS into the page at runtime as inline `<style>` tags.
- `legacyImportMetaUrlPlugin`: provides a compatibility layer for `import.meta.url` in **Rolldown** builds, especially when targeting `iife` / `umd`.

The package is published to npm as **ESM**.


| Item                                       | Description                        |
| ------------------------------------------ | ---------------------------------- |
| Package name                               | `vite-plugin-runtime-css-injected` |
| Entry                                      | `dist/index.js`                    |
| Type definitionslegacyImportMetaUrlPlugin | `dist/index.d.ts`                  |
| Peer Dependency                            | `vite@^8.0.0`                      |
| Node version                               | `>=20`                             |
| License                                    | MIT                                |


### Installation

```bash
npm install -D vite-plugin-runtime-css-injected
# or
pnpm add -D vite-plugin-runtime-css-injected
yarn add -D vite-plugin-runtime-css-injected
```

Make sure your project uses a compatible version of `vite@8`.

### Exports

- `legacyImportMetaUrlPlugin`
- `runtimeCssInjectedPlugin`
- `LegacyImportMetaUrlPluginOptions`
- `RuntimeCssInjectedPluginOptions`
- `RuntimeCssFormat`

### Example

```ts
import { defineConfig } from 'vite'
import {
  legacyImportMetaUrlPlugin,
  runtimeCssInjectedPlugin,
} from 'vite-plugin-runtime-css-injected'

export default defineConfig({
  plugins: [
    runtimeCssInjectedPlugin({ format: 'es' }),
    legacyImportMetaUrlPlugin({
      entryFileNames: ['your-entry.js'],
      // importMetaUrlVarName: '__LEGAL_IMPORT_META_URL__',
    }),
  ],
})
```

### Plugin Notes

#### `runtimeCssInjectedPlugin`

Injects runtime style logic into build output, merges CSS into JS, and removes standalone `.css` files when possible. It also rewrites asset paths referenced from CSS in the client runtime.

- With `format: 'es'`, asset URLs are resolved based on `import.meta.url`.
- With `format: 'legacy'`, asset URLs are resolved using fallback logic such as `document.currentScript`.
- You can pass extra `<style>` attributes via `styleAttributes`; the plugin adds marker attributes such as `data-runtime-css-injected` by default.

#### `legacyImportMetaUrlPlugin`

Handles `import.meta.url` for **Rolldown** build scenarios and injects a `document.currentScript`-based prelude for specified entry files.

It is typically used together with:

- `build.rolldownOptions`
- `experimental.renderBuiltUrl`

Adjust the exact configuration based on your output strategy.

### Local Development

```bash
npm install
npm run build
```

Build output is generated in `dist/`. The package only publishes that directory through the `files` field in `package.json`.

### License

MIT