import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { AppButton } from "../../components/AppButton";
import { useTheme } from "../../theme/ThemeProvider";
import { tokens } from "../../theme/tokens";
import { profileInitial, type ProfileStat } from "./profile";

type ProfileHeaderProps = {
  name: string | null | undefined;
  email: string | null | undefined;
  /** `null` con el candado cerrado o cargando: los números son de lo personal. */
  stats: ProfileStat[] | null;
};

/**
 * Cabecera de perfil de Mi espacio, a la manera de Instagram: foto (inicial
 * sobre `accent`), los números de lo tuyo al lado, nombre y correo abajo, y
 * el botón de Ajustes ancho. Vive fuera del candado de "Proteger lo personal":
 * Ajustes y la cuenta tienen que estar siempre a mano.
 */
export function ProfileHeader({ email, name, stats }: ProfileHeaderProps) {
  const { color } = useTheme();
  return (
    <View style={styles.wrap} testID="perfil">
      <View style={styles.top}>
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[styles.avatar, { backgroundColor: color.accent }]}
        >
          <Text style={[styles.initial, { color: color.avatarInitial }]}>{profileInitial(name, email)}</Text>
        </View>
        <View style={styles.stats}>
          {(stats ?? []).map((stat) => (
            <View accessible accessibilityLabel={`${stat.count} ${stat.label}`} key={stat.label} style={styles.stat} testID={`perfil-${stat.id}`}>
              <Text style={[styles.statCount, { color: color.ink }]}>{stat.count}</Text>
              <Text numberOfLines={1} style={[styles.statLabel, { color: color.inkSoft }]}>
                {stat.label}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.identity}>
        <Text accessibilityRole="header" numberOfLines={1} style={[styles.name, { color: color.ink }]} testID="perfil-nombre">
          {name?.trim() || "Tu perfil"}
        </Text>
        {email ? (
          <Text numberOfLines={1} style={[styles.email, { color: color.inkSoft }]} testID="perfil-correo">
            {email}
          </Text>
        ) : null}
      </View>

      <AppButton icon="gear" onPress={() => router.push("/ajustes")} testID="perfil-ajustes" variant="secondary">
        Ajustes y cuenta
      </AppButton>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: tokens.space.lg, marginBottom: tokens.space.xl },
  top: { alignItems: "center", flexDirection: "row", gap: tokens.space.xl },
  avatar: {
    alignItems: "center",
    borderRadius: tokens.radius.pill,
    height: tokens.size.avatarLarge,
    justifyContent: "center",
    width: tokens.size.avatarLarge,
  },
  initial: { fontFamily: tokens.font.serif, fontSize: tokens.type.display.size, lineHeight: tokens.type.display.lineHeight },
  stats: { flex: 1, flexDirection: "row", justifyContent: "space-around" },
  stat: { alignItems: "center", gap: tokens.space.xxs },
  statCount: { fontFamily: tokens.font.serif, fontSize: tokens.type.title.size, lineHeight: tokens.type.title.lineHeight },
  statLabel: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.caption.size, lineHeight: tokens.type.caption.lineHeight },
  identity: { gap: tokens.space.xxs },
  name: { fontFamily: tokens.font.sansMedium, fontSize: tokens.type.label.size, lineHeight: tokens.type.subtitle.lineHeight },
  email: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.caption.size, lineHeight: tokens.type.caption.lineHeight },
});
