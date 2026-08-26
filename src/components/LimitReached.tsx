import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import type { QuotaModule } from "../../convex/quotas";
import { limitBodyFor } from "../lib/limitCopy";
import { useTheme } from "../theme/ThemeProvider";
import { tokens } from "../theme/tokens";

type LimitReachedProps = {
  module: QuotaModule;
  testID?: string;
};

export function LimitReached({ module, testID = "limit-reached" }: LimitReachedProps) {
  const { color } = useTheme();

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: color.surface }]} testID={testID}>
      <LinearGradient colors={[color.surface, color.surfaceSunk]} style={styles.limit}>
        <View style={[styles.limitIcon, { borderColor: color.borderStrong }]}>
          <Text style={[styles.limitIconMark, { color: color.accent }]}>◷</Text>
        </View>
        <Text style={[styles.limitTitle, { color: color.ink }]}>Por hoy llegaste al límite</Text>
        <Text style={[styles.limitBody, { color: color.inkMuted }]}>{limitBodyFor(module)}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/paywall")}
          style={[styles.limitCta, { backgroundColor: color.ink }]}
          testID="limit-paywall"
        >
          <Text style={[styles.limitCtaLabel, { color: color.surface }]}>Seguir sin límite con Pro</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => router.replace("/home")} testID="limit-home">
          <Text style={[styles.limitSkip, { color: color.inkSoft }]}>Mañana vuelvo</Text>
        </Pressable>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  limit: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: tokens.space.xxl + tokens.space.sm,
    paddingVertical: tokens.space.xxl + tokens.space.lg,
  },
  limitIcon: {
    alignItems: "center",
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    height: tokens.size.avatar,
    justifyContent: "center",
    width: tokens.size.avatar,
  },
  limitIconMark: { fontFamily: tokens.font.sans, fontSize: tokens.type.subtitle.size },
  limitTitle: {
    fontFamily: tokens.font.serif,
    fontSize: tokens.type.title.size,
    lineHeight: tokens.type.title.lineHeight,
    marginTop: tokens.space.xxl,
  },
  limitBody: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.body.size,
    lineHeight: tokens.type.body.lineHeight,
    marginTop: tokens.space.lg,
  },
  limitCta: {
    borderRadius: tokens.radius.lg,
    marginTop: tokens.space.xxl + tokens.space.sm,
    paddingVertical: tokens.cardPadding.vertical,
  },
  limitCtaLabel: {
    fontFamily: tokens.font.sans,
    fontSize: tokens.type.label.size,
    textAlign: "center",
  },
  limitSkip: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.bodySm.size,
    marginTop: tokens.space.md,
    textAlign: "center",
  },
});
