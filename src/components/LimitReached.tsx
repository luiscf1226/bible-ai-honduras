import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import type { QuotaModule } from "../../convex/quotas";
import { limitBodyFor } from "../lib/limitCopy";
import { tokens } from "../theme/tokens";

type LimitReachedProps = {
  module: QuotaModule;
  testID?: string;
};

export function LimitReached({ module, testID = "limit-reached" }: LimitReachedProps) {
  return (
    <SafeAreaView style={styles.safe} testID={testID}>
      <LinearGradient colors={[tokens.color.surface, tokens.color.surfaceSunk]} style={styles.limit}>
        <View style={styles.limitIcon}>
          <Text style={styles.limitIconMark}>◷</Text>
        </View>
        <Text style={styles.limitTitle}>Por hoy llegaste al límite</Text>
        <Text style={styles.limitBody}>{limitBodyFor(module)}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/paywall")}
          style={styles.limitCta}
          testID="limit-paywall"
        >
          <Text style={styles.limitCtaLabel}>Seguir sin límite con Pro</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => router.replace("/home")} testID="limit-home">
          <Text style={styles.limitSkip}>Mañana vuelvo</Text>
        </Pressable>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { backgroundColor: tokens.color.surface, flex: 1 },
  limit: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: tokens.space.xxl + tokens.space.sm,
    paddingVertical: tokens.space.xxl + tokens.space.lg,
  },
  limitIcon: {
    alignItems: "center",
    borderColor: tokens.color.borderStrong,
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    height: tokens.size.avatar,
    justifyContent: "center",
    width: tokens.size.avatar,
  },
  limitIconMark: { color: tokens.color.accent, fontFamily: tokens.font.sans, fontSize: tokens.type.subtitle.size },
  limitTitle: {
    color: tokens.color.ink,
    fontFamily: tokens.font.serif,
    fontSize: tokens.type.title.size,
    lineHeight: tokens.type.title.lineHeight,
    marginTop: tokens.space.xxl,
  },
  limitBody: {
    color: tokens.color.inkMuted,
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.body.size,
    lineHeight: tokens.type.body.lineHeight,
    marginTop: tokens.space.lg,
  },
  limitCta: {
    backgroundColor: tokens.color.ink,
    borderRadius: tokens.radius.lg,
    marginTop: tokens.space.xxl + tokens.space.sm,
    paddingVertical: tokens.cardPadding.vertical,
  },
  limitCtaLabel: {
    color: tokens.color.surface,
    fontFamily: tokens.font.sans,
    fontSize: tokens.type.label.size,
    textAlign: "center",
  },
  limitSkip: {
    color: tokens.color.inkSoft,
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.bodySm.size,
    marginTop: tokens.space.md,
    textAlign: "center",
  },
});
