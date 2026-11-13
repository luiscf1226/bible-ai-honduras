// Deja los videos de la semana en una carpeta de Google Drive de Luis. De ahí
// los toma la publicación diaria (luiscf1226/short-video-studio), que los
// programa los días de app en TikTok, Instagram y YouTube Shorts.
//
// Cada video se sube como `bible-ai-sNN-<dia>-<id>.mp4`; ese nombre sin
// `.mp4` es el que usa Marca en textos/semana-NN.json de aquel repo.
//
// Sube con el OAuth de Luis (las cuentas de servicio no tienen cuota en un
// Drive personal). Todo llega por variables de entorno, sin archivos:
//
//   GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, GOOGLE_OAUTH_REFRESH_TOKEN
//   DRIVE_CARPETA_APPS   id de la carpeta "Videos de apps/Bible AI"
//
// Sin esas variables no sube nada y lo dice; el correo sigue igual.
import { readFileSync, statSync } from "node:fs";

const TOKEN = "https://oauth2.googleapis.com/token";
const FILES = "https://www.googleapis.com/drive/v3/files";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3/files";

export function driveConfig(env = process.env) {
  const values = {
    clientId: env.GOOGLE_OAUTH_CLIENT_ID?.trim(),
    clientSecret: env.GOOGLE_OAUTH_CLIENT_SECRET?.trim(),
    refreshToken: env.GOOGLE_OAUTH_REFRESH_TOKEN?.trim(),
    folder: env.DRIVE_CARPETA_APPS?.trim(),
  };
  return Object.values(values).every(Boolean) ? values : null;
}

export const canDrive = () => Boolean(driveConfig());

/** Nombre en Drive: `bible-ai-s07-mar-versiculo-isaias-41-10.mp4`. */
export const driveName = (numero, file) => `bible-ai-s${String(numero).padStart(2, "0")}-${file}`;

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

/** Nombres de los videos que ya están en la carpeta. */
async function existing(token, folder, fetchImpl) {
  const names = new Set();
  let pageToken;
  do {
    const params = new URLSearchParams({
      q: `'${folder}' in parents and trashed = false`,
      fields: "nextPageToken, files(name)",
      pageSize: "1000",
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true",
    });
    if (pageToken) params.set("pageToken", pageToken);
    const response = await check(await fetchImpl(`${FILES}?${params}`, { headers: { Authorization: `Bearer ${token}` } }), "listar la carpeta de Drive");
    const data = await response.json();
    for (const file of data.files ?? []) names.add(file.name);
    pageToken = data.nextPageToken;
  } while (pageToken);
  return names;
}

async function upload(token, folder, name, file, fetchImpl) {
  const start = await check(
    await fetchImpl(`${UPLOAD}?uploadType=resumable&supportsAllDrives=true`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": "video/mp4",
        "X-Upload-Content-Length": String(statSync(file).size),
      },
      body: JSON.stringify({ name, parents: [folder] }),
    }),
    `iniciar la subida de ${name}`,
  );
  await check(
    await fetchImpl(start.headers.get("location"), { method: "PUT", headers: { "Content-Type": "video/mp4" }, body: readFileSync(file) }),
    `subir ${name}`,
  );
}

/**
 * Sube los `videos` ({name, file}) que falten. `uploaded` son los nombres que
 * ya subió una corrida anterior; `sent(name)` se llama después de cada subida.
 * Si el video ya está en la carpeta (la caché se perdió), no se sube de nuevo.
 */
export async function uploadWeek({ numero, videos, uploaded = [], sent = () => {}, log = console.log, config = driveConfig(), fetchImpl = fetch }) {
  const pending = videos.filter(({ name }) => !uploaded.includes(name));
  if (pending.length === 0) return [];
  const token = await accessToken(config, fetchImpl);
  const there = await existing(token, config.folder, fetchImpl);
  const done = [];
  for (const { name, file } of pending) {
    const target = driveName(numero, name);
    if (there.has(target)) log(`Drive: ${target} ya estaba`);
    else {
      await upload(token, config.folder, target, file, fetchImpl);
      log(`Drive: subido ${target}`);
    }
    sent(name);
    done.push(target);
  }
  return done;
}
