// Escenario de QA: se elige por query string, p. ej. ?qa=pro o ?qa=limit
export function scenario() {
  if (typeof window === "undefined") return "free";
  const value = new URLSearchParams(window.location.search).get("qa");
  return value || "free";
}

export function isPro() {
  return scenario() === "pro";
}

export function atLimit() {
  return scenario() === "limit";
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
