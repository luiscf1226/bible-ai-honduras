import { useQuery } from "convex/react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { api } from "../../../../convex/_generated/api";
import { localDateKey, occasionsOn } from "../../../../convex/personalDates";
import { Icon } from "../../../components/Icon";
import { useTheme } from "../../../theme/ThemeProvider";
import { tokens } from "../../../theme/tokens";
import { occasionOverline, occasionTitle } from "../../personal/personalDates";
import { useTodayVerse } from "../useTodayDevotional";
import { openFromHome } from "./HomeCard";

/**
 * Tus fechas (#204): el día del cumpleaños o del aniversario de bautismo o
 * conversión, arriba de todo, un saludo y un versículo curado
 * (`convex/personalDates.ts`, sin IA). El texto sale del corpus en la versión
 * de la persona. Se decide con la fecha local del teléfono; cualquier otro día,
 * o sin fechas cargadas, no dibuja nada y el inicio queda como siempre.
 *
 * Misma piel que la tarjeta del versículo (U1): `surface`, borde, `radius.xxl`,
 * rótulo `overline` en `accent`, título serif y pie "Leer en la Biblia".
 */
export function PersonalDateCard() {
  const user = useQuery(api.users.current, {});
  const occasions = occasionsOn(user, localDateKey(new Date()));
  const [main, second] = occasions;
  if (!main) return null;
  return <PersonalDateCardBody main={main} name={user?.name} second={second} />;
}

function PersonalDateCardBody({
  main,
  name,
  second,
}: {
  main: ReturnType<typeof occasionsOn>[number];
  name?: string;
  second?: ReturnType<typeof occasionsOn>[number];
}) {
  const { color, dark } = useTheme();
  const verse = useTodayVerse(main.verseRef);
  const linkColor = dark ? color.accent : color.accentDeep;

  const onPress = () => {
    if (!verse.passage) return;
    openFromHome({
      pathname: "/leer/[book]/[chapter]",
      params: { book: verse.passage.book, chapter: String(verse.passage.chapter), verse: String(verse.passage.verse) },
    });
  };

  return (
    <Pressable
      accessibilityHint="Abre el versículo en la Biblia."
      accessibilityLabel={occasionTitle(main, name)}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, { backgroundColor: color.surface, borderColor: color.border }, pressed && styles.pressed]}
      testID="home-card-dates"
    >
      <View style={styles.overlineRow}>
        <Icon color={color.accent} name="sunrise" size="sm" />
        <Text style={[styles.overline, { color: color.accent }]}>{occasionOverline(main)}</Text>
      </View>
      <Text style={[styles.title, { color: color.ink }]}>{occasionTitle(main, name)}</Text>
      {second ? <Text style={[styles.second, { color: color.inkMuted }]}>{`Y ${lowerFirst(occasionTitle(second, name))}.`}</Text> : null}

      <Text numberOfLines={6} style={[styles.verse, { color: color.ink }]}>
        {verse.text ? `“${verse.text}”` : main.verseRef}
      </Text>
      <Text style={[styles.reference, { color: color.inkMuted }]}>
        {verse.text ? `${main.verseRef} · ${verse.version}` : verse.version}
      </Text>

      <View style={[styles.footer, { borderTopColor: color.border }]}>
        <Text style={[styles.footerLabel, { color: linkColor }]}>Leer en la Biblia</Text>
        <Icon color={linkColor} name="chevronRight" size="sm" />
      </View>
    </Pressable>
  );
}

function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

const styles = StyleSheet.create({
  card: {
    borderRadius: tokens.radius.xxl,
    borderWidth: 1,
    paddingHorizontal: tokens.cardPadding.horizontal,
    paddingVertical: tokens.cardPadding.vertical,
  },
  pressed: { opacity: tokens.opacity.pressed },
  overlineRow: { alignItems: "center", flexDirection: "row", gap: tokens.space.xs },
  overline: {
    fontFamily: tokens.font.sansMedium,
    fontSize: tokens.type.overline.size,
    letterSpacing: tokens.type.overline.letterSpacing,
    lineHeight: tokens.type.overline.lineHeight,
    textTransform: "uppercase",
  },
  title: {
    fontFamily: tokens.font.serif,
    fontSize: tokens.type.title.size,
    lineHeight: tokens.type.title.lineHeight,
    marginTop: tokens.space.sm,
  },
  second: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.bodySm.size,
    lineHeight: tokens.type.bodySm.lineHeight,
    marginTop: tokens.space.xxs,
  },
  verse: {
    fontFamily: tokens.font.serif,
    fontSize: tokens.type.verse.size,
    lineHeight: tokens.type.verse.lineHeight,
    marginTop: tokens.space.lg,
  },
  reference: {
    fontFamily: tokens.font.sansMedium,
    fontSize: tokens.type.caption.size,
    lineHeight: tokens.type.caption.lineHeight,
    marginTop: tokens.space.md,
  },
  footer: {
    alignItems: "center",
    borderTopWidth: 1,
    flexDirection: "row",
    gap: tokens.space.xs,
    marginTop: tokens.space.lg,
    paddingTop: tokens.space.md,
  },
  footerLabel: { fontFamily: tokens.font.sans, fontSize: tokens.type.bodySm.size, lineHeight: tokens.type.bodySm.lineHeight },
});
