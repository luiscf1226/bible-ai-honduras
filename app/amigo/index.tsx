import { useMutation, useQuery } from "convex/react";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { parseFriendCode, requestStatusCopy } from "../../convex/friendsCore";
import { AppButton } from "../../src/components/AppButton";
import { AppScreen } from "../../src/components/AppScreen";
import { ScreenHeader } from "../../src/components/ScreenHeader";
import { CommunityRules } from "../../src/features/friends/CommunityRules";
import { FriendAvatar } from "../../src/features/friends/FriendAvatar";
import { clearPendingFriendInvite } from "../../src/hooks/useFriendInvite";
import { useTheme } from "../../src/theme/ThemeProvider";
import { tokens } from "../../src/theme/tokens";

function openChat(friendshipId: Id<"friendships">) {
  router.replace({ pathname: "/amigos/[friendshipId]", params: { friendshipId } });
}

/**
 * La tarjeta de una persona por su código (1.0.3): el link de WhatsApp
 * (`bibleai://amigo?code=…`) o "Agregar con código" en Amigos. Se ve el
 * nombre visible y el código; nada más hasta que acepte.
 */
export default function AgregarAmigoScreen() {
  const { color } = useTheme();
  const params = useLocalSearchParams<{ code?: string | string[] }>();
  const code = parseFriendCode(Array.isArray(params.code) ? params.code[0] : params.code);
  const currentUser = useQuery(api.users.current);
  const preview = useQuery(api.friends.previewByCode, code && currentUser ? { code } : "skip");
  const request = useMutation(api.friends.request);
  const accept = useMutation(api.friends.accept);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  // La consulta ya pasa a "sent" sola; esto evita un segundo toque mientras llega.
  const [requested, setRequested] = useState(false);

  // Igual que la invitación a un grupo: con sesión, esta pantalla consume el pendiente.
  useEffect(() => {
    if (!currentUser) return;
    void clearPendingFriendInvite();
    return () => void clearPendingFriendInvite();
  }, [currentUser]);

  const add = async () => {
    if (!code || busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const result = await request({ code });
      if (result.status === "accepted" && result.friendshipId) {
        openChat(result.friendshipId);
        return;
      }
      if (result.status === "sent" || result.status === "already_sent") setRequested(true);
      setMessage(requestStatusCopy(result.status));
    } catch {
      setMessage("No se pudo mandar la solicitud. Revisá tu conexión e intentá de nuevo.");
    } finally {
      setBusy(false);
    }
  };

  const acceptRequest = async (friendshipId: Id<"friendships">) => {
    setBusy(true);
    try {
      const result = await accept({ friendshipId });
      if (result.status === "ok") openChat(friendshipId);
      else setMessage("Esa solicitud ya no está.");
    } catch {
      setMessage("No se pudo aceptar. Revisá tu conexión e intentá de nuevo.");
    } finally {
      setBusy(false);
    }
  };

  const body = (() => {
    if (!code) return <Notice text="Este código no sirve. Pedile a la persona que te lo mande de nuevo." />;
    if (currentUser === null) {
      return (
        <>
          <Notice text="Iniciá sesión para agregar a esta persona. La invitación te va a estar esperando." />
          <AppButton onPress={() => router.replace("/")} testID="amigo-sesion">
            Iniciar sesión
          </AppButton>
        </>
      );
    }
    if (currentUser === undefined || preview === undefined) return <Notice text="Buscando…" soft />;
    if (currentUser.communityRulesAcceptedAt === undefined) return <CommunityRules />;
    if (preview.status === "self") return <Notice text="Este es tu propio código. Mandáselo a alguien para que te agregue." />;
    if (preview.status !== "ok") return <Notice testID="amigo-no-encontrado" text={requestStatusCopy("not_found")} />;

    return (
      <>
        <View style={[styles.card, { backgroundColor: color.surface, borderColor: color.border }]} testID="amigo-tarjeta">
          <FriendAvatar initial={preview.initial} />
          <View style={styles.cardText}>
            <Text style={[styles.overline, { color: color.accent }]}>AMIGO EN 3C</Text>
            <Text style={[styles.name, { color: color.ink }]}>{preview.name}</Text>
            <Text style={[styles.code, { color: color.inkSoft }]}>{preview.code}</Text>
          </View>
        </View>

        {message ? (
          <Text accessibilityRole="alert" style={[styles.bodySm, { color: color.inkMuted }]} testID="amigo-mensaje">
            {message}
          </Text>
        ) : null}

        {preview.relation === "friends" && preview.friendshipId ? (
          <AppButton onPress={() => openChat(preview.friendshipId!)} testID="amigo-abrir-chat">
            Ya son amigos · Abrir el chat
          </AppButton>
        ) : preview.relation === "received" && preview.friendshipId ? (
          <AppButton disabled={busy} onPress={() => void acceptRequest(preview.friendshipId!)} testID="amigo-aceptar">
            Te mandó una solicitud · Aceptar
          </AppButton>
        ) : preview.relation === "sent" || requested ? (
          message ? null : <Notice text={requestStatusCopy("already_sent")} soft />
        ) : (
          <AppButton disabled={busy} icon="plus" onPress={() => void add()} testID="amigo-agregar">
            {busy ? "Enviando…" : "Agregar"}
          </AppButton>
        )}

        <Text style={[styles.caption, { color: color.inkSoft }]}>
          Cuando acepte, van a poder escribirse y mandarse versículos. Si alguien te molesta, lo podés reportar o bloquear
          desde el chat.
        </Text>
      </>
    );
  })();

  return (
    <AppScreen scroll contentStyle={styles.content}>
      <ScreenHeader accessibilityLabel="Volver" title="Agregar amigo" />
      {body}
    </AppScreen>
  );
}

function Notice({ soft = false, testID, text }: { text: string; soft?: boolean; testID?: string }) {
  const { color } = useTheme();
  return (
    <Text style={[styles.body, { color: soft ? color.inkSoft : color.inkMuted }]} testID={testID}>
      {text}
    </Text>
  );
}

const styles = StyleSheet.create({
  content: { gap: tokens.space.lg, paddingBottom: tokens.space.xxl },
  body: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.body.size, lineHeight: tokens.type.body.lineHeight },
  bodySm: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.bodySm.size, lineHeight: tokens.type.bodySm.lineHeight },
  caption: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.caption.size, lineHeight: tokens.type.caption.lineHeight },
  card: {
    alignItems: "center",
    borderRadius: tokens.radius.xxl,
    borderWidth: 1,
    flexDirection: "row",
    gap: tokens.space.lg,
    paddingHorizontal: tokens.cardPadding.horizontal,
    paddingVertical: tokens.cardPadding.vertical,
  },
  cardText: { flex: 1, gap: tokens.space.xxs },
  overline: {
    fontFamily: tokens.font.sansMedium,
    fontSize: tokens.type.overline.size,
    letterSpacing: tokens.type.overline.letterSpacing,
    lineHeight: tokens.type.overline.lineHeight,
  },
  name: { fontFamily: tokens.font.serif, fontSize: tokens.type.title.size, lineHeight: tokens.type.title.lineHeight },
  code: { fontFamily: tokens.font.sans, fontSize: tokens.type.caption.size, lineHeight: tokens.type.caption.lineHeight },
});
