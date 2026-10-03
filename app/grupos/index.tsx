import { useQuery } from "convex/react";
import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { api } from "../../convex/_generated/api";
import { GROUP_MAX_MEMBERS, MAX_GROUPS_PER_USER, membersCountLabel } from "../../convex/readingGroupCore";
import { AppButton } from "../../src/components/AppButton";
import { AppScreen } from "../../src/components/AppScreen";
import { ScreenHeader } from "../../src/components/ScreenHeader";
import { groupStyles as styles } from "../../src/features/groups/groupStyles";
import { useTheme } from "../../src/theme/ThemeProvider";

/**
 * Leer en grupo (#185, cierra #162): mis grupos y crear uno. Gratis, como leer.
 * No está en el prototipo: ver `src/features/groups/groupStyles.ts`.
 */
export default function GruposScreen() {
  const { color } = useTheme();
  const groups = useQuery(api.readingGroups.mine, {});
  const atLimit = (groups?.length ?? 0) >= MAX_GROUPS_PER_USER;

  return (
    <AppScreen scroll contentStyle={styles.content}>
      <ScreenHeader accessibilityLabel="Volver" title="Leer en grupo" />

      <View style={[styles.card, { backgroundColor: color.surfaceSunk, borderColor: color.border }]} testID="grupos-privacidad">
        <View style={styles.cardBody}>
          <Text style={[styles.bodySm, { color: color.inkMuted }]}>
            Un grupo cerrado de hasta {GROUP_MAX_MEMBERS} personas leyendo el mismo plan: tu familia, tu célula o tu clase.
            Solo se ve el nombre y cuántos días lleva leídos cada quien. No hay chat ni ranking.
          </Text>
        </View>
      </View>

      {groups === undefined ? (
        <Text style={[styles.body, { color: color.inkSoft }]}>Buscando tus grupos…</Text>
      ) : groups.length === 0 ? (
        <Text style={[styles.body, { color: color.inkMuted }]} testID="grupos-vacio">
          Todavía no estás en ningún grupo. Creá uno y mandá el link por WhatsApp.
        </Text>
      ) : (
        <View style={[styles.card, { backgroundColor: color.surface, borderColor: color.border }]} testID="grupos-lista">
          {groups.map((group, index) => (
            <Pressable
              accessibilityRole="button"
              key={group.id}
              onPress={() => router.push({ pathname: "/grupos/[groupId]", params: { groupId: group.id } })}
              style={({ pressed }) => [
                styles.row,
                index > 0 && styles.rowDivider,
                index > 0 && { borderTopColor: color.border },
                pressed && styles.pressed,
              ]}
              testID={`grupos-item-${index}`}
            >
              <View style={styles.rowText}>
                <Text style={[styles.rowLabel, { color: color.ink }]}>{group.name}</Text>
                <Text style={[styles.caption, { color: color.inkSoft }]}>{membersCountLabel(group.memberCount)}</Text>
              </View>
              <Text style={[styles.rowAction, { color: color.accentDeep }]}>Ver ›</Text>
            </Pressable>
          ))}
        </View>
      )}

      <AppButton disabled={groups === undefined || atLimit} onPress={() => router.push("/grupos/nuevo")} testID="grupos-crear">
        Crear un grupo
      </AppButton>
      {atLimit ? (
        <Text style={[styles.caption, { color: color.inkSoft }]}>
          Podés estar en {MAX_GROUPS_PER_USER} grupos a la vez. Salí de alguno para crear otro.
        </Text>
      ) : null}
    </AppScreen>
  );
}
