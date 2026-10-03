import { useMutation, useQuery } from "convex/react";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { groupInviteMessage, memberProgressLabel, membersCountLabel } from "../../convex/readingGroupCore";
import { AppButton } from "../../src/components/AppButton";
import { AppScreen } from "../../src/components/AppScreen";
import { ScreenHeader } from "../../src/components/ScreenHeader";
import { groupStyles as styles } from "../../src/features/groups/groupStyles";
import { openReadingPlan } from "../../src/lib/openPassage";
import { shareContent } from "../../src/lib/share";
import { useTheme } from "../../src/theme/ThemeProvider";

/**
 * Un grupo (#185): el plan, el avance de cada quien en orden alfabético,
 * invitar por WhatsApp y salir. Sin chat, sin ranking, sin "atrasados".
 */
export default function GrupoScreen() {
  const { color } = useTheme();
  const params = useLocalSearchParams<{ groupId?: string | string[] }>();
  const rawId = Array.isArray(params.groupId) ? params.groupId[0] : params.groupId;
  const groupId = rawId as Id<"readingGroups"> | undefined;
  const detail = useQuery(api.readingGroups.detail, groupId ? { groupId } : "skip");
  const currentUser = useQuery(api.users.current);
  const leave = useMutation(api.readingGroups.leave);
  const rotateInvite = useMutation(api.readingGroups.rotateInvite);
  const [confirmingLeave, setConfirmingLeave] = useState(false);
  const [busy, setBusy] = useState<"leave" | "rotate" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (detail === undefined) {
    return (
      <AppScreen contentStyle={styles.content}>
        <ScreenHeader accessibilityLabel="Volver" title="Grupo" />
        <Text style={[styles.body, { color: color.inkSoft }]}>Abriendo el grupo…</Text>
      </AppScreen>
    );
  }
  if (detail === null) {
    return (
      <AppScreen contentStyle={styles.content}>
        <ScreenHeader accessibilityLabel="Volver" title="Grupo" />
        <Text style={[styles.body, { color: color.inkMuted }]} testID="grupo-no-disponible">
          Este grupo ya no existe o ya no sos parte de él.
        </Text>
        <AppButton onPress={() => router.replace("/grupos")} variant="secondary">
          Ver mis grupos
        </AppButton>
      </AppScreen>
    );
  }

  const full = detail.members.length >= detail.maxMembers;

  const invite = async () => {
    if (!currentUser?.referralCode) return;
    setNotice(null);
    const result = await shareContent({
      text: groupInviteMessage(detail.name),
      referralCode: currentUser.referralCode,
      groupInviteToken: detail.inviteToken,
    });
    if (result.status === "error") setNotice("No se pudo abrir WhatsApp. Probá de nuevo.");
  };

  const newLink = async () => {
    if (busy) return;
    setBusy("rotate");
    try {
      await rotateInvite({ groupId: detail.id });
      setNotice("Listo: el link anterior ya no sirve. Quien ya entró sigue en el grupo.");
    } catch {
      setNotice("No pudimos cambiar el link. Revisá tu conexión e intentá de nuevo.");
    } finally {
      setBusy(null);
    }
  };

  const confirmLeave = async () => {
    if (busy) return;
    setBusy("leave");
    try {
      await leave({ groupId: detail.id });
      router.replace("/grupos");
    } catch {
      setNotice("No pudimos sacarte del grupo. Revisá tu conexión e intentá de nuevo.");
      setBusy(null);
    }
  };

  return (
    <AppScreen scroll contentStyle={styles.content}>
      <ScreenHeader accessibilityLabel="Volver" title={detail.kindLabel} />

      <View style={[styles.card, { backgroundColor: color.surface, borderColor: color.border }]} testID="grupo-plan">
        <View style={styles.cardBody}>
          <Text style={[styles.overline, { color: color.accent }]}>
            PLAN EN GRUPO · {detail.plan.totalDays} DÍAS
          </Text>
          <Text style={[styles.title, { color: color.ink }]}>{detail.plan.name}</Text>
          <Text style={[styles.bodySm, { color: color.inkMuted }]}>{detail.plan.description}</Text>
          <AppButton onPress={() => openReadingPlan(detail.plan.id)} testID="grupo-abrir-plan" variant="secondary">
            Abrir el plan
          </AppButton>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.overline, { color: color.accent }]}>
          {membersCountLabel(detail.members.length).toUpperCase()}
        </Text>
        <View style={[styles.card, { backgroundColor: color.surface, borderColor: color.border }]} testID="grupo-miembros">
          {detail.members.map((member, index) => (
            <View
              key={`${member.name}-${index}`}
              style={[styles.row, index > 0 && styles.rowDivider, index > 0 && { borderTopColor: color.border }]}
            >
              <View style={styles.rowText}>
                <Text style={[styles.rowLabel, { color: color.ink }]}>
                  {member.name}
                  {member.isMe ? " · vos" : ""}
                </Text>
                <Text style={[styles.caption, { color: member.todayCompleted ? color.sage : color.inkSoft }]}>
                  {memberProgressLabel(member)}
                </Text>
              </View>
            </View>
          ))}
        </View>
        <Text style={[styles.caption, { color: color.inkSoft }]}>
          En orden alfabético. Cada quien lee a su ritmo: acá no se ve quién va atrasado.
        </Text>
      </View>

      <AppButton disabled={full || !currentUser?.referralCode} onPress={() => void invite()} testID="grupo-invitar">
        {full ? "El grupo está completo" : "Invitar por WhatsApp"}
      </AppButton>
      {detail.isOwner ? (
        <AppButton disabled={busy !== null} onPress={() => void newLink()} testID="grupo-cambiar-link" variant="quiet">
          {busy === "rotate" ? "Cambiando…" : "Cambiar el link de invitación"}
        </AppButton>
      ) : null}
      {notice ? (
        <Text accessibilityRole="alert" style={[styles.bodySm, { color: color.inkMuted }]} testID="grupo-aviso">
          {notice}
        </Text>
      ) : null}

      <View style={[styles.card, { backgroundColor: color.surface, borderColor: color.border }]}>
        <Pressable
          accessibilityRole="button"
          onPress={() => setConfirmingLeave((value) => !value)}
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          testID="grupo-salir"
        >
          <Text style={[styles.rowLabel, { color: color.danger }]}>Salir del grupo</Text>
        </Pressable>
        {confirmingLeave ? (
          <View style={[styles.cardBody, styles.rowDivider, { borderTopColor: color.border }]}>
            <Text style={[styles.bodySm, { color: color.inkMuted }]}>
              {detail.isOwner && detail.members.length > 1
                ? "Vas a dejar de ver el avance del grupo. El grupo queda a cargo de quien entró primero después de vos. Tu avance en el plan se queda en tu cuenta."
                : detail.members.length === 1
                  ? "Sos la única persona del grupo: al salir, el grupo se borra. Tu avance en el plan se queda en tu cuenta."
                  : "Vas a dejar de ver el avance del grupo y los demás dejan de ver el tuyo. Tu avance en el plan se queda en tu cuenta."}
            </Text>
            <AppButton disabled={busy !== null} onPress={() => void confirmLeave()} testID="grupo-salir-confirmar" variant="secondary">
              {busy === "leave" ? "Saliendo…" : "Sí, salir del grupo"}
            </AppButton>
          </View>
        ) : null}
      </View>
    </AppScreen>
  );
}
