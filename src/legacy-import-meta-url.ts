import type { Plugin, UserConfig } from 'vite'

export interface LegacyImportMetaUrlPluginOptions {
  entryFileNames: string[]
  importMetaUrlVarName?: string
}

const defaultImportMetaUrlVarName = '__LEGAL_IMPORT_META_URL__'

export function legacyImportMetaUrlPlugin(
  options: LegacyImportMetaUrlPluginOptions,
): Plugin {
  const importMetaUrlVarName =
    options.importMetaUrlVarName ?? defaultImportMetaUrlVarName
  const entryFileNames = new Set(options.entryFileNames)

  return {
    name: 'legacy-import-meta-url-plugin',
    apply: 'build',
    config(userConfig) {
      patchRenderBuiltUrl(userConfig, importMetaUrlVarName)
      patchImportMetaUrlDefine(userConfig, importMetaUrlVarName)
      patchOutputIntro(userConfig, entryFileNames, importMetaUrlVarName)
    },
  }
}

function patchRenderBuiltUrl(
  userConfig: UserConfig,
  importMetaUrlVarName: string,
) {
  userConfig.experimental ??= {}

  const previousRenderBuiltUrl = userConfig.experimental.renderBuiltUrl
  userConfig.experimental.renderBuiltUrl = (filename, context) => {
    if (context.hostType === 'js' && context.type === 'asset') {
      return {
        runtime: `new URL(${JSON.stringify(filename)}, ${importMetaUrlVarName}).href`,
      }
    }

    return previousRenderBuiltUrl?.(filename, context) ?? { relative: true }
  }
}

function patchImportMetaUrlDefine(
  userConfig: UserConfig,
  importMetaUrlVarName: string,
) {
  userConfig.build ??= {}
  userConfig.build.rolldownOptions ??= {}
  userConfig.build.rolldownOptions.transform ??= {}
  userConfig.build.rolldownOptions.transform.define = {
    ...userConfig.build.rolldownOptions.transform.define,
    'import.meta.url': importMetaUrlVarName,
  }
}

function patchOutputIntro(
  userConfig: UserConfig,
  entryFileNames: Set<string>,
  importMetaUrlVarName: string,
) {
  userConfig.build ??= {}
  userConfig.build.rolldownOptions ??= {}

  const currentOutput = userConfig.build.rolldownOptions.output
  if (!currentOutput) {
    return
  }

  if (Array.isArray(currentOutput)) {
    userConfig.build.rolldownOptions.output = currentOutput.map((output) =>
      patchSingleOutputIntro(
        output as Record<string, unknown>,
        entryFileNames,
        importMetaUrlVarName,
      ),
    ) as typeof currentOutput
    return
  }

  userConfig.build.rolldownOptions.output = patchSingleOutputIntro(
    currentOutput as Record<string, unknown>,
    entryFileNames,
    importMetaUrlVarName,
  ) as typeof currentOutput
}

function patchSingleOutputIntro(
  output: Record<string, unknown>,
  entryFileNames: Set<string>,
  importMetaUrlVarName: string,
): Record<string, unknown> {
  if (
    typeof output.entryFileNames !== 'string' ||
    !entryFileNames.has(output.entryFileNames)
  ) {
    return output
  }

  const importMetaUrlPrelude = createImportMetaUrlPrelude(
    output.entryFileNames,
    importMetaUrlVarName,
  )

  if (
    typeof output.intro === 'string' &&
    output.intro.includes(`var ${importMetaUrlVarName} =`)
  ) {
    return output
  }

  return {
    ...output,
    intro:
      typeof output.intro === 'string' && output.intro.trim()
        ? `${importMetaUrlPrelude}\n${output.intro}`
        : importMetaUrlPrelude,
  }
}

function createImportMetaUrlPrelude(
  entryFileName: string,
  importMetaUrlVarName: string,
) {
  return `
var __micro_app_current_script__ =
  typeof document !== 'undefined' ? document.currentScript : null;
var ${importMetaUrlVarName} =
  __micro_app_current_script__ &&
  __micro_app_current_script__.tagName &&
  __micro_app_current_script__.tagName.toUpperCase() === 'SCRIPT' &&
  __micro_app_current_script__.src
    ? __micro_app_current_script__.src
    : typeof document !== 'undefined'
      ? new URL(${JSON.stringify(entryFileName)}, document.baseURI).href
      : typeof location !== 'undefined'
        ? location.href
        : '';
  `.trim()
}
