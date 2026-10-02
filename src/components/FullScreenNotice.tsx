import { LinearGradient } from "expo-linear-gradient";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useTheme } from "../theme/ThemeProvider";
import { tokens } from "../theme/tokens";

type FullScreenNoticeProps = {
  /** Glifo dentro del anillo, como el ◷ de "Por hoy llegaste al límite". */
  mark: string;
  title: string;
  body: string;
  cta: string;
  onCta: () => void;
  testID: string;
};

/**
 * Pantalla completa con un solo camino: "Actualizá la app" y "Algo salió mal".
 * Es el mismo layout que `LimitReached` (pantalla de límite del prototype:
 * anillo con glifo, título serif, cuerpo y botón oscuro) con otro texto, así
 * que no suma tokens ni patrones nuevos.
 */
export function FullScreenNotice({ body, cta, mark, onCta, testID, title }: FullScreenNoticeProps) {
  const { color } = useTheme();

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: color.surface }]} testID={testID}>
      <LinearGradient colors={[color.surface, color.surfaceSunk]} style={styles.notice}>
        <View style={[styles.icon, { borderColor: color.borderStrong }]}>
          <Text style={[styles.iconMark, { color: color.accent }]}>{mark}</Text>
        </View>
        <Text accessibilityRole="header" style={[styles.title, { color: color.ink }]}>
          {title}
        </Text>
        <Text style={[styles.body, { color: color.inkMuted }]}>{body}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={onCta}
          style={({ pressed }) => [styles.cta, { backgroundColor: color.ink }, pressed && styles.pressed]}
          testID={`${testID}-cta`}
        >
          <Text style={[styles.ctaLabel, { color: color.surface }]}>{cta}</Text>
        </Pressable>
      </LinearGradient>
    </SafeAreaView>
  );
}

// Mismos valores que `LimitReached.tsx`.
const styles = StyleSheet.create({
  safe: { flex: 1 },
  notice: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: tokens.space.xxl + tokens.space.sm,
    paddingVertical: tokens.space.xxl + tokens.space.lg,
  },
  icon: {
    alignItems: "center",
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    height: tokens.size.avatar,
    justifyContent: "center",
    width: tokens.size.avatar,
  },
  iconMark: { fontFamily: tokens.font.sans, fontSize: tokens.type.subtitle.size },
  title: {
    fontFamily: tokens.font.serif,
    fontSize: tokens.type.title.size,
    lineHeight: tokens.type.title.lineHeight,
    marginTop: tokens.space.xxl,
  },
  body: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.body.size,
    lineHeight: tokens.type.body.lineHeight,
    marginTop: tokens.space.lg,
  },
  cta: {
    borderRadius: tokens.radius.lg,
    marginTop: tokens.space.xxl + tokens.space.sm,
    paddingVertical: tokens.cardPadding.vertical,
  },
  pressed: { opacity: tokens.opacity.pressed },
  ctaLabel: {
    fontFamily: tokens.font.sans,
    fontSize: tokens.type.label.size,
    textAlign: "center",
  },
});
