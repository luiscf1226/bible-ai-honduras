import { useContext, useEffect, type RefObject } from "react";
import { Keyboard, Platform, type ScrollView } from "react-native";
import { SafeAreaInsetsContext } from "react-native-safe-area-context";

import { ZERO_INSETS, type SafeAreaInsets } from "../lib/keyboardAvoidance";

/**
 * Insets del safe area sin el riesgo de `useSafeAreaInsets()`, que tira si no
 * hay `SafeAreaProvider` arriba. expo-router siempre monta uno (`ExpoRoot`),
 * pero con el fallback en cero un componente se puede renderizar fuera del
 * router —o en un test— sin explotar.
 */
export function useScreenInsets(): SafeAreaInsets {
  return useContext(SafeAreaInsetsContext) ?? ZERO_INSETS;
}

/**
 * Manda el hilo al final cuando entra el teclado (issue #105).
 *
 * En las pantallas de chat el input vive afuera del ScrollView, así que el
 * KeyboardAvoidingView ya lo mantiene visible; lo que se pierde es el último
 * mensaje, porque el contenedor se encoge y el ScrollView queda mostrando la
 * mitad de arriba del hilo.
 */
export function useScrollToEndOnKeyboard(scrollRef: RefObject<ScrollView | null>): void {
  useEffect(() => {
    const subscription = Keyboard.addListener(
      // iOS avisa antes de animar (`willShow`); Android solo después (`didShow`).
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      () => scrollRef.current?.scrollToEnd({ animated: true }),
    );
    return () => subscription.remove();
  }, [scrollRef]);
}
