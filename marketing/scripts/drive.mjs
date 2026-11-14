// Deja los videos de la semana en una carpeta de Google Drive de Luis. De ahí
// los toma la publicación diaria (luiscf1226/short-video-studio), que los
// programa los días de app en TikTok, Instagram y YouTube Shorts.
//
// Cada video se sube como `bible-ai-<fecha>-<dia>-<id>.mp4`, con la fecha para
// la que se hizo: la publicación diaria lo saca ese día. Ese nombre sin `.mp4`
// es el que usa Marca en textos/semana-NN.json de aquel repo.
//
// Sube con el OAuth de Luis, pero con el permiso mínimo (`drive.file`): solo
// ve y toca lo que este script creó. Por eso la carpeta la crea el script la
// primera vez («Bible AI · videos para publicar», en la raíz del Drive); Luis
// la comparte como Lector con la cuenta de servicio de la publicación diaria.
// Todo llega por variables de entorno:
//
//   GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, GOOGLE_OAUTH_REFRESH_TOKEN
//   DRIVE_CARPETA_APPS   opcional: otro nombre de carpeta
//
// Sin las tres primeras no sube nada y lo dice; el correo sigue igual.
import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";

const TOKEN = "https://oauth2.googleapis.com/token";
const FILES = "https://www.googleapis.com/drive/v3/files";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3/files";
const FOLDER = "application/vnd.google-apps.folder";
export const DEFAULT_FOLDER = "Bible AI · videos para publicar";

export function driveConfig(env = process.env) {
  const values = {
    clientId: env.GOOGLE_OAUTH_CLIENT_ID?.trim(),
    clientSecret: env.GOOGLE_OAUTH_CLIENT_SECRET?.trim(),
    refreshToken: env.GOOGLE_OAUTH_REFRESH_TOKEN?.trim(),
  };
  if (!Object.values(values).every(Boolean)) return null;
  return { ...values, folderName: env.DRIVE_CARPETA_APPS?.trim() || DEFAULT_FOLDER };
}

export const canDrive = () => Boolean(driveConfig());

/** Nombre en Drive: `bible-ai-2026-11-17-mar-versiculo-isaias-41-10.mp4`. */
export const driveName = (fecha, file) => `bible-ai-${fecha}-${file}`;

/** Huella del contenido: si una semana se rehace, el video cambia y se reemplaza. */
export const fingerprint = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");

async function check(response, what) {
  if (response.ok) return response;
  // Sin el cuerpo completo: puede traer datos de la cuenta.
  const body = (await response.text()).slice(0, 200);
  throw new Error(`${what}: HTTP ${response.status} ${body}`);
}

async function accessToken(config, fetchImpl) {
  const response = await check(
    await fetchImpl(TOKEN, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        refresh_token: config.refreshToken,
        grant_type: "refresh_token",
      }),
    }),
    "Google no renovó el token (¿caducó el refresh token?)",
  );
  return (await response.json()).access_token;
}

const quote = (text) => text.replace(/\\/g, "\\\\").replace(/'/g, "\\'");

async function list(token, q, fetchImpl) {
  const files = [];
  let pageToken;
  do {
    const params = new URLSearchParams({ q, fields: "nextPageToken, files(id, name)", pageSize: "1000" });
    if (pageToken) params.set("pageToken", pageToken);
    const response = await check(await fetchImpl(`${FILES}?${params}`, { headers: { Authorization: `Bearer ${token}` } }), "listar Drive");
    const data = await response.json();
    files.push(...(data.files ?? []));
    pageToken = data.nextPageToken;
  } while (pageToken);
  return files;
}

/** La carpeta del script (con `drive.file` solo se ven las que creó él); la crea si falta. */
async function folderId(token, name, fetchImpl) {
  const found = await list(token, `name = '${quote(name)}' and mimeType = '${FOLDER}' and trashed = false`, fetchImpl);
  if (found.length) return found[0].id;
  const response = await check(
    await fetchImpl(FILES, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json; charset=UTF-8" },
      body: JSON.stringify({ name, mimeType: FOLDER }),
    }),
    `crear la carpeta ${name}`,
  );
  return (await response.json()).id;
}

async function upload(token, folder, name, file, fetchImpl, existingId) {
  // Nuevo: crea el archivo en la carpeta. Existente: reemplaza su contenido y
  // conserva el id, así la URL que ya tiene la publicación diaria sigue sirviendo.
  const url = existingId ? `${UPLOAD}/${existingId}?uploadType=resumable` : `${UPLOAD}?uploadType=resumable`;
  const start = await check(
    await fetchImpl(url, {
      method: existingId ? "PATCH" : "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": "video/mp4",
        "X-Upload-Content-Length": String(statSync(file).size),
      },
      body: JSON.stringify(existingId ? {} : { name, parents: [folder] }),
    }),
    `iniciar la subida de ${name}`,
  );
  await check(
    await fetchImpl(start.headers.get("location"), { method: "PUT", headers: { "Content-Type": "video/mp4" }, body: readFileSync(file) }),
    `subir ${name}`,
  );
}

/**
 * Sube los `videos` ({name, file, fecha}) nuevos o que cambiaron. `uploaded`
 * es {name: huella} de corridas anteriores; `sent(name, huella)` se llama
 * después de cada subida. Si el archivo ya está en la carpeta (la caché se
 * perdió) y no hay registro, no se sube de nuevo. Un video con fecha hasta
 * `lockedThrough` (AAAA-MM-DD) que ya está en Drive no se reemplaza: puede
 * estar programado y a punto de salir.
 */
export async function uploadWeek({ videos, uploaded = {}, lockedThrough = "", sent = () => {}, log = console.log, config = driveConfig(), fetchImpl = fetch }) {
  const pending = videos.map((video) => ({ ...video, hash: fingerprint(video.file) })).filter(({ name, hash }) => uploaded[name] !== hash);
  if (pending.length === 0) return [];
  const token = await accessToken(config, fetchImpl);
  const folder = await folderId(token, config.folderName, fetchImpl);
  const there = new Map((await list(token, `'${folder}' in parents and trashed = false`, fetchImpl)).map((f) => [f.name, f.id]));
  const done = [];
  for (const { name, file, fecha, hash } of pending) {
    const target = driveName(fecha, name);
    const existingId = there.get(target);
    if (existingId && !(name in uploaded)) log(`Drive: ${target} ya estaba`);
    else if (existingId && fecha <= lockedThrough) {
      log(`Drive: ${target} cambió, pero sale ${fecha} y ya puede estar programado; se deja el que estaba`);
      continue;
    } else {
      await upload(token, folder, target, file, fetchImpl, existingId);
      log(`Drive: ${existingId ? "reemplazado" : "subido"} ${target}`);
    }
    sent(name, hash);
    done.push(target);
  }
  return done;
}
