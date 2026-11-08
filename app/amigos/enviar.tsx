import { useMutation, useQuery } from "convex/react";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { sendStatusCopy, verseLabel } from "../../convex/friendsCore";
import { AppButton } from "../../src/components/AppButton";
import { AppScreen } from "../../src/components/AppScreen";
import { Icon } from "../../src/components/Icon";
import { ListCard, ListSectionLabel } from "../../src/components/ListRow";
import { ScreenHeader } from "../../src/components/ScreenHeader";
import { CommunityRules } from "../../src/features/friends/CommunityRules";
import { FriendAvatar } from "../../src/features/friends/FriendAvatar";
import { withPressed } from "../../src/theme/pressed";
import { useTheme } from "../../src/theme/ThemeProvider";
import { tokens } from "../../src/theme/tokens";

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
const asNumber = (value: string | undefined) => (value === undefined ? undefined : Number(value));

/**
 * "Enviar a un amigo" desde la hoja del versículo (1.0.3): se ve el
 * versículo tal como va a llegar (texto del servidor, regla dura #4) y se
 * elige a quién. Al enviar se abre ese chat.
 */
export default function SendToFriendScreen() {
  const { color } = useTheme();
  const params = useLocalSearchParams<{ book?: string; chapter?: string; verse?: string; verseEnd?: string }>();
  const book = one(params.book) ?? "";
  const chapter = asNumber(one(params.chapter));
  const verse = asNumber(one(params.verse));
  const verseEnd = asNumber(one(params.verseEnd));
  const valid = book.length > 0 && Number.isInteger(chapter) && Number.isInteger(verse);
  const ref = valid ? { book, chapter: chapter!, verse: verse!, ...(verseEnd !== undefined && Number.isInteger(verseEnd) ? { verseEnd } : {}) } : null;

  const preview = useQuery(api.friends.versePreview, ref ?? "skip");
  const overview = useQuery(api.friends.overview, {});
  const sendVerse = useMutation(api.friends.sendVerse);
  const [sending, setSending] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const send = async (friendshipId: Id<"friendships">) => {
    if (!ref || sending) return;
    setSending(friendshipId);
    setNotice(null);
    try {
      const result = await sendVerse({ friendshipId, ...ref });
      if (result.status === "ok") {
        router.replace({ pathname: "/amigos/[friendshipId]", params: { friendshipId } });
        return;
      }
      setNotice(sendStatusCopy(result.status));
    } catch {
      setNotice("No se pudo enviar. Revisá tu conexión e intentá de nuevo.");
    } finally {
      setSending(null);
    }
  };

  return (
    <AppScreen scroll contentStyle={styles.content}>
      <ScreenHeader accessibilityLabel="Volver" title="Enviar a un amigo" />

      {!ref || preview === null ? (
        <Text style={[styles.body, { color: color.inkMuted }]} testID="amigos-enviar-sin-versiculo">
          No encontramos ese versículo.
        </Text>
      ) : (
        <View style={[styles.verse, { backgroundColor: color.paper, borderColor: color.border }]} testID="amigos-enviar-versiculo">
          <Text style={[styles.overline, { color: color.accent }]}>VERSÍCULO</Text>
          <Text style={[styles.verseText, { color: color.ink }]}>{preview ? `“${preview.text}”` : "…"}</Text>
          <Text style={[styles.verseRef, { color: color.inkMuted }]}>
            {verseLabel(preview ?? ref)} ({preview?.version ?? "RV1909"})
          </Text>
        </View>
      )}

      {notice ? (
        <Text accessibilityRole="alert" style={[styles.bodySm, { color: color.danger }]} testID="amigos-enviar-aviso">
          {notice}
        </Text>
      ) : null}

      {overview === undefined ? (
        <Text style={[styles.body, { color: color.inkSoft }]}>Cargando tus amigos…</Text>
      ) : overview === null ? (
        <Text style={[styles.body, { color: color.inkMuted }]}>Iniciá sesión para mandarle versículos a tus amigos.</Text>
      ) : !overview.rulesAccepted ? (
        <CommunityRules />
      ) : overview.friends.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[styles.body, { color: color.inkMuted }]} testID="amigos-enviar-vacio">
            Todavía no tenés amigos en la app. Invitá a alguien con tu código y después le mandás este versículo.
          </Text>
          <AppButton onPress={() => router.replace("/amigos")} variant="secondary">
            Ir a Amigos
          </AppButton>
        </View>
      ) : (
        <View>
          <ListSectionLabel>¿A quién se lo mandás?</ListSectionLabel>
          <ListCard testID="amigos-enviar-lista">
            {overview.friends.map((friend, index) => (
              <Pressable
                accessibilityHint={`Le manda el versículo a ${friend.name} y abre el chat.`}
                accessibilityRole="button"
                disabled={sending !== null || !preview}
                key={friend.friendshipId}
                onPress={() => void send(friend.friendshipId)}
                style={withPressed(styles.row)}
                testID={`amigos-enviar-${index}`}
              >
                <FriendAvatar initial={friend.initial} />
                <Text style={[styles.name, { color: color.ink }]}>{friend.name}</Text>
                <View style={[styles.send, { backgroundColor: color.ink }]}>
                  {sending === friend.friendshipId ? (
                    <Text style={[styles.sendLabel, { color: color.surface }]}>…</Text>
                  ) : (
                    <Icon color={color.surface} name="send" size="sm" />
                  )}
                </View>
              </Pressable>
            ))}
          </ListCard>
        </View>
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: { gap: tokens.space.lg, paddingBottom: tokens.space.xxl },
  body: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.body.size, lineHeight: tokens.type.body.lineHeight },
  bodySm: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.bodySm.size, lineHeight: tokens.type.bodySm.lineHeight },
  empty: { gap: tokens.space.lg },
  verse: {
    borderRadius: tokens.radius.xl,
    borderWidth: 1,
    gap: tokens.space.sm,
    paddingHorizontal: tokens.cardPadding.horizontal,
    paddingVertical: tokens.cardPadding.vertical,
  },
  overline: {
    fontFamily: tokens.font.sansMedium,
    fontSize: tokens.type.overline.size,
    letterSpacing: tokens.type.overline.letterSpacing,
    lineHeight: tokens.type.overline.lineHeight,
  },
  verseText: { fontFamily: tokens.font.serif, fontSize: tokens.type.subtitle.size, lineHeight: tokens.type.subtitle.lineHeight },
  verseRef: { fontFamily: tokens.font.sansMedium, fontSize: tokens.type.caption.size, lineHeight: tokens.type.caption.lineHeight },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: tokens.space.md,
    paddingHorizontal: tokens.cardPadding.horizontal,
    paddingVertical: tokens.space.lg,
  },
  name: { flex: 1, fontFamily: tokens.font.serif, fontSize: tokens.type.subtitle.size, lineHeight: tokens.type.bodySm.lineHeight },
  send: {
    alignItems: "center",
    borderRadius: tokens.radius.pill,
    height: tokens.size.sendButton,
    justifyContent: "center",
    width: tokens.size.sendButton,
  },
  sendLabel: { fontFamily: tokens.font.sansMedium, fontSize: tokens.type.caption.size },
});
