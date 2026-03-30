import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import { runtimeCssInjectedPlugin, legacyImportMetaUrlPlugin } from '../dist'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    runtimeCssInjectedPlugin({ format: 'es' }),
    legacyImportMetaUrlPlugin({
      entryFileNames: ['your-entry.js'],
      // importMetaUrlVarName: '__LEGAL_IMPORT_META_URL__',
    }),
    vue(),
    vueJsx(),
  ],
})
