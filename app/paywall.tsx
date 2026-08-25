import { useAuth } from "@clerk/expo";
import { useQuery } from "convex/react";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { api } from "../convex/_generated/api";
import { Brand } from "../src/components/Brand";
import { PAYWALL_DISPLAY_PRICE, PAYWALL_FEATURES } from "../src/lib/paywallCopy";
import { purchaseMonthly, restorePurchases } from "../src/lib/revenuecat";
import { tokens } from "../src/theme/tokens";

export default function PaywallScreen() {
  const { userId } = useAuth();
  const entitlement = useQuery(api.entitlements.mine);
  const isPro = entitlement?.isPro === true;
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [awaitingUnlock, setAwaitingUnlock] = useState(false);

  const close = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/home");
  };

  useEffect(() => {
    if (!awaitingUnlock || !isPro) {
      return;
    }
    setAwaitingUnlock(false);
    close();
  }, [awaitingUnlock, isPro]);

  const onSubscribe = async () => {
    if (isPro) {
      close();
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const result = await purchaseMonthly(userId ?? undefined);
      if (result.ok) {
        setAwaitingUnlock(true);
        return;
      }
      if (result.reason === "user_cancelled") {
        return;
      }
      if (result.reason === "dev_build_required") {
        setNotice("La compra se completa en un development build. Seguí en la versión gratis por ahora.");
        return;
      }
      setNotice("No pudimos completar la compra. Seguí en la versión gratis por ahora.");
    } catch {
      setNotice("No pudimos abrir la compra. Seguí en la versión gratis por ahora.");
    } finally {
      setBusy(false);
    }
  };

  const onRestore = async () => {
    setBusy(true);
    setNotice(null);
    try {
      const result = await restorePurchases(userId ?? undefined);
      if (result.ok) {
        setAwaitingUnlock(true);
        return;
      }
      if (result.reason === "dev_build_required") {
        setNotice("La restauración se completa en un development build. Seguí en la versión gratis por ahora.");
        return;
      }
      setNotice("No encontramos una compra para restaurar. Seguí en la versión gratis por ahora.");
    } catch {
      setNotice("No pudimos restaurar la compra. Seguí en la versión gratis por ahora.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <LinearGradient
      colors={[tokens.paywall.color.bgStart, tokens.paywall.color.bgMid, tokens.paywall.color.bgEnd]}
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

          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={() => void onRestore()}
            style={styles.skip}
            testID="paywall-restore"
          >
            <Text style={styles.skipLabel}>Restaurar compras</Text>
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
    borderColor: tokens.paywall.color.closeBorder,
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
    color: tokens.paywall.color.title,
    fontFamily: tokens.font.serif,
    fontSize: tokens.paywall.type.headline.size,
    lineHeight: tokens.paywall.type.headline.lineHeight,
    marginTop: tokens.space.xxl + tokens.space.xs,
  },
  subtitle: {
    color: tokens.paywall.color.muted,
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.body.size,
    lineHeight: tokens.type.body.lineHeight,
    marginTop: tokens.space.lg,
  },
  features: { marginTop: tokens.space.xxl + tokens.space.md },
  featureRow: {
    borderBottomColor: tokens.paywall.color.featureRule,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: tokens.space.lg,
    paddingVertical: tokens.space.lg,
  },
  check: {
    color: tokens.paywall.color.check,
    fontFamily: tokens.font.sans,
    fontSize: tokens.type.body.size,
    marginTop: tokens.space.xs,
  },
  featureText: { flex: 1 },
  featureTitle: {
    color: tokens.paywall.color.title,
    fontFamily: tokens.font.serif,
    fontSize: tokens.paywall.type.feature.size,
    lineHeight: tokens.paywall.type.feature.lineHeight,
  },
  featureSubtitle: {
    color: tokens.paywall.color.mutedDeep,
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.caption.size,
    lineHeight: tokens.type.caption.lineHeight,
    marginTop: tokens.space.xs,
  },
  priceCard: {
    alignItems: "baseline",
    backgroundColor: tokens.paywall.color.priceFill,
    borderColor: tokens.paywall.color.priceBorder,
    borderRadius: tokens.radius.xl,
    borderWidth: 1,
    flexDirection: "row",
    gap: tokens.space.sm,
    marginTop: tokens.space.xxl + tokens.space.sm,
    padding: tokens.space.xl,
  },
  price: {
    color: tokens.paywall.color.title,
    fontFamily: tokens.font.serif,
    fontSize: tokens.paywall.type.price.size,
    lineHeight: tokens.paywall.type.price.lineHeight,
  },
  priceHint: {
    color: tokens.paywall.color.muted,
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.bodySm.size,
  },
  cta: {
    backgroundColor: tokens.paywall.color.button,
    borderRadius: tokens.radius.lg,
    marginTop: tokens.space.lg,
    paddingVertical: tokens.space.lg + tokens.space.xs / 2,
  },
  ctaLabel: {
    color: tokens.paywall.color.buttonInk,
    fontFamily: tokens.font.sans,
    fontSize: tokens.type.label.size,
    textAlign: "center",
  },
  pressed: { opacity: tokens.opacity.pressed },
  skip: { marginTop: tokens.space.md, paddingVertical: tokens.space.lg },
  skipLabel: {
    color: tokens.paywall.color.skip,
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.bodySm.size,
    textAlign: "center",
  },
  notice: {
    color: tokens.paywall.color.muted,
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.caption.size,
    lineHeight: tokens.type.caption.lineHeight,
    marginTop: tokens.space.sm,
    textAlign: "center",
  },
  legal: {
    color: tokens.paywall.color.legal,
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.overline.size,
    lineHeight: tokens.type.caption.lineHeight,
    marginTop: tokens.space.lg,
    textAlign: "center",
  },
});
