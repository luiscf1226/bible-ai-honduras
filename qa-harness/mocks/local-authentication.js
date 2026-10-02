// Mock de expo-local-authentication para "Proteger lo personal" (#171).
//
// ?auth=ok (default)  el teléfono tiene Face ID y autenticar siempre pasa
// ?auth=none          sin biometría ni bloqueo: la opción sale deshabilitada
// ?auth=pending       el diálogo del sistema nunca contesta (se ve la pantalla de candado)
// ?auth=cancel        la persona cancela (vuelve atrás)
// ?lock=on            arranca con "Proteger lo personal" encendido
function param(name) {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get(name);
}

const mode = param("auth") || "ok";

// La preferencia vive en localStorage en web (src/features/personal/personalLockStore.ts).
if (typeof window !== "undefined" && param("lock") === "on") {
  window.localStorage.setItem("personal-lock-enabled", "1");
}

export const SecurityLevel = { NONE: 0, SECRET: 1, BIOMETRIC_WEAK: 2, BIOMETRIC_STRONG: 3 };
export const AuthenticationType = { FINGERPRINT: 1, FACIAL_RECOGNITION: 2, IRIS: 3 };

export async function hasHardwareAsync() { return mode !== "none"; }
export async function isEnrolledAsync() { return mode !== "none"; }
export async function getEnrolledLevelAsync() { return mode === "none" ? 0 : 3; }
export async function supportedAuthenticationTypesAsync() { return mode === "none" ? [] : [2]; }
export async function cancelAuthenticate() {}
export function authenticateAsync() {
  if (mode === "pending") return new Promise(() => {});
  if (mode === "cancel") return Promise.resolve({ success: false, error: "user_cancel" });
  return Promise.resolve({ success: true });
}
