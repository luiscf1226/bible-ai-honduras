import { useQuery } from "convex/react";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { api } from "../convex/_generated/api";
import { voiceCharacters } from "../convex/voicesCatalog";
import { AppScreen } from "../src/components/AppScreen";
import { FilterPills } from "../src/components/FilterPills";
import { Icon } from "../src/components/Icon";
import { ListCard } from "../src/components/ListRow";
import { ScreenHeader } from "../src/components/ScreenHeader";
import { CONVERSATION_FILTERS, conversationFilterFrom, conversationTarget, filterConversations } from "../src/features/personal/conversations";
import { hideLockedFeelings } from "../src/features/personal/personalLock";
import { usePersonalLockGate } from "../src/features/personal/personalLockStore";
import { goToChat } from "../src/lib/goToChat";
import { goToVoices } from "../src/lib/goToVoices";
import { withPressed } from "../src/theme/pressed";
import { useTheme } from "../src/theme/ThemeProvider";
import { tokens } from "../src/theme/tokens";

function hondurasDay(timestamp: number) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Tegucigalpa" }).format(new Date(timestamp));
}

function relativeWhen(createdAt: number) {
  const today = hondurasDay(Date.now());
  const day = hondurasDay(createdAt);
  if (day === today) {
    return "Hoy";
  }
  const yesterday = hondurasDay(Date.now() - 24 * 60 * 60 * 1000);
  if (day === yesterday) {
    return "Ayer";
  }
  return new Intl.DateTimeFormat("es-HN", {
    day: "numeric",
    month: "short",
    timeZone: "America/Tegucigalpa",
  }).format(new Date(createdAt));
}

const EMPTY_COPY = {
  todo: "Tus preguntas, tus devocionales de Sentir y tus charlas con personajes quedan aquí.",
  qa: "Todavía no preguntaste nada. Lo que preguntes en Preguntar queda aquí, un tema por conversación.",
  feelings: "Todavía no hay devocionales de Sentir.",
  voices: "Todavía no conversaste con ningún personaje.",
} as const;

/**
 * Mis conversaciones (#232, Fase 3): el único historial. Filtro Todo /
 * Preguntar / Sentir / Personajes (los cajones llegan con `?filtro=`) y cada
 * renglón abre la conversación donde se tuvo.
 */
export default function HistorialScreen() {
  const { color } = useTheme();
  const params = useLocalSearchParams<{ filtro?: string | string[] }>();
  const [filter, setFilter] = useState(() => conversationFilterFrom(params.filtro));
  // Con "Proteger lo personal" encendido y sin desbloquear, Sentir no se asoma acá (#171).
  const lock = usePersonalLockGate();
  const all = useQuery(api.history.list);
  const items = all === undefined ? undefined : filterConversations(hideLockedFeelings(all, lock.status), filter);

  const open = (item: NonNullable<typeof all>[number]) => {
    const target = conversationTarget(item);
    if (!target) return;
    if (target.kind === "qa") goToChat({ conversationId: target.conversationId });
    else if (target.kind === "feelings") router.navigate({ pathname: "/sentir", params: { devocional: target.devotionalId } });
    else goToVoices(target.slug);
  };

  return (
    <AppScreen scroll contentStyle={styles.content} style={{ backgroundColor: color.surface }}>
      <ScreenHeader accessibilityLabel="Volver" style={styles.header} title="Mis conversaciones" />
      <Text style={[styles.subtitle, { color: color.inkSoft }]}>Solo vos las ves. Se guardan en tu cuenta.</Text>

      <FilterPills onSelect={setFilter} options={CONVERSATION_FILTERS} selected={filter} style={styles.filters} testID="historial-filtro" />

      {items === undefined ? null : items.length === 0 ? (
        <Text style={[styles.empty, { color: color.inkSoft }]} testID="historial-vacio">
          {EMPTY_COPY[filter]}
        </Text>
      ) : (
        <ListCard testID="historial-lista">
          {items.map((item) => {
            const character = voiceCharacters.find((entry) => entry.slug === item.characterId);
            return (
              <Pressable
                accessibilityHint="Abre esta conversación."
                accessibilityRole="button"
                key={item.id}
                onPress={() => open(item)}
                style={withPressed(styles.row)}
                testID={`historial-item-${item.id}`}
              >
                <View style={[styles.avatar, { backgroundColor: character ? character.gradientFrom : color.surfaceSunk }]}>
                  <Text style={[styles.avatarInitial, { color: character ? color.surface : color.accent }]}>{item.initial}</Text>
                </View>
                <View style={styles.rowText}>
                  <Text numberOfLines={1} style={[styles.itemTitle, { color: color.ink }]}>
                    {item.title}
                  </Text>
                  <Text numberOfLines={1} style={[styles.preview, { color: color.inkSoft }]}>
                    {item.preview}
                  </Text>
                </View>
                <View style={styles.trailing}>
                  <Text style={[styles.when, { color: color.inkFaint }]}>{relativeWhen(item.createdAt)}</Text>
                  <Icon color={color.inkFaint} name="chevronRight" size="sm" />
                </View>
              </Pressable>
            );
          })}
        </ListCard>
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: { gap: 0 },
  header: { marginBottom: tokens.space.sm },
  subtitle: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.bodySm.size,
    lineHeight: tokens.type.bodySm.lineHeight,
    marginLeft: tokens.size.backButton + tokens.space.md,
  },
  filters: { marginBottom: tokens.space.xl, marginTop: tokens.space.xl },
  empty: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.bodySm.size, lineHeight: tokens.type.bodySm.lineHeight, textAlign: "center" },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: tokens.space.lg,
    paddingHorizontal: tokens.cardPadding.horizontal,
    paddingVertical: tokens.cardPadding.vertical,
  },
  avatar: { alignItems: "center", borderRadius: tokens.radius.pill, height: tokens.size.logoSmall, justifyContent: "center", width: tokens.size.logoSmall },
  avatarInitial: { fontFamily: tokens.font.serif, fontSize: tokens.type.body.size },
  rowText: { flex: 1, minWidth: 0 },
  itemTitle: { fontFamily: tokens.font.serif, fontSize: tokens.type.body.size, lineHeight: tokens.type.subtitle.lineHeight },
  preview: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.caption.size, lineHeight: tokens.type.caption.lineHeight, marginTop: tokens.space.xs },
  trailing: { alignItems: "flex-end", gap: tokens.space.xs },
  when: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.overline.size },
});
