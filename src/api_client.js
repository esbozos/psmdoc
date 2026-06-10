// @ts-check
/**
 * api_client.js — Cliente HTTP para el API de psmdoc remoto.
 *
 * Autenticación: X-Project-Id + X-Client-Secret en headers.
 * Requiere Node.js 18+ (fetch y FormData nativos).
 */

import fs from "fs";
import path from "path";

/**
 * @param {string} baseUrl     Ej: "https://psmdoc.gestionciudad.com"
 * @param {number|string} projectId
 * @param {string} clientSecret  project_key del proyecto
 */
export const createClient = (baseUrl, projectId, clientSecret) => {
  const base = baseUrl.replace(/\/$/, "");

  const authHeaders = () => ({
    "X-Project-Id": String(projectId),
    "X-Client-Secret": clientSecret,
  });

  /**
   * POST JSON a un endpoint.
   * @param {string} endpoint  Ej: "/api/project/sync/manifest/"
   * @param {object} body
   */
  const post = async (endpoint, body = {}) => {
    const res = await fetch(`${base}${endpoint}`, {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(
        `API ${endpoint} → ${res.status}: ${data.error || JSON.stringify(data)}`
      );
    }
    return data;
  };

  /**
   * Obtiene el manifiesto remoto (lista de archivos con hash).
   * @returns {Promise<{ files: Array, assets: Array }>}
   */
  const getManifest = () => post("/api/project/sync/manifest/");

  /**
   * Crea o actualiza archivos de texto (.psmdoc) en el proyecto remoto.
   * @param {Array<{ action: "create"|"update", relPath: string, name: string, dirPath: string, content: string, remoteId?: number }>} fileOps
   * @returns {Promise<object>}
   */
  const applyFiles = (fileOps) => post("/api/project/sync/apply/", { files: fileOps });

  /**
   * Elimina archivos remotos por id.
   * @param {number[]} ids
   */
  const deleteFiles = (ids) => post("/api/project/sync/delete/", { ids });

  /**
   * Sube un asset (imagen, PDF, audio, etc.) al proyecto remoto.
   * @param {string} localFilePath  Ruta local completa del archivo
   * @param {string} relPath        Ruta relativa dentro del proyecto (ej. "images/logo.png")
   * @returns {Promise<{ url: string, relPath: string }>}
   */
  const uploadAsset = async (localFilePath, relPath) => {
    const form = new FormData();
    const fileBytes = fs.readFileSync(localFilePath);
    const blob = new Blob([fileBytes]);
    const filename = path.basename(localFilePath);
    form.append("file", blob, filename);
    form.append("rel_path", relPath);

    const res = await fetch(`${base}/api/project/sync/upload-asset/`, {
      method: "POST",
      headers: authHeaders(),
      body: form,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(
        `Asset upload "${relPath}" → ${res.status}: ${data.error || JSON.stringify(data)}`
      );
    }
    return data;
  };

  /**
   * Archiva el proyecto actual (snapshot) y opcionalmente lo resetea.
   * @param {{ flush?: boolean }} opts
   */
  const archiveProject = (opts = {}) =>
    post("/api/project/sync/archive/", { flush: opts.flush || false });

  /**
   * Establece la versión del proyecto.
   * @param {string} version  "1.1.0" o "+" para bump patch
   */
  const setVersion = (version) => post("/api/project/sync/version/", { version });

  return { getManifest, applyFiles, deleteFiles, uploadAsset, archiveProject, setVersion };
};
