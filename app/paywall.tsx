import { useQuery } from "convex/react";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { api } from "../convex/_generated/api";
import { Brand } from "../src/components/Brand";
import { purchaseMonthly } from "../src/lib/revenuecat";
import { PAYWALL_DISPLAY_PRICE, PAYWALL_FEATURES, paywallTokens } from "../src/theme/paywallTokens";
import { tokens } from "../src/theme/tokens";

export default function PaywallScreen() {
  const entitlement = useQuery(api.entitlements.mine);
  const isPro = entitlement?.isPro === true;
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const close = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/home");
  };

  const onSubscribe = async () => {
    if (isPro) {
      close();
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const result = await purchaseMonthly();
      if (!result.ok) {
        setNotice("La compra se completa en un development build. Seguí en la versión gratis por ahora.");
      }
    } catch {
      setNotice("No pudimos abrir la compra. Seguí en la versión gratis por ahora.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <LinearGradient
      colors={[paywallTokens.color.bgStart, paywallTokens.color.bgMid, paywallTokens.color.bgEnd]}
      locations={[0, 0.6, 1]}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.content}>
          <Pressable
            accessibilityLabel="Cerrar"
            accessibilityRole="button"
            onPress={close}
            style={styles.close}
            testID="paywall-close"
          >
            <Text style={styles.closeIcon}>×</Text>
          </Pressable>

          <View style={styles.logo}>
            <Brand size="medium" />
          </View>

          <Text style={styles.title}>Todo el tiempo que necesites</Text>
          <Text style={styles.subtitle}>Sin contar preguntas, sin esperar a mañana.</Text>

          <View style={styles.features}>
            {PAYWALL_FEATURES.map((feature) => (
              <View key={feature.title} style={styles.featureRow}>
                <Text style={styles.check}>✓</Text>
                <View style={styles.featureText}>
                  <Text style={styles.featureTitle}>{feature.title}</Text>
                  <Text style={styles.featureSubtitle}>{feature.subtitle}</Text>
                </View>
              </View>
            ))}
          </View>

          <View style={styles.priceCard}>
            <Text style={styles.price}>{PAYWALL_DISPLAY_PRICE}</Text>
            <Text style={styles.priceHint}>al mes · cancela cuando quieras</Text>
          </View>

          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={() => void onSubscribe()}
            style={({ pressed }) => [styles.cta, pressed && styles.pressed]}
            testID="paywall-subscribe"
          >
            <Text style={styles.ctaLabel}>{isPro ? "Ya eres Pro" : "Empezar con Pro"}</Text>
          </Pressable>

          <Pressable accessibilityRole="button" onPress={close} style={styles.skip}>
            <Text style={styles.skipLabel}>Seguir en la versión gratis</Text>
          </Pressable>

          {notice ? <Text style={styles.notice}>{notice}</Text> : null}

          <Text style={styles.legal}>
            Se cobra a tu cuenta de App Store o Google Play. Puedes cancelar desde la tienda en cualquier momento.
          </Text>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  safe: { flex: 1 },
  content: { paddingHorizontal: tokens.space.xl, paddingBottom: tokens.space.xl },
  close: {
    alignItems: "center",
    borderColor: paywallTokens.color.closeBorder,
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    height: tokens.size.dotActive + tokens.space.md,
    justifyContent: "center",
    width: tokens.size.dotActive + tokens.space.md,
  },
  closeIcon: {
    color: tokens.color.border,
    fontFamily: tokens.font.sans,
    fontSize: tokens.type.subtitle.size,
    lineHeight: tokens.type.subtitle.lineHeight,
  },
  logo: { marginTop: tokens.space.xxl + tokens.space.md },
  title: {
    color: paywallTokens.color.title,
    fontFamily: tokens.font.serif,
    fontSize: paywallTokens.type.headline.size,
    lineHeight: paywallTokens.type.headline.lineHeight,
    marginTop: tokens.space.xxl + tokens.space.xs,
  },
  subtitle: {
    color: paywallTokens.color.muted,
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.body.size,
    lineHeight: tokens.type.body.lineHeight,
    marginTop: tokens.space.lg,
  },
  features: { marginTop: tokens.space.xxl + tokens.space.md },
  featureRow: {
    borderBottomColor: paywallTokens.color.featureRule,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: tokens.space.lg,
    paddingVertical: tokens.space.lg,
  },
  check: {
    color: paywallTokens.color.check,
    fontFamily: tokens.font.sans,
    fontSize: tokens.type.body.size,
    marginTop: tokens.space.xs,
  },
  featureText: { flex: 1 },
  featureTitle: {
    color: paywallTokens.color.title,
    fontFamily: tokens.font.serif,
    fontSize: paywallTokens.type.feature.size,
    lineHeight: paywallTokens.type.feature.lineHeight,
  },
  featureSubtitle: {
    color: paywallTokens.color.mutedDeep,
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.caption.size,
    lineHeight: tokens.type.caption.lineHeight,
    marginTop: tokens.space.xs,
  },
  priceCard: {
    alignItems: "baseline",
    backgroundColor: paywallTokens.color.priceFill,
    borderColor: paywallTokens.color.priceBorder,
    borderRadius: tokens.radius.xl,
    borderWidth: 1,
    flexDirection: "row",
    gap: tokens.space.sm,
    marginTop: tokens.space.xxl + tokens.space.sm,
    padding: tokens.space.xl,
  },
  price: {
    color: paywallTokens.color.title,
    fontFamily: tokens.font.serif,
    fontSize: paywallTokens.type.price.size,
    lineHeight: paywallTokens.type.price.lineHeight,
  },
  priceHint: {
    color: paywallTokens.color.muted,
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.bodySm.size,
  },
  cta: {
    backgroundColor: paywallTokens.color.button,
    borderRadius: tokens.radius.lg,
    marginTop: tokens.space.lg,
    paddingVertical: tokens.space.lg + tokens.space.xs / 2,
  },
  ctaLabel: {
    color: paywallTokens.color.buttonInk,
    fontFamily: tokens.font.sans,
    fontSize: tokens.type.label.size,
    textAlign: "center",
  },
  pressed: { opacity: tokens.opacity.pressed },
  skip: { marginTop: tokens.space.md, paddingVertical: tokens.space.lg },
  skipLabel: {
    color: paywallTokens.color.skip,
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.bodySm.size,
    textAlign: "center",
  },
  notice: {
    color: paywallTokens.color.muted,
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.caption.size,
    lineHeight: tokens.type.caption.lineHeight,
    marginTop: tokens.space.sm,
    textAlign: "center",
  },
  legal: {
    color: paywallTokens.color.legal,
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.overline.size,
    lineHeight: tokens.type.caption.lineHeight,
    marginTop: tokens.space.lg,
    textAlign: "center",
  },
});
