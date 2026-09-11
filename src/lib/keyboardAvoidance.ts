/**
 * Números puros del manejo de teclado de `AppScreen` (issue #105).
 *
 * Vive separado del componente porque el componente necesita un render nativo
 * para probarse, pero la aritmética —qué `behavior` usa cada plataforma, cuánto
 * vale el `keyboardVerticalOffset` y cuánto hay que correr el scroll para dejar
 * el input enfocado arriba del teclado— sí se puede testear con vitest.
 *
 * Este módulo NO importa de "react-native" a propósito: el entorno de vitest es
 * `edge-runtime` y no puede resolver el código Flow de RN. La plataforma entra
 * como string (`Platform.OS`).
 */
import { tokens } from "../theme/tokens";

export type SafeAreaInsets = {
  bottom: number;
  left: number;
  right: number;
  top: number;
};

export const ZERO_INSETS: SafeAreaInsets = { bottom: 0, left: 0, right: 0, top: 0 };

export type KeyboardAvoidanceInput = {
  insets: SafeAreaInsets;
  platform: string;
  /**
   * Alto del chrome que queda ARRIBA del `AppScreen` y que el
   * `KeyboardAvoidingView` no puede medir con su propio `onLayout`: header de
   * Stack, tab bar superior, etc. Hoy es 0 porque `app/_layout.tsx` corre un
   * único `Stack` con `headerShown: false` y no hay tab navigator.
   */
  topChromeHeight?: number;
};

/**
 * iOS: `padding` reduce el área útil del contenedor sin apagar el flex, así que
 * un hijo con `justifyContent: "flex-end"` (el caso de `app/(auth)/email.tsx`)
 * se sube solo.
 *
 * Android: `padding` no alcanza. Desde Expo SDK 54 el edge-to-edge es
 * obligatorio (`@expo/prebuild-config` ya ni acepta `android.edgeToEdgeEnabled`),
 * y con edge-to-edge la ventana NO se encoge sola cuando entra el teclado, así
 * que hay que relayoutear el contenedor. `height` hace exactamente eso y se
 * autocancela (`Math.max(..., 0)`) en los equipos viejos donde `adjustResize`
 * sí encoge la ventana, así que no hay doble compensación.
 *
 * Web y el resto: sin manejo, el navegador ya reacomoda.
 */
export function keyboardBehaviorFor(platform: string): "height" | "padding" | undefined {
  if (platform === "ios") {
    return "padding";
  }
  if (platform === "android") {
    return "height";
  }
  return undefined;
}

/**
 * Distancia entre el tope de la pantalla y el origen que el
 * `KeyboardAvoidingView` mide con su `onLayout`.
 *
 * RN calcula el desplazamiento como
 * `max(frame.y + frame.height - (keyboard.screenY - keyboardVerticalOffset), 0)`
 * (react-native/Libraries/Components/Keyboard/KeyboardAvoidingView.js), donde
 * `frame` es su layout **relativo al padre** y `screenY` está en coordenadas de
 * pantalla. El offset existe para cerrar esa diferencia de sistemas.
 *
 * En `AppScreen` el padre directo del `KeyboardAvoidingView` es el
 * `SafeAreaView`, y Yoga ya incluye el padding del padre en el `layout.y` del
 * hijo: el inset del notch / Dynamic Island viaja dentro de `frame.y`. Por eso
 * el término del safe area es 0 y sumarlo abriría un hueco del alto del notch
 * entre el teclado y el contenido. Lo único que queda afuera de la medición es
 * el chrome de navegación, que hoy no existe.
 *
 * El inset de abajo (barra de gestos) tampoco entra: el `SafeAreaView` lo
 * reserva como padding, el teclado lo tapa, y `frame.y + frame.height` ya cae
 * arriba de él, así que RN calcula `altoDelTeclado - insets.bottom`, que es
 * exactamente el solape real.
 */
export function keyboardVerticalOffsetFor({ topChromeHeight = 0 }: KeyboardAvoidanceInput): number {
  return topChromeHeight;
}

/**
 * `additionalOffset` para
 * `ScrollView.scrollResponderScrollNativeHandleToKeyboard(node, additionalOffset)`.
 *
 * RN resuelve el destino del scroll con
 * `scrollOffsetY = top - keyboard.screenY + height + additionalOffset`, donde
 * `top` es la posición del input **dentro del contenido** del ScrollView y
 * `screenY` está en coordenadas de pantalla
 * (react-native/Libraries/Components/ScrollView/ScrollView.js).
 *
 * Esa fórmula asume que el ScrollView arranca en el pixel 0 de la pantalla. Acá
 * no: arranca `insets.top` más abajo (notch / Dynamic Island / barra de estado)
 * más el chrome de navegación. Sin esa corrección el input queda `insets.top`
 * píxeles demasiado bajo — en un iPhone con Dynamic Island son ~59 px, o sea
 * sigue debajo del teclado. Este es el término del fix que de verdad depende del
 * notch.
 *
 * Se le suma un respiro de un token para que el campo no quede pegado al borde
 * del teclado.
 */
export function focusedInputScrollOffsetFor({
  insets,
  topChromeHeight = 0,
}: KeyboardAvoidanceInput): number {
  return insets.top + topChromeHeight + tokens.space.xxl;
}
