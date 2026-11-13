// Pruebas de scripts/drive.mjs sin red: un `fetch` falso hace de Google Drive.
//   npm test            (desde marketing/)
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { DEFAULT_FOLDER, driveConfig, driveName, fingerprint, uploadWeek } from "./drive.mjs";

const dir = mkdtempSync(join(tmpdir(), "drive-test-"));
after(() => rmSync(dir, { recursive: true, force: true }));

const config = { clientId: "id", clientSecret: "secreto", refreshToken: "refresh", folderName: DEFAULT_FOLDER };

function video(name, contenido, fecha = "2026-11-17") {
  const file = join(dir, name);
  writeFileSync(file, contenido);
  return { name, file, fecha };
}

/** Un Drive en memoria: guarda carpetas y archivos, y anota cada llamada. */
function fakeDrive({ tokenStatus = 200 } = {}) {
  const files = new Map(); // id -> {name, parents, mimeType, body}
  const calls = [];
  let next = 1;
  const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers });
  const fetchImpl = async (url, init = {}) => {
    const method = init.method ?? "GET";
    calls.push(`${method} ${url}`);
    const u = new URL(url);
    if (u.hostname === "oauth2.googleapis.com") {
      return tokenStatus === 200 ? json({ access_token: "tok" }) : json({ error: "invalid_grant" }, tokenStatus);
    }
    assert.equal(init.headers?.Authorization ?? "Bearer tok", "Bearer tok");
    if (u.pathname === "/drive/v3/files" && method === "GET") {
      const q = u.searchParams.get("q");
      const parent = q.match(/^'([^']+)' in parents/)?.[1];
      const name = q.match(/^name = '((?:[^'\\]|\\.)*)'/)?.[1]?.replace(/\\(.)/g, "$1");
      const found = [...files].filter(([, f]) => (parent ? f.parents?.includes(parent) : f.name === name)).map(([id, f]) => ({ id, name: f.name }));
      return json({ files: found });
    }
    if (u.pathname === "/drive/v3/files" && method === "POST") {
      const id = `f${next++}`;
      files.set(id, JSON.parse(init.body));
      return json({ id });
    }
    if (u.pathname.startsWith("/upload/drive/v3/files")) {
      const existing = u.pathname.split("/")[5];
      const id = existing ?? `f${next++}`;
      if (!existing) files.set(id, JSON.parse(init.body));
      return json({}, 200, { location: `https://upload.example/session/${id}` });
    }
    if (u.hostname === "upload.example") {
      files.get(u.pathname.split("/").pop()).body = Buffer.from(init.body).toString();
      return json({});
    }
    throw new Error(`llamada inesperada: ${method} ${url}`);
  };
  return { files, calls, fetchImpl };
}

const quiet = () => {};

test("crea su carpeta y sube cada video con la fecha en el nombre", async () => {
  const drive = fakeDrive();
  const v = video("mar-versiculo-isaias-41-10.mp4", "uno");
  const sent = {};
  const done = await uploadWeek({ videos: [v], config, fetchImpl: drive.fetchImpl, log: quiet, sent: (n, h) => (sent[n] = h) });
  assert.deepEqual(done, ["bible-ai-2026-11-17-mar-versiculo-isaias-41-10.mp4"]);
  const [folder] = [...drive.files.values()].filter((f) => f.mimeType === "application/vnd.google-apps.folder");
  assert.equal(folder.name, DEFAULT_FOLDER);
  const subido = [...drive.files.values()].find((f) => f.name === done[0]);
  assert.equal(subido.body, "uno");
  assert.equal(sent[v.name], fingerprint(v.file));
});

test("una segunda corrida con el mismo estado no llama a Google", async () => {
  const drive = fakeDrive();
  const v = video("mie-pregunta.mp4", "dos");
  const done = await uploadWeek({ videos: [v], uploaded: { [v.name]: fingerprint(v.file) }, config, fetchImpl: drive.fetchImpl, log: quiet });
  assert.deepEqual(done, []);
  assert.equal(drive.calls.length, 0);
});

test("si se perdió el estado, no duplica lo que ya está en la carpeta", async () => {
  const drive = fakeDrive();
  const v = video("jue-personaje.mp4", "tres");
  await uploadWeek({ videos: [v], config, fetchImpl: drive.fetchImpl, log: quiet });
  const antes = drive.files.size;
  const logs = [];
  await uploadWeek({ videos: [v], config, fetchImpl: drive.fetchImpl, log: (l) => logs.push(l) });
  assert.equal(drive.files.size, antes);
  assert.match(logs.join("\n"), /ya estaba/);
});

test("un video que cambió se reemplaza conservando el id", async () => {
  const drive = fakeDrive();
  const v = video("vie-historia.mp4", "viejo", "2099-01-01");
  const uploaded = {};
  await uploadWeek({ videos: [v], uploaded, config, fetchImpl: drive.fetchImpl, log: quiet, sent: (n, h) => (uploaded[n] = h) });
  const [id] = [...drive.files].find(([, f]) => f.name === driveName(v.fecha, v.name));
  writeFileSync(v.file, "nuevo");
  await uploadWeek({ videos: [v], uploaded, lockedThrough: "2026-11-14", config, fetchImpl: drive.fetchImpl, log: quiet, sent: (n, h) => (uploaded[n] = h) });
  assert.equal(drive.files.get(id).body, "nuevo");
  assert.equal([...drive.files.values()].filter((f) => f.name === driveName(v.fecha, v.name)).length, 1);
  assert.ok(drive.calls.some((c) => c.startsWith(`PATCH https://www.googleapis.com/upload/drive/v3/files/${id}`)));
});

test("no reemplaza lo que sale hoy o mañana", async () => {
  const drive = fakeDrive();
  const v = video("sab-monologo.mp4", "viejo", "2026-11-14");
  const uploaded = {};
  await uploadWeek({ videos: [v], uploaded, config, fetchImpl: drive.fetchImpl, log: quiet, sent: (n, h) => (uploaded[n] = h) });
  const hashViejo = uploaded[v.name];
  writeFileSync(v.file, "nuevo");
  const logs = [];
  const done = await uploadWeek({ videos: [v], uploaded, lockedThrough: "2026-11-14", config, fetchImpl: drive.fetchImpl, log: (l) => logs.push(l), sent: (n, h) => (uploaded[n] = h) });
  assert.deepEqual(done, []);
  assert.equal([...drive.files.values()].find((f) => f.name === driveName(v.fecha, v.name)).body, "viejo");
  assert.equal(uploaded[v.name], hashViejo, "no marca como subido lo que no subió");
  assert.match(logs.join("\n"), /se deja el que estaba/);
});

test("valida la configuración: sin las tres variables no hay Drive", () => {
  assert.equal(driveConfig({}), null);
  assert.equal(driveConfig({ GOOGLE_OAUTH_CLIENT_ID: "a", GOOGLE_OAUTH_CLIENT_SECRET: "b", GOOGLE_OAUTH_REFRESH_TOKEN: "  " }), null);
  const ok = driveConfig({ GOOGLE_OAUTH_CLIENT_ID: " a ", GOOGLE_OAUTH_CLIENT_SECRET: "b", GOOGLE_OAUTH_REFRESH_TOKEN: "c" });
  assert.deepEqual(ok, { clientId: "a", clientSecret: "b", refreshToken: "c", folderName: DEFAULT_FOLDER });
  assert.equal(driveConfig({ GOOGLE_OAUTH_CLIENT_ID: "a", GOOGLE_OAUTH_CLIENT_SECRET: "b", GOOGLE_OAUTH_REFRESH_TOKEN: "c", DRIVE_CARPETA_APPS: "Otra" }).folderName, "Otra");
});

test("un token caducado da un error claro", async () => {
  const drive = fakeDrive({ tokenStatus: 400 });
  const v = video("dom-presentacion.mp4", "siete");
  await assert.rejects(uploadWeek({ videos: [v], config, fetchImpl: drive.fetchImpl, log: quiet }), /caducó el refresh token.*HTTP 400/);
});
