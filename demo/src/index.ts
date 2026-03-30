import './assets/main.css'

import { createApp } from 'vue'
import type { App as VueApp } from 'vue'
import App from './App.vue'

interface MicroAppTheme {
  mode?: string
  variables?: Record<string, string>
}

interface MicroAppConfig {
  container?: string | Element
  props?: {
    theme?: MicroAppTheme
    [key: string]: unknown
  }
}

interface MicroAppInstance {
  mount(): Promise<void>
  update(nextProps?: Record<string, unknown>): void
  unmount(): void
}

function resolveContainer(container: MicroAppConfig['container']) {
  if (typeof container === 'string') {
    return document.querySelector(container)
  }

  return container ?? document.querySelector('#app')
}

function applyTheme(container: Element | null, theme?: MicroAppTheme) {
  if (!(container instanceof HTMLElement)) {
    return
  }

  const mode = theme?.mode ?? ''
  container.dataset.themeMode = mode

  for (const [name, value] of Object.entries(theme?.variables ?? {})) {
    container.style.setProperty(`--${name}`, String(value))
  }
}

export function init(config: MicroAppConfig = {}): MicroAppInstance {
  let app: VueApp | null = null
  let mountTarget: Element | null = null

  return {
    async mount() {
      mountTarget = resolveContainer(config.container)
      if (!mountTarget) {
        throw new Error('Cannot resolve mount container for demo micro app.')
      }

      if (app) {
        return
      }

      applyTheme(mountTarget, config.props?.theme)
      app = createApp(App)
      app.mount(mountTarget)
    },
    update(nextProps = {}) {
      config.props = {
        ...config.props,
        ...nextProps,
      }
      applyTheme(mountTarget, config.props.theme)
    },
    unmount() {
      if (!app) {
        return
      }

      app.unmount()
      app = null

      if (mountTarget instanceof HTMLElement) {
        mountTarget.removeAttribute('data-theme-mode')
        mountTarget.removeAttribute('style')
      }
    },
  }
}

export default init