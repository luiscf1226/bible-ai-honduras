/**
 * Dueño único del portapapeles, con la misma forma que `src/lib/share.ts`:
 * import dinámico de react-native (para que el módulo sea testeable en vitest
 * sin runtime nativo) e inyección explícita en tests.
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
  const { Clipboard } = await import("react-native");
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
