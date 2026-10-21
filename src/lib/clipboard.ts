/**
 * Dueño único del portapapeles, con la misma forma que `src/lib/share.ts`:
 * carga selectiva de react-native al usarlo e inyección explícita en tests.
 * No usar import(): Metro evalúa todos los getters del paquete.
 *
 * Nota: `Clipboard` de react-native está marcado como deprecado — el reemplazo
 * es `@react-native-clipboard/clipboard` o `expo-clipboard`, que son módulos
 * nativos nuevos y obligan a un build nuevo de EAS. Mientras siga exportado por
 * react-native 0.86 se usa este; el día que se agregue la dependencia nativa se
 * cambia acá adentro y ninguna pantalla se entera.
 */

export type CopyResult = { status: "copied" } | { status: "error"; error: unknown };

export type ClipboardNative = {
  setString: (content: string) => void;
};

let nativeOverride: ClipboardNative | undefined;

/** Solo para tests. */
export function setClipboardNativeForTests(native: ClipboardNative): void {
  nativeOverride = native;
}

export function resetClipboardNativeForTests(): void {
  nativeOverride = undefined;
}

async function loadNative(): Promise<ClipboardNative> {
  if (nativeOverride !== undefined) {
    return nativeOverride;
  }
  const { Clipboard } = require("react-native") as typeof import("react-native");
  return Clipboard;
}

export async function copyToClipboard(text: string): Promise<CopyResult> {
  try {
    const clipboard = await loadNative();
    clipboard.setString(text);
    return { status: "copied" };
  } catch (error) {
    return { status: "error", error };
  }
}
