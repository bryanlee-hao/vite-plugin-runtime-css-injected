import { readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { posix, relative, resolve } from 'node:path'
import { gzipSync } from 'node:zlib'
import type { Plugin, ResolvedConfig } from 'vite'

export type RuntimeCssFormat = 'es' | 'legacy'

export interface RuntimeCssInjectedPluginOptions {
  format: RuntimeCssFormat
  styleAttributes?: Record<string, string>
}

const defaultStyleAttributes = {
  type: 'text/css',
  'data-runtime-css-injected': 'true',
}

interface RuntimeCssStyleRecord {
  id: string
  basePath: string
  cssCode: string
}

interface OutputAssetLike {
  type: 'asset'
  fileName: string
  source: string | Uint8Array
}

interface ChunkWithViteMetadata {
  type: 'chunk'
  fileName: string
  code: string
  isEntry?: boolean
  viteMetadata?: {
    importedCss?: Set<string>
  }
}

type OutputBundleLike = Record<string, OutputAssetLike | ChunkWithViteMetadata>

export function runtimeCssInjectedPlugin(
  options: RuntimeCssInjectedPluginOptions,
): Plugin {
  let resolvedConfig: ResolvedConfig | null = null
  let hasInjectedCssInGenerateBundle = false
  const finalSizeLogs: string[] = []

  return {
    name: 'runtime-css-injected-plugin',
    apply: 'build',
    configResolved(config) {
      resolvedConfig = config
    },
    generateBundle(_outputOptions, bundle) {
      const bundleInfo = bundle as OutputBundleLike
      const cssAssets = collectCssAssets(bundleInfo)
      if (cssAssets.size === 0) {
        return
      }

      const injectedCssFileNames = new Set<string>()

      for (const chunk of getChunks(bundleInfo)) {
        const styleRecords = getChunkStyleRecords(chunk, cssAssets)
        if (styleRecords.length === 0) {
          continue
        }

        const injectionCode = createCssInjectionRuntimeCode({
          styles: styleRecords,
          format: options.format,
          styleAttributes: {
            ...defaultStyleAttributes,
            ...options.styleAttributes,
          },
        })

        if (!chunk.code.includes('/* runtime css injected */')) {
          chunk.code = `${injectionCode}\n${chunk.code}`
        }

        const chunkCssFileNames = new Set(styleRecords.map((styleRecord) => styleRecord.id))
        for (const styleRecord of styleRecords) {
          injectedCssFileNames.add(styleRecord.id)
        }

        clearChunkImportedCss(chunk, chunkCssFileNames)
      }

      if (injectedCssFileNames.size === 0) {
        return
      }

      hasInjectedCssInGenerateBundle = true

      for (const fileName of injectedCssFileNames) {
        delete bundle[fileName]
      }
    },
    async writeBundle(outputOptions) {
      if (hasInjectedCssInGenerateBundle) {
        return
      }

      const outputDir = outputOptions.dir
        ? resolve(outputOptions.dir)
        : resolvedConfig
          ? resolve(resolvedConfig.build.outDir)
          : resolve(process.cwd(), 'dist')
      const allOutputFiles = await collectOutputFiles(outputDir)
      const cssFiles = allOutputFiles.filter((filePath) => filePath.endsWith('.css'))

      if (cssFiles.length === 0) {
        return
      }

      const entryFiles = await getRootEntryFiles(outputDir)
      if (entryFiles.length === 0) {
        return
      }

      const baseEntryFileName = toPosixPath(relative(outputDir, entryFiles[0]))
      const styles: RuntimeCssStyleRecord[] = []

      for (const filePath of cssFiles) {
        const cssCode = await readFile(filePath, 'utf8')
        if (!cssCode) {
          continue
        }

        const cssFileName = toPosixPath(relative(outputDir, filePath))
        styles.push({
          id: cssFileName,
          basePath: toChunkRelativePath(baseEntryFileName, cssFileName),
          cssCode,
        })
      }

      if (styles.length === 0) {
        return
      }

      const injectionCode = createCssInjectionRuntimeCode({
        styles,
        format: options.format,
        styleAttributes: {
          ...defaultStyleAttributes,
          ...options.styleAttributes,
        },
      })

      for (const filePath of entryFiles) {
        const code = await readFile(filePath, 'utf8')

        if (code.includes('/* runtime css injected */')) {
          continue
        }

        await writeFile(filePath, `${injectionCode}\n${code}`)
        finalSizeLogs.push(await getFinalFileSizeLog(filePath))
      }

      for (const filePath of cssFiles) {
        await rm(filePath)
      }
    },
    closeBundle() {
      if (finalSizeLogs.length === 0) {
        return
      }

      for (const log of finalSizeLogs) {
        console.log(log)
      }
    },
  }
}

function collectCssAssets(bundle: OutputBundleLike) {
  const cssAssets = new Map<string, OutputAssetLike>()

  for (const output of Object.values(bundle)) {
    if (output.type === 'asset' && output.fileName.endsWith('.css')) {
      cssAssets.set(toPosixPath(output.fileName), output)
    }
  }

  return cssAssets
}

function getChunks(bundle: OutputBundleLike) {
  return Object.values(bundle).filter((output): output is ChunkWithViteMetadata => {
    return output.type === 'chunk'
  })
}

function getChunkStyleRecords(
  chunk: ChunkWithViteMetadata,
  cssAssets: Map<string, OutputAssetLike>,
) {
  const importedCss = Array.from(chunk.viteMetadata?.importedCss ?? [])
  const styleRecords: RuntimeCssStyleRecord[] = []

  for (const fileName of importedCss) {
    const normalizedFileName = toPosixPath(fileName)
    const asset = cssAssets.get(normalizedFileName)
    if (!asset) {
      continue
    }

    const cssCode = assetSourceToString(asset.source)
    if (!cssCode) {
      continue
    }

    styleRecords.push({
      id: normalizedFileName,
      basePath: toChunkRelativePath(chunk.fileName, normalizedFileName),
      cssCode,
    })
  }

  return styleRecords
}

function clearChunkImportedCss(chunk: ChunkWithViteMetadata, cssFileNames: Set<string>) {
  if (!chunk.viteMetadata?.importedCss) {
    return
  }

  for (const fileName of cssFileNames) {
    chunk.viteMetadata.importedCss.delete(fileName)
  }
}

async function collectOutputFiles(targetDir: string): Promise<string[]> {
  const entries = await readdir(targetDir, { withFileTypes: true })
  const files = await Promise.all(
    entries.map(async (entry) => {
      const filePath = resolve(targetDir, entry.name)
      if (entry.isDirectory()) {
        return collectOutputFiles(filePath)
      }

      return [filePath]
    }),
  )

  return files.flat()
}

async function getRootEntryFiles(targetDir: string) {
  const entries = await readdir(targetDir, { withFileTypes: true })
  return entries
    .filter((entry) => entry.isFile() && /\.(?:m?js|cjs)$/.test(entry.name))
    .map((entry) => resolve(targetDir, entry.name))
}

async function getFinalFileSizeLog(filePath: string) {
  const content = await readFile(filePath)
  const sizeInKb = formatSizeInKb(content.byteLength)
  const gzipSizeInKb = formatSizeInKb(gzipSync(content).byteLength)
  const relativeFilePath = toPosixPath(relative(process.cwd(), filePath))
  const paddedFilePath = relativeFilePath.padEnd(48, ' ')

  return `${paddedFilePath} ${sizeInKb} kB │ gzip: ${gzipSizeInKb} kB`
}

function formatSizeInKb(sizeInBytes: number) {
  return (sizeInBytes / 1024).toFixed(2)
}

function assetSourceToString(source: string | Uint8Array) {
  return typeof source === 'string' ? source : Buffer.from(source).toString('utf8')
}

function toPosixPath(filePath: string) {
  return filePath.split('\\').join('/')
}

function toChunkRelativePath(chunkFileName: string, targetFileName: string) {
  const chunkDir = posix.dirname(toPosixPath(chunkFileName))
  const relativePath = posix.relative(chunkDir === '.' ? '' : chunkDir, toPosixPath(targetFileName))

  if (!relativePath || relativePath.startsWith('.')) {
    return relativePath || './'
  }

  return `./${relativePath}`
}

function createCssInjectionRuntimeCode({
  styles,
  format,
  styleAttributes,
}: {
  styles: RuntimeCssStyleRecord[]
  format: RuntimeCssFormat
  styleAttributes: Record<string, string>
}) {
  const bundleUrlExpression =
    format === 'es'
      ? 'import.meta.url'
      : `(
  function () {
    var currentScript = typeof document !== 'undefined' ? document.currentScript : null;
    return currentScript &&
      currentScript.tagName &&
      currentScript.tagName.toUpperCase() === 'SCRIPT' &&
      currentScript.src
        ? currentScript.src
        : typeof document !== 'undefined'
          ? new URL('', document.baseURI).href
          : typeof location !== 'undefined'
            ? location.href
            : '';
  }
)()`

  const nonceRuntimeCode = resolveStyleNonceRuntimeCode()

  return `/* runtime css injected */
(function () {
  try {
    if (typeof document === 'undefined') {
      return;
    }

    ${nonceRuntimeCode}
    var styles = ${JSON.stringify(styles)};
    var baseUrl = ${bundleUrlExpression};
    var attributes = ${JSON.stringify(styleAttributes)};
    var inheritedNonce = resolveStyleNonce(attributes, baseUrl);

    for (var styleIndex = 0; styleIndex < styles.length; styleIndex++) {
      var styleRecord = styles[styleIndex];
      var styleId = styleRecord.id;

      if (document.querySelector('style[data-runtime-css-id="' + styleId + '"]')) {
        continue;
      }

      var cssBaseUrl = new URL(styleRecord.basePath, baseUrl).href;
      var rewrittenCss = styleRecord.cssCode.replace(/url\\(\\s*(['"]?)([^)"']+)\\1\\s*\\)/g, function (match, quote, rawUrl) {
        var nextUrl = rawUrl.trim();

        if (
          !nextUrl ||
          nextUrl.startsWith('data:') ||
          nextUrl.startsWith('blob:') ||
          nextUrl.startsWith('//') ||
          nextUrl.startsWith('#') ||
          nextUrl.startsWith('var(') ||
          /^[a-zA-Z][a-zA-Z\\d+.-]*:/.test(nextUrl)
        ) {
          return match;
        }

        var normalizedQuote = quote || '"';
        var resolvedUrl = new URL(nextUrl, cssBaseUrl).href;
        return 'url(' + normalizedQuote + resolvedUrl + normalizedQuote + ')';
      });

      var elementStyle = document.createElement('style');

      for (var attribute in attributes) {
        if (attribute === 'nonce' && !attributes[attribute] && inheritedNonce) {
          continue;
        }
        elementStyle.setAttribute(attribute, attributes[attribute]);
      }

      if (inheritedNonce) {
        elementStyle.setAttribute('nonce', inheritedNonce);
      }

      elementStyle.setAttribute('data-runtime-css-id', styleId);
      elementStyle.appendChild(document.createTextNode(rewrittenCss));
      document.head.appendChild(elementStyle);
    }
  } catch (error) {
    console.error('runtime-css-injected-plugin', error);
  }
})();`
}

function resolveStyleNonceRuntimeCode() {
  return `
function resolveStyleNonce(attributes, baseUrl) {
  var explicitNonce = typeof attributes.nonce === 'string' ? attributes.nonce.trim() : '';
  if (explicitNonce) {
    return explicitNonce;
  }

  var currentScript = typeof document !== 'undefined' ? document.currentScript : null;
  var currentScriptNonce = readNonce(currentScript);
  if (currentScriptNonce) {
    return currentScriptNonce;
  }

  if (baseUrl) {
    var matchedScript = document.querySelector('script[src="' + cssEscapeAttribute(baseUrl) + '"]');
    var matchedScriptNonce = readNonce(matchedScript);
    if (matchedScriptNonce) {
      return matchedScriptNonce;
    }
  }

  var nonceElement = document.querySelector('script[nonce],style[nonce],link[nonce]');
  var inheritedNonce = readNonce(nonceElement);
  return inheritedNonce || '';
}

function readNonce(element) {
  if (!element) {
    return '';
  }

  return typeof element.nonce === 'string' && element.nonce
    ? element.nonce
    : element.getAttribute('nonce') || '';
}

function cssEscapeAttribute(value) {
  return value.replace(/["\\\\]/g, '\\\\$&');
}
`.trim()
}
