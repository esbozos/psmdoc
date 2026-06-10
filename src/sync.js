// @ts-check
/**
 * sync.js — Orquesta la sincronización local → remoto.
 *
 * Flujo:
 *   1. Construir manifiesto local (archivos + assets).
 *   2. Obtener manifiesto remoto.
 *   3. Calcular delta (create/update/unchanged/delete).
 *   4. Si --flush: archivar remoto primero, luego forzar recreación completa.
 *   5. Subir assets nuevos/modificados → obtener URLs remotas.
 *   6. Reescribir refs locales en contenido .psmdoc → subir archivos.
 *   7. Eliminar archivos remotos que no existen en local (solo con --flush).
 *   8. Aplicar --version si se indicó.
 *   9. Imprimir resumen.
 */

import fs from "fs";
import path from "path";
import { buildManifest, diffManifests } from "./manifest.js";
import { discoverAssetRefs, rewriteAssetRefs } from "./assets.js";
import { createClient } from "./api_client.js";

/** Colores ANSI para la consola */
const C = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
};

const log = {
  info: (msg) => console.log(`${C.cyan}ℹ${C.reset}  ${msg}`),
  ok: (msg) => console.log(`${C.green}✔${C.reset}  ${msg}`),
  warn: (msg) => console.log(`${C.yellow}⚠${C.reset}  ${msg}`),
  error: (msg) => console.error(`${C.red}✖${C.reset}  ${msg}`),
  section: (msg) => console.log(`\n${C.bold}${msg}${C.reset}`),
  dim: (msg) => console.log(`${C.dim}${msg}${C.reset}`),
};

/**
 * Convierte una ruta relativa de archivo en (dirPath, name).
 * "GettingStarted/Intro.psmdoc" → { dirPath: "GettingStarted", name: "Intro.psmdoc" }
 * @param {string} relPath
 * @returns {{ dirPath: string, name: string }}
 */
const splitRelPath = (relPath) => {
  const parts = relPath.split("/");
  const name = parts.pop();
  const dirPath = parts.join("/") || "/";
  return { dirPath, name };
};

/**
 * Parsea versión con bump "+".
 * @param {string} currentVersion  "1.0.0"
 * @param {string} versionArg      "1.2.0" | "+"
 * @returns {string}
 */
const resolveVersion = (currentVersion, versionArg) => {
  if (!versionArg || versionArg === "keep") return null;
  if (versionArg === "+") {
    const parts = (currentVersion || "1.0.0").split(".").map(Number);
    parts[2] = (parts[2] || 0) + 1;
    return parts.join(".");
  }
  // Validar formato semver básico
  if (/^\d+\.\d+(\.\d+)?$/.test(versionArg)) return versionArg;
  throw new Error(`Versión inválida: "${versionArg}". Usa "1.2.0" o "+".`);
};

/**
 * @typedef {{
 *   dir: string,
 *   projectId: number|string,
 *   clientSecret: string,
 *   baseUrl: string,
 *   flush?: boolean,
 *   version?: string,
 *   dryRun?: boolean,
 *   verbose?: boolean,
 * }} SyncOptions
 */

/**
 * Ejecuta la sincronización completa.
 * @param {SyncOptions} opts
 * @returns {Promise<void>}
 */
export const syncProject = async (opts) => {
  const {
    dir,
    projectId,
    clientSecret,
    baseUrl = "https://psmdoc.gestionciudad.com",
    flush = false,
    version: versionArg,
    dryRun = false,
    verbose = false,
  } = opts;

  if (!fs.existsSync(dir)) {
    log.error(`Directorio no encontrado: ${dir}`);
    process.exit(1);
  }

  const client = createClient(baseUrl, projectId, clientSecret);

  log.section("PSMDoc Sync");
  log.info(`Directorio: ${path.resolve(dir)}`);
  log.info(`Proyecto:   ${projectId}`);
  log.info(`Servidor:   ${baseUrl}`);
  if (dryRun) log.warn("Modo --dry-run: no se realizarán cambios remotos.");

  // ─── 1. Manifiesto local ────────────────────────────────────────────────────
  log.section("1/5  Escaneando directorio local…");
  const { files: localFiles, assets: localAssets } = buildManifest(dir);
  log.info(`${localFiles.length} archivos .psmdoc   ${localAssets.length} assets`);

  // ─── 2. Manifiesto remoto ───────────────────────────────────────────────────
  log.section("2/5  Obteniendo manifiesto remoto…");
  let remoteManifest = { files: [], assets: [] };
  let currentVersion = "1.0.0";
  try {
    const resp = await client.getManifest();
    remoteManifest = resp.data || { files: [], assets: [] };
    currentVersion = resp.version || "1.0.0";
    log.info(`Remoto: ${remoteManifest.files.length} archivos   ${remoteManifest.assets.length} assets   v${currentVersion}`);
  } catch (err) {
    log.error(`No se pudo obtener manifiesto remoto: ${err.message}`);
    process.exit(1);
  }

  // ─── 3. Delta ───────────────────────────────────────────────────────────────
  log.section("3/5  Calculando delta…");
  let fileDiff = diffManifests(localFiles, remoteManifest.files);
  let assetDiff = diffManifests(localAssets, remoteManifest.assets);

  if (flush) {
    // Con --flush, todo es "create" (se archiva y recrea desde cero)
    log.warn("--flush activo: se archivará el remoto antes de recrear.");
    fileDiff = { create: localFiles.map((f) => ({ ...f })), update: [], unchanged: [], delete: remoteManifest.files };
    assetDiff = { create: localAssets.map((a) => ({ ...a })), update: [], unchanged: [], delete: remoteManifest.assets };
  }

  const filesToSync = [...fileDiff.create, ...fileDiff.update];
  const assetsToSync = [...assetDiff.create, ...assetDiff.update];

  log.info(`Archivos  →  crear: ${fileDiff.create.length}  actualizar: ${fileDiff.update.length}  sin cambios: ${fileDiff.unchanged.length}  eliminar: ${fileDiff.delete.length}`);
  log.info(`Assets    →  subir: ${assetsToSync.length}  sin cambios: ${assetDiff.unchanged.length}`);

  if (verbose) {
    for (const f of fileDiff.create) log.dim(`  + ${f.relPath}`);
    for (const f of fileDiff.update) log.dim(`  ~ ${f.relPath}`);
    for (const f of fileDiff.delete) log.dim(`  - ${f.relPath}`);
  }

  if (dryRun) {
    log.warn("Dry-run: finalizando sin cambios.");
    return;
  }

  // ─── 4. Archivar si --flush ─────────────────────────────────────────────────
  if (flush) {
    log.section("4/5  Archivando proyecto remoto (--flush)…");
    try {
      const snap = await client.archiveProject({ flush: true });
      log.ok(`Snapshot creado: ${snap.data?.snapshot_id || "(sin id)"}`);
    } catch (err) {
      log.error(`Error al archivar: ${err.message}`);
      process.exit(1);
    }
  } else {
    log.section("4/5  (sin --flush, no se archiva)");
  }

  // ─── 5. Subir assets nuevos/modificados ────────────────────────────────────
  log.section("5a  Subiendo assets…");
  /** @type {Record<string,string>} */
  const assetMap = {};

  // Poblar assetMap con assets ya en remoto y sin cambios
  for (const a of assetDiff.unchanged) {
    if (a.remoteUrl) assetMap[a.relPath] = a.remoteUrl;
  }

  let assetsOk = 0, assetsFail = 0;
  for (const asset of assetsToSync) {
    try {
      const result = await client.uploadAsset(asset.fullPath, asset.relPath);
      assetMap[asset.relPath] = result.data?.url || result.url || asset.relPath;
      assetsOk++;
      if (verbose) log.ok(`  asset: ${asset.relPath} → ${assetMap[asset.relPath]}`);
    } catch (err) {
      assetsFail++;
      log.warn(`  Asset fallido "${asset.relPath}": ${err.message}`);
    }
  }
  log.info(`Assets subidos: ${assetsOk}  fallidos: ${assetsFail}`);

  // ─── 6. Subir archivos .psmdoc ──────────────────────────────────────────────
  log.section("5b  Sincronizando archivos .psmdoc…");
  const fileOps = [];
  for (const f of filesToSync) {
    let content = fs.readFileSync(f.fullPath, "utf8");
    // Reescribir referencias de assets locales a URLs remotas
    if (Object.keys(assetMap).length) {
      content = rewriteAssetRefs(content, assetMap);
    }
    const { dirPath, name } = splitRelPath(f.relPath);
    fileOps.push({
      action: f.remoteId ? "update" : "create",
      relPath: f.relPath,
      name,
      dirPath,
      content,
      remoteId: f.remoteId || null,
    });
  }

  let filesOk = 0, filesFail = 0;
  if (fileOps.length) {
    try {
      const result = await client.applyFiles(fileOps);
      const summary = result.data || {};
      filesOk = (summary.created || []).length + (summary.updated || []).length;
      filesFail = (summary.errors || []).length;
      if (verbose && summary.errors?.length) {
        for (const e of summary.errors) log.warn(`  Error en "${e.relPath}": ${e.message}`);
      }
    } catch (err) {
      log.error(`Error al sincronizar archivos: ${err.message}`);
      filesFail = fileOps.length;
    }
  }
  log.info(`Archivos sincronizados: ${filesOk}  fallidos: ${filesFail}`);

  // ─── 7. Eliminar remotos obsoletos (solo --flush) ──────────────────────────
  if (flush && fileDiff.delete.length) {
    const ids = fileDiff.delete.filter((f) => f.id).map((f) => f.id);
    if (ids.length) {
      try {
        await client.deleteFiles(ids);
        log.info(`Archivos remotos eliminados: ${ids.length}`);
      } catch (err) {
        log.warn(`No se pudieron eliminar algunos archivos remotos: ${err.message}`);
      }
    }
  }

  // ─── 8. Versión ─────────────────────────────────────────────────────────────
  let finalVersion = currentVersion;
  if (versionArg) {
    try {
      const newVersion = resolveVersion(currentVersion, versionArg);
      const result = await client.setVersion(newVersion);
      finalVersion = result.data?.version || newVersion;
      log.ok(`Versión actualizada: ${currentVersion} → ${finalVersion}`);
    } catch (err) {
      log.warn(`No se pudo actualizar versión: ${err.message}`);
    }
  }

  // ─── Resumen final ──────────────────────────────────────────────────────────
  log.section("✔  Sincronización completa");
  console.log(`   Archivos .psmdoc  creados/actualizados: ${filesOk}   fallidos: ${filesFail}`);
  console.log(`   Assets subidos: ${assetsOk}   fallidos: ${assetsFail}`);
  console.log(`   Versión final: v${finalVersion}`);
  if (filesFail > 0 || assetsFail > 0) process.exitCode = 1;
};
