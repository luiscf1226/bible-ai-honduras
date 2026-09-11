import { useCallback, useEffect, useRef, type PropsWithChildren } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useScreenInsets } from "../hooks/useKeyboardAvoidance";
import {
  focusedInputScrollOffsetFor,
  keyboardBehaviorFor,
  keyboardVerticalOffsetFor,
} from "../lib/keyboardAvoidance";
import { useTheme } from "../theme/ThemeProvider";
import { tokens } from "../theme/tokens";

type AppScreenProps = PropsWithChildren<{
  scroll?: boolean;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}>;

/**
 * Contenedor de pantalla. Además del safe area, resuelve el teclado acá adentro
 * para las 14 pantallas de una sola vez (issue #105): sin esto, cada pantalla
 * con input tenía que acordarse de envolver todo en un KeyboardAvoidingView, y
 * la mitad no lo hacía.
 *
 * La aritmética (behavior por plataforma, offset del KAV y offset del
 * auto-scroll) vive en `src/lib/keyboardAvoidance.ts` para poder testearla.
 */
export function AppScreen({ children, contentStyle, scroll = false, style }: AppScreenProps) {
  const { color } = useTheme();
  const insets = useScreenInsets();
  const scrollRef = useRef<ScrollView>(null);
  const platform = Platform.OS;

  // Auto-scroll al input enfocado: RN mide el input contra las coordenadas del
  // teclado asumiendo que el ScrollView arranca en el pixel 0 de la pantalla, y
  // acá arranca `insets.top` más abajo. Sin la corrección, en un iPhone con
  // notch el campo queda justo debajo del teclado.
  const scrollToFocusedInput = useCallback(() => {
    const scrollView = scrollRef.current;
    const focusedInput = TextInput.State.currentlyFocusedInput();
    if (!scrollView || !focusedInput) {
      return;
    }
    scrollView.scrollResponderScrollNativeHandleToKeyboard(
      focusedInput,
      focusedInputScrollOffsetFor({ insets, platform }),
      true,
    );
  }, [insets, platform]);

  useEffect(() => {
    if (!scroll) {
      return;
    }
    // iOS avisa antes de animar (`willShow`); Android solo después (`didShow`).
    const subscription = Keyboard.addListener(
      platform === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      scrollToFocusedInput,
    );
    return () => subscription.remove();
  }, [platform, scroll, scrollToFocusedInput]);

  const content = <View style={[styles.content, contentStyle]}>{children}</View>;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: color.surface }, style]}>
      <KeyboardAvoidingView
        behavior={keyboardBehaviorFor(platform)}
        keyboardVerticalOffset={keyboardVerticalOffsetFor({ insets, platform })}
        style={styles.keyboardAvoider}
      >
        {scroll ? (
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardDismissMode={platform === "ios" ? "interactive" : "on-drag"}
            // Sin esto, con el teclado abierto el primer tap solo lo cierra y se
            // traga el tap del chip / del botón que estabas apretando.
            keyboardShouldPersistTaps="handled"
            ref={scrollRef}
          >
            {content}
          </ScrollView>
        ) : (
          content
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  keyboardAvoider: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  content: { flex: 1, paddingHorizontal: tokens.space.xl, paddingVertical: tokens.space.xxl }
});
