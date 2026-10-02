import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { Icon, type IconName } from "../../components/Icon";
import { useTheme } from "../../theme/ThemeProvider";
import { tokens } from "../../theme/tokens";
import { CharacterAvatar } from "./CharacterAvatar";
import { featuredShortcuts, type FeaturedShortcutId } from "./featuredCharacter";
import { openFeaturedShortcut, useFeaturedCharacter } from "./useFeaturedCharacter";

const SHORTCUT_ICONS: Record<FeaturedShortcutId, IconName> = {
  historia: "image",
  capitulos: "book",
  recorrido: "calendar",
  conversar: "voice",
};

/**
 * Personaje del mes arriba de la lista de Voces (#200, design/oleada-ux.md
 * §Temporadas): avatar `size.avatar` con anillo `accent`, `DEL MES`, nombre en
 * `subtitle`, una línea curada de quién fue y los atajos. Tocar la tarjeta
 * abre la conversación, igual que una fila de la lista.
 */
export function FeaturedCharacterCard() {
  const { color } = useTheme();
  const featured = useFeaturedCharacter();
  if (!featured) return null;
  const { character, content } = featured;

  return (
    <Pressable
      accessibilityHint={`Abre la conversación con ${character.name}.`}
      accessibilityLabel={`Personaje del mes: ${character.name}`}
      // En web, role=button anida los atajos dentro de un <button> (como HomeCard).
      accessibilityRole={Platform.OS === "web" ? undefined : "button"}
      onPress={() => openFeaturedShortcut("conversar", featured)}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: color.surface, borderColor: color.border },
        pressed && styles.pressed,
      ]}
      testID="voces-featured"
    >
      <View style={styles.top}>
        <CharacterAvatar character={character} ring size={tokens.size.avatar} />
        <View style={styles.text}>
          <Text style={[styles.overline, { color: color.accent }]}>Del mes</Text>
          <Text style={[styles.name, { color: color.ink }]}>{character.name}</Text>
        </View>
      </View>
      <Text style={[styles.line, { color: color.inkMuted }]}>{content.line}</Text>
      <View style={[styles.shortcuts, { borderTopColor: color.border }]}>
        {featuredShortcuts(content).map((shortcut) => (
          <Pressable
            accessibilityHint={shortcutHint(shortcut.id, character.name, content.chapter)}
            accessibilityLabel={shortcut.label}
            accessibilityRole="button"
            hitSlop={tokens.space.xs}
            key={shortcut.id}
            onPress={() => openFeaturedShortcut(shortcut.id, featured)}
            style={({ pressed }) => [styles.shortcut, pressed && styles.pressed]}
            testID={`voces-featured-${shortcut.id}`}
          >
            <Icon color={color.accent} name={SHORTCUT_ICONS[shortcut.id]} size="sm" />
            <Text numberOfLines={1} style={[styles.shortcutLabel, { color: color.inkMuted }]}>
              {shortcut.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </Pressable>
  );
}

function shortcutHint(id: FeaturedShortcutId, name: string, chapter: { book: string; chapter: number }): string {
  if (id === "historia") return `Abre la historia de ${name}.`;
  if (id === "capitulos") return `Abre ${chapter.book} ${chapter.chapter} en el lector.`;
  if (id === "recorrido") return `Abre el recorrido de la vida de ${name}.`;
  return `Abre la conversación con ${name}.`;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: tokens.radius.xxl,
    borderWidth: 1,
    gap: tokens.space.md,
    paddingHorizontal: tokens.cardPadding.horizontal,
    paddingVertical: tokens.cardPadding.vertical,
  },
  pressed: { opacity: tokens.opacity.pressed },
  top: { alignItems: "center", flexDirection: "row", gap: tokens.space.lg },
  text: { flex: 1, gap: tokens.space.xs },
  overline: {
    fontFamily: tokens.font.sansMedium,
    fontSize: tokens.type.overline.size,
    letterSpacing: tokens.type.overline.letterSpacing,
    lineHeight: tokens.type.overline.lineHeight,
    textTransform: "uppercase",
  },
  name: { fontFamily: tokens.font.serif, fontSize: tokens.type.subtitle.size, lineHeight: tokens.type.subtitle.lineHeight },
  line: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.bodySm.size, lineHeight: tokens.type.bodySm.lineHeight },
  // Fila de atajos: celdas iguales, ícono `sm` `accent` sobre la etiqueta.
  shortcuts: { borderTopWidth: 1, flexDirection: "row", paddingTop: tokens.space.md },
  shortcut: { alignItems: "center", flex: 1, gap: tokens.space.xs },
  shortcutLabel: { fontFamily: tokens.font.sans, fontSize: tokens.type.caption.size, lineHeight: tokens.type.caption.lineHeight },
});
