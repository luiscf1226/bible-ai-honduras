/**
 * Invitación a un grupo (#185) que llegó por link antes de poder usarla: con la
 * app cerrada, sin sesión o en medio del onboarding. Lógica pura: el hook
 * (`useGroupInvite`) solo conecta el link, el almacenamiento y la navegación.
 */

export const PENDING_GROUP_INVITE_KEY = "group-invite-pending";

export const GROUP_INVITE_PATH = "/grupo";

/**
 * Rutas donde todavía no se puede aceptar nada: el arranque, el login, el
 * onboarding y el consentimiento de IA. La invitación espera a que la persona
 * llegue a la app de verdad.
 */
const NOT_READY_PATHS = ["/", "/splash", "/login", "/email", "/onboarding", "/notifications", "/consentimiento-ia"];

export function shouldOpenPendingInvite(state: {
  pendingToken: string | null;
  signedIn: boolean;
  pathname: string;
}): boolean {
  if (!state.pendingToken || !state.signedIn) return false;
  if (state.pathname === GROUP_INVITE_PATH) return false;
  return !NOT_READY_PATHS.includes(state.pathname);
}
