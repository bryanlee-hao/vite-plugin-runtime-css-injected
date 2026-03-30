# vite-plugin-runtime-css-injected

[![npm version](https://img.shields.io/npm/v/vite-plugin-runtime-css-injected)](https://www.npmjs.com/package/vite-plugin-runtime-css-injected)
[![gzip size](https://img.shields.io/badge/gzip-0.8kB-brightgreen)](https://github.com/bryanlee-hao/vite-plugin-runtime-css-injected)
[![MIT license](https://img.shields.io/badge/license-MIT-blue)](https://img.shields.io/github/license/bryanlee-hao/vite-plugin-runtime-css-injected)

[中文](./README.zh-CN.md) | [English](./README.md)

一个面向 **Vite 8** 的构建插件包，主要用于浏览器库与微前端场景：

- `runtimeCssInjectedPlugin`：将构建产出的 CSS 以内联 `<style>` 的方式在运行时注入到页面中。
- `legacyImportMetaUrlPlugin`：如果需要构建 `iife` / `umd` 模式，在 **Rolldown** 构建场景下为 `import.meta.url` 提供兼容处理。

包以 **ESM** 形式发布到 npm。

| 项目 | 说明 |
| --- | --- |
| 包名 | `vite-plugin-runtime-css-injected` |
| 入口 | `dist/index.js` |
| 类型声明 | `dist/index.d.ts` |
| Peer Dependency | `vite@^8.0.0` |
| Node 版本 | `>=20` |
| License | MIT |

### 安装

```bash
npm install -D vite-plugin-runtime-css-injected
# 或
pnpm add -D vite-plugin-runtime-css-injected
yarn add -D vite-plugin-runtime-css-injected
```

请确保当前项目使用兼容版本的 `vite@8`。

### 导出内容

- `legacyImportMetaUrlPlugin`
- `runtimeCssInjectedPlugin`
- `LegacyImportMetaUrlPluginOptions`
- `RuntimeCssInjectedPluginOptions`
- `RuntimeCssFormat`

### 使用示例

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

### 插件说明

#### `runtimeCssInjectedPlugin`

在构建产物中注入运行时样式逻辑，将 CSS 内容合并进 JS，并在可行时移除独立的 `.css` 文件。同时会在客户端运行时代码中处理 CSS 引用静态资源的路径问题。

- `format: 'es'` 时，基于 `import.meta.url` 解析资源路径。
- `format: 'legacy'` 时，使用 `document.currentScript` 等回退逻辑解析资源路径。
- 可通过 `styleAttributes` 传入额外的 `<style>` 属性；插件默认会附带 `data-runtime-css-injected` 等标记属性。

#### `legacyImportMetaUrlPlugin`

用于 **Rolldown** 构建场景下处理 `import.meta.url`，并为指定入口注入基于 `document.currentScript` 的 prelude。

通常需要结合以下配置一起使用：

- `build.rolldownOptions`
- `experimental.renderBuiltUrl`

具体配置方式请按你的构建输出约定补充。

### 本地开发与构建

```bash
npm install
npm run build
```

构建产物输出到 `dist/`。当前包通过 `package.json` 中的 `files` 字段控制发布内容，仅发布该目录。

### License

MIT
