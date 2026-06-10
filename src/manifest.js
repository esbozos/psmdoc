// @ts-check
/**
 * manifest.js — Genera checksums SHA-256 de todos los archivos .psmdoc y assets
 * de un directorio local. Se usa para comparar con el manifiesto remoto y calcular
 * el delta de sincronización (archivos creados/modificados/sin cambios).
 */

import crypto from "crypto";
import fs from "fs";
import path from "path";

const SKIP_DIRS = new Set([".git", "node_modules", "build", ".cache", ".psmdoc_cache"]);

const PSMDOC_EXT = ".psmdoc";

const ASSET_EXTS = new Set([
  ".jpg", ".jpeg", ".png", ".gif", ".webp",
  ".svg", ".pdf",
  ".mp3", ".mp4", ".wav", ".ogg",
]);

/**
 * Calcula el hash SHA-256 de un archivo.
 * @param {string} filePath
 * @returns {string}
 */
export const computeFileHash = (filePath) => {
  const content = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(content).digest("hex");
};

/**
 * Recorre recursivamente el directorio y recolecta archivos .psmdoc y assets.
 * @param {string} rootDir
 * @returns {{ files: Array<{relPath:string,fullPath:string,hash:string}>, assets: Array<{relPath:string,fullPath:string,hash:string}> }}
 */
export const buildManifest = (rootDir) => {
  const files = [];
  const assets = [];

  const walk = (dir, relBase = "") => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (SKIP_DIRS.has(entry.name)) continue;
      const fullPath = path.join(dir, entry.name);
      const relPath = relBase ? `${relBase}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        walk(fullPath, relPath);
      } else {
        const ext = path.extname(entry.name).toLowerCase();
        const hash = computeFileHash(fullPath);
        if (ext === PSMDOC_EXT) {
          files.push({ relPath, fullPath, hash });
        } else if (ASSET_EXTS.has(ext)) {
          assets.push({ relPath, fullPath, hash });
        }
      }
    }
  };

  walk(rootDir);
  return { files, assets };
};

/**
 * Calcula el delta entre el manifiesto local y el remoto.
 * @param {Array<{relPath:string,hash:string}>} local  - archivos locales
 * @param {Array<{relPath:string,hash:string,id?:number}>} remote - archivos remotos
 * @returns {{ create: Array, update: Array, unchanged: Array, delete: Array }}
 *   create/update: items del local. delete: items del remote. unchanged: items del remote con mismo hash.
 */
export const diffManifests = (local, remote) => {
  const remoteMap = new Map(remote.map((r) => [r.relPath, r]));
  const localSet = new Set(local.map((l) => l.relPath));

  const create = [];
  const update = [];
  const unchanged = [];

  for (const localItem of local) {
    const remoteItem = remoteMap.get(localItem.relPath);
    if (!remoteItem) {
      create.push(localItem);
    } else if (remoteItem.hash !== localItem.hash) {
      update.push({ ...localItem, remoteId: remoteItem.id });
    } else {
      unchanged.push(localItem);
    }
  }

  const toDelete = remote.filter((r) => !localSet.has(r.relPath));

  return { create, update, unchanged, delete: toDelete };
};
