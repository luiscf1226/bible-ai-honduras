import { useMutation, useQuery } from "convex/react";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";

import { api } from "../../convex/_generated/api";
import { joinStatusCopy, membersCountLabel, parseInviteToken } from "../../convex/readingGroupCore";
import { AppButton } from "../../src/components/AppButton";
import { AppScreen } from "../../src/components/AppScreen";
import { ScreenHeader } from "../../src/components/ScreenHeader";
import { groupStyles as styles } from "../../src/features/groups/groupStyles";
import { clearPendingGroupInvite } from "../../src/hooks/useGroupInvite";
import { useTheme } from "../../src/theme/ThemeProvider";

/**
 * Invitación a un grupo (#185): `bibleai://grupo?token=…`. Antes de entrar se
 * ve el nombre del grupo, el plan y cuántas personas hay — nunca quiénes son.
 */
export default function InvitacionGrupoScreen() {
  const { color } = useTheme();
  const params = useLocalSearchParams<{ token?: string | string[] }>();
  const token = parseInviteToken(Array.isArray(params.token) ? params.token[0] : params.token);
  const currentUser = useQuery(api.users.current);
  const preview = useQuery(api.readingGroups.previewInvite, token ? { token } : "skip");
  const join = useMutation(api.readingGroups.join);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Con sesión, esta pantalla consume la invitación pendiente: al salir no se
  // vuelve a abrir sola. Sin sesión se queda guardada para después del login.
  useEffect(() => {
    if (!currentUser) return;
    void clearPendingGroupInvite();
    return () => void clearPendingGroupInvite();
  }, [currentUser]);

  const accept = async () => {
    if (!token || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await join({ token });
      if ((result.status === "ok" || result.status === "already") && result.groupId) {
        router.replace({ pathname: "/grupos/[groupId]", params: { groupId: result.groupId } });
        return;
      }
      if (result.status !== "ok" && result.status !== "already") setError(joinStatusCopy(result.status));
    } catch {
      setError("No pudimos unirte al grupo. Revisá tu conexión e intentá de nuevo.");
    } finally {
      setBusy(false);
    }
  };

  const unavailable = !token || preview?.status === "not_found";

  return (
    <AppScreen scroll contentStyle={styles.content}>
      <ScreenHeader accessibilityLabel="Volver" title="Invitación" />

      {unavailable ? (
        <>
          <Text style={[styles.body, { color: color.inkMuted }]} testID="grupo-invitacion-no-encontrada">
            {joinStatusCopy("not_found")}
          </Text>
          <AppButton onPress={() => router.replace("/home")} variant="secondary">
            Ir al inicio
          </AppButton>
        </>
      ) : preview === undefined ? (
        <Text style={[styles.body, { color: color.inkSoft }]}>Abriendo la invitación…</Text>
      ) : (
        <>
          <View style={[styles.card, { backgroundColor: color.surface, borderColor: color.border }]} testID="grupo-invitacion">
            <View style={styles.cardBody}>
              <Text style={[styles.overline, { color: color.accent }]}>TE INVITARON A LEER EN GRUPO</Text>
              <Text style={[styles.title, { color: color.ink }]}>{preview.name}</Text>
              <Text style={[styles.bodySm, { color: color.inkMuted }]}>
                {preview.planName} · {preview.planTotalDays} días · {membersCountLabel(preview.memberCount)}
              </Text>
            </View>
          </View>

          <View style={[styles.card, { backgroundColor: color.surfaceSunk, borderColor: color.border }]}>
            <View style={styles.cardBody}>
              <Text style={[styles.bodySm, { color: color.inkMuted }]}>
                En el grupo se ve tu nombre y cuántos días del plan llevás leídos. Nada más: ni tus notas, ni lo que
                escribís en Sentir, ni tus conversaciones. Podés salir cuando querás.
              </Text>
            </View>
          </View>

          {error ? (
            <Text accessibilityRole="alert" style={[styles.bodySm, { color: color.danger }]} testID="grupo-invitacion-error">
              {error}
            </Text>
          ) : null}

          {currentUser === null ? (
            <>
              <Text style={[styles.bodySm, { color: color.inkSoft }]}>
                Iniciá sesión para unirte. La invitación te va a estar esperando.
              </Text>
              <AppButton onPress={() => router.replace("/")} testID="grupo-invitacion-sesion">
                Iniciar sesión
              </AppButton>
            </>
          ) : preview.alreadyMember ? (
            <AppButton
              onPress={() => router.replace({ pathname: "/grupos/[groupId]", params: { groupId: preview.groupId } })}
              testID="grupo-invitacion-ver"
            >
              Ya estás en este grupo · Ver
            </AppButton>
          ) : (
            <AppButton
              disabled={busy || currentUser === undefined || preview.memberCount >= preview.maxMembers}
              onPress={() => void accept()}
              testID="grupo-invitacion-unirme"
            >
              {preview.memberCount >= preview.maxMembers ? "El grupo está completo" : busy ? "Uniéndote…" : "Unirme al grupo"}
            </AppButton>
          )}
        </>
      )}
    </AppScreen>
  );
}
