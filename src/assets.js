// @ts-check
/**
 * assets.js — Descubre referencias a assets locales en archivos .psmdoc
 * y reescribe sus rutas usando un mapa local→URL remota.
 *
 * Assets locales = rutas relativas sin protocolo y sin leading "/".
 * Ejemplo: images/logo.png, docs/manual.pdf
 */

/** @type {ReadonlyArray<RegExp>} */
const ASSET_LINE_PATTERNS = [
  /^#IMG\s+(\S+)/i,
  /^#AUDIO\s+(\S+)/i,
  /^#PDF\s+(\S+)/i,
  /^#SVG\s+(\S+)/i,
];

/**
 * Devuelve true si la ruta apunta a un recurso local (no http/https, no leading /).
 * @param {string} src
 * @returns {boolean}
 */
const isLocalRef = (src) => {
  if (!src) return false;
  if (src.startsWith("/") || src.startsWith("./") || src.startsWith("../")) return false;
  if (/^(https?:|mailto:|tel:|data:)/i.test(src)) return false;
  return true;
};

/**
 * Escanea el contenido de un .psmdoc y devuelve las rutas locales de assets
 * referenciadas en etiquetas de bloque.
 * @param {string} content
 * @returns {string[]}
 */
export const discoverAssetRefs = (content) => {
  const refs = new Set();
  for (const block of String(content || "").split(/\r?\n\r?\n/)) {
    const trimmed = block.trim();
    for (const pattern of ASSET_LINE_PATTERNS) {
      const match = pattern.exec(trimmed);
      if (match && isLocalRef(match[1])) {
        refs.add(match[1]);
      }
    }
  }
  return [...refs];
};

/**
 * Reemplaza referencias locales de assets en el contenido con sus URLs remotas.
 * @param {string} content
 * @param {Record<string,string>} assetMap  { "images/logo.png": "https://..." }
 * @returns {string}
 */
export const rewriteAssetRefs = (content, assetMap) => {
  let result = content;
  for (const [localPath, remoteUrl] of Object.entries(assetMap)) {
    // Escapar caracteres especiales de regex para el path local
    const escaped = localPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    result = result.replace(new RegExp(escaped, "g"), remoteUrl);
  }
  return result;
};
