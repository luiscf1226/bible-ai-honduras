#!/usr/bin/env node
// Envía a App Review la versión de app.json con el último build subido por EAS.
// Lo corre .github/workflows/release.yml después de `eas build --auto-submit`.
//
// Pasos: espera a que Apple termine de procesar el build, crea (o reutiliza) la
// versión de App Store, le asigna el build, completa "Novedades" y los datos de
// revisión si faltan, y la manda a revisión. El lanzamiento queda MANUAL: una
// versión aprobada no se publica sola.
//
// Variables: ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_P8 (contenido del .p8),
// opcionales NOVEDADES y BUILD_NUMBER. Con DRY_RUN=1 solo informa.

import { createPrivateKey, sign } from "node:crypto";
import { readFileSync } from "node:fs";

const APP_ID = "6807627270";
const API = "https://api.appstoreconnect.apple.com";
const EDITABLE = new Set([
  "PREPARE_FOR_SUBMISSION",
  "DEVELOPER_REJECTED",
  "REJECTED",
  "METADATA_REJECTED",
  "INVALID_BINARY",
]);
const PROCESSING_TIMEOUT_MS = 90 * 60 * 1000;
const POLL_MS = 60 * 1000;

const version = JSON.parse(readFileSync(new URL("../app.json", import.meta.url), "utf8")).expo.version;
const buildNumber = process.env.BUILD_NUMBER?.trim() || null;
const dryRun = process.env.DRY_RUN === "1";
const whatsNew =
  process.env.NOVEDADES?.trim() || "Mejoras de estabilidad y correcciones para tu lectura diaria.";

const key = createPrivateKey(requiredEnv("ASC_KEY_P8"));
const keyId = requiredEnv("ASC_KEY_ID");
const issuer = requiredEnv("ASC_ISSUER_ID");

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Falta la variable ${name}`);
  return value;
}

function base64url(input) {
  return Buffer.from(input).toString("base64url");
}

function token() {
  const header = base64url(JSON.stringify({ alg: "ES256", kid: keyId, typ: "JWT" }));
  const payload = base64url(
    JSON.stringify({ iss: issuer, aud: "appstoreconnect-v1", exp: Math.floor(Date.now() / 1000) + 15 * 60 }),
  );
  const signature = sign("sha256", Buffer.from(`${header}.${payload}`), { key, dsaEncoding: "ieee-p1363" });
  return `${header}.${payload}.${base64url(signature)}`;
}

async function api(method, path, body) {
  const response = await fetch(API + path, {
    method,
    headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  const json = text ? JSON.parse(text) : {};
  if (!response.ok) throw new Error(`${method} ${path} → ${response.status} ${JSON.stringify(json.errors ?? json)}`);
  return json;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForBuild() {
  const filter = buildNumber
    ? `filter[version]=${encodeURIComponent(buildNumber)}`
    : `filter[preReleaseVersion.version]=${encodeURIComponent(version)}`;
  const deadline = Date.now() + PROCESSING_TIMEOUT_MS;
  for (;;) {
    const { data } = await api("GET", `/v1/builds?filter[app]=${APP_ID}&${filter}&sort=-uploadedDate&limit=1`);
    const build = data[0];
    const state = build?.attributes.processingState;
    if (state === "VALID") return build;
    if (state === "FAILED" || state === "INVALID") throw new Error(`Apple rechazó el build ${build.attributes.version}: ${state}`);
    if (Date.now() > deadline) throw new Error("Apple no terminó de procesar el build a tiempo.");
    console.log(`Esperando build de ${version} en App Store Connect (${state ?? "todavía no aparece"})…`);
    await sleep(POLL_MS);
  }
}

async function versions() {
  const { data } = await api("GET", `/v1/apps/${APP_ID}/appStoreVersions?filter[platform]=IOS&limit=50`);
  return data;
}

async function findOrCreateVersion(all) {
  const same = all.find((v) => v.attributes.versionString === version);
  if (same) {
    if (!EDITABLE.has(same.attributes.appStoreState)) {
      throw new Error(`La versión ${version} está en ${same.attributes.appStoreState}; no se puede cambiar su build.`);
    }
    return same;
  }
  const editable = all.find((v) => EDITABLE.has(v.attributes.appStoreState));
  if (editable) {
    console.log(`Renombrando la versión editable ${editable.attributes.versionString} a ${version}.`);
    if (dryRun) return editable;
    const { data } = await api("PATCH", `/v1/appStoreVersions/${editable.id}`, {
      data: { type: "appStoreVersions", id: editable.id, attributes: { versionString: version } },
    });
    return data;
  }
  console.log(`Creando la versión ${version} en App Store Connect.`);
  if (dryRun) return null;
  const { data } = await api("POST", "/v1/appStoreVersions", {
    data: {
      type: "appStoreVersions",
      attributes: { platform: "IOS", versionString: version, releaseType: "MANUAL" },
      relationships: { app: { data: { type: "apps", id: APP_ID } } },
    },
  });
  return data;
}

async function ensureReviewDetail(target, all) {
  const current = await api("GET", `/v1/appStoreVersions/${target.id}/appStoreReviewDetail`).catch(() => null);
  if (current?.data) return;
  const source = all.filter((v) => v.id !== target.id).sort((a, b) => b.attributes.createdDate.localeCompare(a.attributes.createdDate));
  for (const previous of source) {
    const detail = await api("GET", `/v1/appStoreVersions/${previous.id}/appStoreReviewDetail`).catch(() => null);
    if (!detail?.data) continue;
    console.log(`Copiando los datos de revisión de la versión ${previous.attributes.versionString}.`);
    if (dryRun) return;
    await api("POST", "/v1/appStoreReviewDetails", {
      data: {
        type: "appStoreReviewDetails",
        attributes: detail.data.attributes,
        relationships: { appStoreVersion: { data: { type: "appStoreVersions", id: target.id } } },
      },
    });
    return;
  }
  throw new Error("No hay datos de revisión (cuenta demo, contacto) para copiar.");
}

async function setWhatsNew(target, all) {
  // "Novedades" solo existe a partir de la segunda versión publicada.
  if (!all.some((v) => v.attributes.appStoreState === "READY_FOR_SALE")) return;
  const { data } = await api("GET", `/v1/appStoreVersions/${target.id}/appStoreVersionLocalizations`);
  for (const localization of data) {
    console.log(`Novedades (${localization.attributes.locale}): ${whatsNew}`);
    if (dryRun) continue;
    await api("PATCH", `/v1/appStoreVersionLocalizations/${localization.id}`, {
      data: { type: "appStoreVersionLocalizations", id: localization.id, attributes: { whatsNew } },
    });
  }
}

async function submit(target) {
  const { data: submissions } = await api(
    "GET",
    `/v1/reviewSubmissions?filter[app]=${APP_ID}&filter[platform]=IOS&limit=20`,
  );
  const active = submissions.find((s) => ["WAITING_FOR_REVIEW", "IN_REVIEW"].includes(s.attributes.state));
  if (active) {
    throw new Error(
      `Ya hay un envío en revisión (${active.attributes.state}). El build quedó en TestFlight; ` +
        "mandalo a revisión cuando Apple responda el envío actual.",
    );
  }
  if (dryRun) {
    console.log("DRY_RUN: no se envía a revisión.");
    return;
  }
  const unresolved = submissions.find((s) => s.attributes.state === "UNRESOLVED_ISSUES");
  const draft = unresolved ?? submissions.find((s) => s.attributes.state === "READY_FOR_REVIEW");
  const submission =
    draft ??
    (
      await api("POST", "/v1/reviewSubmissions", {
        data: {
          type: "reviewSubmissions",
          attributes: { platform: "IOS" },
          relationships: { app: { data: { type: "apps", id: APP_ID } } },
        },
      })
    ).data;
  // Sin include, Apple omite el vínculo y no se puede identificar la versión.
  const items = await api("GET", `/v1/reviewSubmissions/${submission.id}/items?include=appStoreVersion&limit=200`);
  console.log(`Elementos del envío: ${JSON.stringify(items.data.map((item) => ({
    id: item.id,
    state: item.attributes.state,
    versionId: item.relationships?.appStoreVersion?.data?.id ?? null,
  })))}`);
  if (items.links?.next) throw new Error("La lista de elementos está incompleta; no se enviará una revisión parcial.");
  if (unresolved) {
    const matching = items.data.find((item) => item.relationships?.appStoreVersion?.data?.id === target.id);
    if (!matching) {
      throw new Error(`No se encontró el vínculo de la versión ${target.id} en el envío rechazado ${submission.id}.`);
    }
    if (items.data.some((item) => item.id !== matching.id && item.attributes.state !== "ACCEPTED")) {
      throw new Error("El envío rechazado contiene otros elementos pendientes; no se marcarán como resueltos automáticamente.");
    }
    console.log(`Marcando como corregido el elemento ${matching.id} con el nuevo build.`);
    await api("PATCH", `/v1/reviewSubmissionItems/${matching.id}`, {
      data: { type: "reviewSubmissionItems", id: matching.id, attributes: { resolved: true } },
    });
  }
  if (items.data.length === 0) {
    await api("POST", "/v1/reviewSubmissionItems", {
      data: {
        type: "reviewSubmissionItems",
        relationships: {
          reviewSubmission: { data: { type: "reviewSubmissions", id: submission.id } },
          appStoreVersion: { data: { type: "appStoreVersions", id: target.id } },
        },
      },
    });
  }
  await api("PATCH", `/v1/reviewSubmissions/${submission.id}`, {
    data: { type: "reviewSubmissions", id: submission.id, attributes: { submitted: true } },
  });
  const { data: confirmed } = await api("GET", `/v1/reviewSubmissions/${submission.id}`);
  if (!["WAITING_FOR_REVIEW", "IN_REVIEW"].includes(confirmed.attributes.state)) {
    throw new Error(`El envío no quedó en revisión: ${confirmed.attributes.state}`);
  }
  console.log(`Estado confirmado: ${confirmed.attributes.state}.`);
}

const build = await waitForBuild();
console.log(`Build ${build.attributes.version} (${version}) listo en App Store Connect.`);
const all = await versions();
const target = await findOrCreateVersion(all);
if (target) {
  if (!dryRun) {
    await api("PATCH", `/v1/appStoreVersions/${target.id}`, {
      data: { type: "appStoreVersions", id: target.id, attributes: { releaseType: "MANUAL" } },
    });
    await api("PATCH", `/v1/appStoreVersions/${target.id}/relationships/build`, {
      data: { type: "builds", id: build.id },
    });
  }
  await setWhatsNew(target, all);
  await ensureReviewDetail(target, all);
  await submit(target);
}
console.log(dryRun ? "DRY_RUN terminado." : `Versión ${version} (build ${build.attributes.version}) enviada a App Review.`);
