// Manda la semana por correo en un solo hilo: el primer mensaje con todas las
// captions cortas y cada video como respuesta, con su caption lista para
// copiar. Así se publica desde el teléfono: abrís el hilo, guardás el video
// del día y pegás el texto.
//
// La cuenta y la contraseña de aplicación de Gmail viven fuera del repo, en
// ~/.config/3c-videos/correo.env (chmod 600):
//
//   CORREO_USUARIO=tu-cuenta@gmail.com
//   CORREO_CLAVE=<contraseña de aplicación, https://myaccount.google.com/apppasswords>
//   CORREO_PARA=a-quien-le-llega@gmail.com   (si falta, a CORREO_USUARIO)
//
// En GitHub Actions llegan como variables de entorno con esos mismos nombres
// (secretos del environment "videos"), y mandan sobre el archivo.
import { execFileSync } from "node:child_process";
import { resolve4 } from "node:dns/promises";
import { existsSync, readFileSync, rmSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import nodemailer from "nodemailer";

const CONFIG = join(homedir(), ".config/3c-videos/correo.env");

function config() {
  const file = existsSync(CONFIG)
    ? Object.fromEntries(
        readFileSync(CONFIG, "utf8")
          .split("\n")
          .map((line) => line.match(/^(CORREO_[A-Z]+)=(.*)$/))
          .filter(Boolean)
          .map(([, key, value]) => [key, value.trim()]),
      )
    : {};
  const values = Object.fromEntries(["CORREO_USUARIO", "CORREO_CLAVE", "CORREO_PARA"].map((key) => [key, process.env[key]?.trim() || file[key]]));
  if (!values.CORREO_USUARIO || !values.CORREO_CLAVE) return null;
  return { user: values.CORREO_USUARIO, pass: values.CORREO_CLAVE.replace(/\s/g, ""), to: values.CORREO_PARA || values.CORREO_USUARIO };
}

export const canMail = () => Boolean(config());

// Gmail acepta hasta 25 MB por mensaje y el adjunto crece un tercio al
// codificarse: un video más grande va en una copia más liviana.
const MAX_BYTES = 17.5e6;

function attachable(file, scratch) {
  if (statSync(file).size <= MAX_BYTES) return file;
  const seconds = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file], { encoding: "utf8" }));
  const videoKbps = Math.floor((MAX_BYTES * 8 * 0.92) / seconds / 1000) - 192;
  const out = join(scratch, `correo-${file.split("/").at(-1)}`);
  execFileSync("ffmpeg", [
    "-v",
    "error",
    "-y",
    "-i",
    file,
    "-c:v",
    "libx264",
    "-b:v",
    `${videoKbps}k`,
    "-maxrate",
    `${videoKbps}k`,
    "-bufsize",
    `${videoKbps * 2}k`,
    "-preset",
    "medium",
    "-c:a",
    "copy",
    out,
  ]);
  return out;
}

/**
 * Manda `{ subject, summary, videos: [{ file, text }] }` en un hilo: primero
 * el resumen (si `thread` es null) y después un mensaje por video.
 * `on.started(messageId)` y `on.sent(video)` guardan el avance, así un corte
 * a la mitad sigue en el mismo hilo. Sin ~/.config/3c-videos/correo.env, nada.
 */
export async function mailWeek({ thread, subject, summary, videos }, scratch, on) {
  const settings = config();
  if (!settings) return;
  const base = { from: `"Videos de 3C" <${settings.user}>`, to: settings.to, subject };
  let root = thread;
  if (!root) {
    root = await send(settings, { ...base, text: summary });
    on.started(root);
  }
  for (const video of videos) {
    const path = attachable(video.file, scratch);
    await send(settings, { ...base, inReplyTo: root, references: [root], text: video.text, attachments: [{ filename: video.name, path }] });
    if (path !== video.file) rmSync(path);
    on.sent(video);
  }
}

/**
 * Por IPv4: esta máquina no tiene ruta IPv6 y Gmail a veces resuelve a IPv6
 * (ENETUNREACH). Una caída de red se reintenta.
 */
async function send(settings, mail, attempt = 1) {
  try {
    const [address] = await resolve4("smtp.gmail.com");
    const transport = nodemailer.createTransport({
      host: address,
      port: 465,
      secure: true,
      tls: { servername: "smtp.gmail.com" },
      auth: { user: settings.user, pass: settings.pass },
    });
    try {
      return (await transport.sendMail(mail)).messageId;
    } finally {
      transport.close();
    }
  } catch (error) {
    if (attempt >= 4 || error.responseCode) throw error;
    await new Promise((done) => setTimeout(done, 15_000 * attempt));
    return send(settings, mail, attempt + 1);
  }
}
