import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, URL } from 'node:url'
import { readFile, writeFile } from 'node:fs/promises'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import type { Plugin, PluginOption, UserConfig } from 'vite'
import {
  legacyImportMetaUrlPlugin,
  runtimeCssInjectedPlugin,
} from '../dist'

const projectName = 'testDemo'
const __dirname = dirname(fileURLToPath(import.meta.url))

const outDir = join('dist', 'lib')
type BrowserBuildTarget = 'es' | 'legacy'

function createEsConfig(): UserConfig {
  return {
    mode: 'production',
    base: './',
    plugins: [
      vue(),
      vueJsx(),
      runtimeCssInjectedPlugin({ format: 'es' }),
      emitBrowserPreviewPlugin(),
    ],
    build: {
      outDir,
      assetsDir: 'assets',
      copyPublicDir: true,
      emptyOutDir: true,
      assetsInlineLimit: 0,
      // minify: false,
      // cssMinify: false,
      sourcemap: false,
      cssCodeSplit: true,
      rolldownOptions: {
        input: resolve(__dirname, 'src/index.ts'),
        preserveEntrySignatures: 'strict',
        output: {
          format: 'es',
          entryFileNames: 'index.mjs',
          chunkFileNames: 'chunks/[name]-[hash].js',
          assetFileNames: 'assets/[name].[hash][extname]',
          codeSplitting: true,
          banner: createBuildBanner('index.umd.js'),
        },
      },
    }
  }
}

function createLegacyConfig(): UserConfig {
  return {
    mode: 'production',
    base: './',
    plugins: [
      vue(),
      vueJsx(),
      runtimeCssInjectedPlugin({ format: 'legacy', }),
      legacyImportMetaUrlPlugin({
        entryFileNames: ['index.iife.js', 'index.umd.js'],
      }),
    ],
    build: {
      outDir,
      assetsDir: 'assets',
      copyPublicDir: false,
      emptyOutDir: false,
      assetsInlineLimit: 0,
      // oxc 构建有报错，不知道为什么
      // minify: 'esbuild',
      // minify: false,
      // cssMinify: false,
      sourcemap: false,
      //  必须为 false，否则会导致 runtime css 注入失败。因为 legacy 模式，vite 会自动注入 css 代码，导致 css 代码重复注入。
      cssCodeSplit: false,
      rolldownOptions: {
        input: resolve(__dirname, 'src/index.ts'),
        preserveEntrySignatures: 'strict',
        output: [
          {
            format: 'iife',
            name: projectName,
            exports: 'named',
            entryFileNames: 'index.iife.js',
            assetFileNames: 'assets/[name].[hash][extname]',
            banner: createBuildBanner('index.iife.js'),
          },
          {
            format: 'umd',
            name: projectName,
            exports: 'named',
            entryFileNames: 'index.umd.js',
            assetFileNames: 'assets/[name].[hash][extname]',
            banner: createBuildBanner('index.umd.js'),
          },
        ],
      }, 
    }
  }
}

const buildTarget: BrowserBuildTarget =
  process.env.BROWSER_BUILD_TARGET === 'legacy' ? 'legacy' : 'es'

export default buildTarget === 'legacy' ? createLegacyConfig() : createEsConfig()

function emitBrowserPreviewPlugin(): Plugin {
  return {
    name: 'emit-browser-preview-html-runtime-css',
    apply: 'build',
    async closeBundle() {
      const previewSourcePath = fileURLToPath(new URL('./public/preview.html', import.meta.url))
      console.log(`previewSourcePath = ${previewSourcePath}`)
      const previewHtml = await readFile(previewSourcePath, 'utf8')
      await writeFile(join(process.cwd(), outDir, 'preview.html'), previewHtml)
    },
  }
}

function createBuildBanner(_entryFileName?: string) {
  return '/* Code by bryan lee */'
}
