// Escenario de QA: se elige por query string, p. ej. ?qa=pro o ?qa=limit
export function scenario() {
  if (typeof window === "undefined") return "free";
  const value = new URLSearchParams(window.location.search).get("qa");
  return value || "free";
}

// Compra simulada del modo de prueba (EXPO_PUBLIC_PAYMENTS_MODE=test): vive
// en memoria hasta recargar la página.
let testPro = false;
export function grantTestPro() {
  testPro = true;
}

export function isPro() {
  return scenario() === "pro" || testPro;
}

export function atLimit() {
  return scenario() === "limit" && !testPro;
}

export function isLoading() {
  return scenario() === "loading";
}

export function isEmpty() {
  return scenario() === "empty";
}

export function isError() {
  return scenario() === "error";
}

export function isDark() {
  return scenario() === "dark";
}

// Temporada (#199): ?temporada=reforma | gratitud | adviento | anio-nuevo. Se combina con
// ?qa=dark para la paleta de noche. Sin el parámetro, fuera de temporada.
export function seasonScenario() {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("temporada");
}

// Sin conexión (#160, #182): `?net=off`. Las queries quedan cargando y las
// mutaciones no vuelven, como con el cliente real de Convex sin red.
export function isOffline() {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("net") === "off";
}

// Plan anual empezado (para ver marcar el día): `?plan=1`.
export function hasPlan() {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("plan") === "1";
}

// Crear imagen: `?ia=sin-saldo` (OpenAI sin saldo) o `?ia=lista` (la cita ya
// tiene fondo con IA). Sin el parámetro, la cita no tiene y se puede pintar.
export function aiImageScenario() {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("ia");
}

// Videos de marketing/: `marketing/capture` inyecta en
// `window.__QA_VIDEO__` la respuesta real que se pegó para ese video (de
// Preguntar o de Voces) y cuánto tarda en llegar. Sin eso, nada cambia.
export function videoContent() {
  if (typeof window === "undefined") return null;
  return window.__QA_VIDEO__ ?? null;
}
