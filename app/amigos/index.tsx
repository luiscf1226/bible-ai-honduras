import { useMutation, useQuery } from "convex/react";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { friendInviteMessage, parseFriendCode, suspensionNotice } from "../../convex/friendsCore";
import { AppButton } from "../../src/components/AppButton";
import { AppScreen } from "../../src/components/AppScreen";
import { ListCard, ListRow, ListSectionLabel } from "../../src/components/ListRow";
import { ScreenHeader } from "../../src/components/ScreenHeader";
import { listTimeLabel } from "../../src/features/friends/chatLogic";
import { CommunityRules } from "../../src/features/friends/CommunityRules";
import { FriendAvatar, UnreadBadge } from "../../src/features/friends/FriendAvatar";
import { copyToClipboard } from "../../src/lib/clipboard";
import { shareContent } from "../../src/lib/share";
import { withPressed } from "../../src/theme/pressed";
import { useTheme } from "../../src/theme/ThemeProvider";
import { tokens } from "../../src/theme/tokens";

function openChat(friendshipId: Id<"friendships">) {
  router.push({ pathname: "/amigos/[friendshipId]", params: { friendshipId } });
}

/**
 * Amigos (1.0.3, design/oleada-ux.md §Amigos y chat): solicitudes, amigos con
 * su último mensaje, tu código para invitar y agregar con un código.
 */
export default function AmigosScreen() {
  const { color } = useTheme();
  const overview = useQuery(api.friends.overview, {});
  const blocked = useQuery(api.friends.blocked, {});
  const accept = useMutation(api.friends.accept);
  const remove = useMutation(api.friends.remove);
  const unblock = useMutation(api.friends.unblock);
  const [code, setCode] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showBlocked, setShowBlocked] = useState(false);

  const run = async (id: string, action: () => Promise<unknown>) => {
    setBusyId(id);
    setNotice(null);
    try {
      await action();
    } catch {
      setNotice("No se pudo hacer. Revisá tu conexión e intentá de nuevo.");
    } finally {
      setBusyId(null);
    }
  };

  const invite = async () => {
    if (!overview) return;
    setNotice(null);
    const result = await shareContent({ text: friendInviteMessage(overview.code), referralCode: overview.code, friendInvite: true });
    if (result.status === "error") setNotice("No se pudo abrir WhatsApp. Probá de nuevo.");
  };

  const copyCode = async () => {
    if (!overview) return;
    const result = await copyToClipboard(overview.code);
    setNotice(result.status === "copied" ? "Copiamos tu código." : "No se pudo copiar el código.");
  };

  const parsedCode = parseFriendCode(code);
  const lookUp = () => {
    if (!parsedCode) {
      setNotice("Los códigos se ven así: BAH-1A2B3C4.");
      return;
    }
    setCode("");
    router.push({ pathname: "/amigo", params: { code: parsedCode } });
  };

  if (overview === undefined) {
    return (
      <AppScreen scroll contentStyle={styles.content}>
        <ScreenHeader accessibilityLabel="Volver" title="Amigos" />
        <Text style={[styles.body, { color: color.inkSoft }]}>Cargando…</Text>
      </AppScreen>
    );
  }

  if (overview === null) {
    return (
      <AppScreen scroll contentStyle={styles.content}>
        <ScreenHeader accessibilityLabel="Volver" title="Amigos" />
        <Text style={[styles.body, { color: color.inkMuted }]}>Iniciá sesión para agregar amigos y escribirles.</Text>
        <AppButton onPress={() => router.replace("/")}>Iniciar sesión</AppButton>
      </AppScreen>
    );
  }

  if (!overview.rulesAccepted) {
    return (
      <AppScreen scroll contentStyle={styles.content}>
        <ScreenHeader accessibilityLabel="Volver" title="Amigos" />
        <CommunityRules />
      </AppScreen>
    );
  }

  return (
    <AppScreen scroll contentStyle={styles.content}>
      <ScreenHeader accessibilityLabel="Volver" title="Amigos" />

      {overview.suspended ? (
        <ListCard tone="sunk" testID="amigos-suspendido">
          <Text style={[styles.note, { color: color.danger }]}>
            {suspensionNotice(overview.suspendedUntil)}
          </Text>
        </ListCard>
      ) : null}

      {notice ? (
        <Text accessibilityRole="alert" style={[styles.bodySm, { color: color.inkMuted }]} testID="amigos-aviso">
          {notice}
        </Text>
      ) : null}

      {overview.requests.length > 0 ? (
        <View>
          <ListSectionLabel>Solicitudes</ListSectionLabel>
          <ListCard testID="amigos-solicitudes">
            {overview.requests.map((request, index) => (
              <View key={request.friendshipId} style={styles.personRow} testID={`amigos-solicitud-${index}`}>
                {/* Tocar a la persona abre la solicitud, con el menú para reportar o bloquear. */}
                <Pressable
                  accessibilityHint="Abre la solicitud. Desde ahí también podés reportar o bloquear."
                  accessibilityRole="button"
                  onPress={() => openChat(request.friendshipId)}
                  style={withPressed(styles.personTap)}
                >
                  <FriendAvatar initial={request.initial} />
                  <View style={styles.personText}>
                    <Text style={[styles.name, { color: color.ink }]}>{request.name}</Text>
                    <Text style={[styles.caption, { color: color.inkSoft }]}>Quiere ser tu amigo</Text>
                  </View>
                </Pressable>
                <View style={styles.requestActions}>
                  <SmallButton
                    disabled={busyId !== null}
                    label="Rechazar"
                    onPress={() => void run(request.friendshipId, () => remove({ friendshipId: request.friendshipId }))}
                    testID={`amigos-solicitud-${index}-rechazar`}
                  />
                  <SmallButton
                    disabled={busyId !== null}
                    label="Aceptar"
                    onPress={() => void run(request.friendshipId, () => accept({ friendshipId: request.friendshipId }))}
                    primary
                    testID={`amigos-solicitud-${index}-aceptar`}
                  />
                </View>
              </View>
            ))}
          </ListCard>
        </View>
      ) : null}

      <View>
        <ListSectionLabel>Tus amigos</ListSectionLabel>
        {overview.friends.length === 0 ? (
          <Text style={[styles.body, { color: color.inkMuted }]} testID="amigos-vacio">
            Todavía no tenés amigos en la app. Mandale tu código a alguien de tu iglesia o de tu familia.
          </Text>
        ) : (
          <ListCard testID="amigos-lista">
            {overview.friends.map((friend, index) => {
              const time = listTimeLabel(friend.lastMessageAt);
              return (
                <Pressable
                  accessibilityHint="Abre el chat."
                  accessibilityLabel={`${friend.name}. ${friend.preview}`}
                  accessibilityRole="button"
                  key={friend.friendshipId}
                  onPress={() => openChat(friend.friendshipId)}
                  style={withPressed(styles.personRow)}
                  testID={`amigos-amigo-${index}`}
                >
                  <FriendAvatar initial={friend.initial} />
                  <View style={styles.personText}>
                    <Text style={[styles.name, { color: color.ink }]}>{friend.name}</Text>
                    <Text
                      numberOfLines={1}
                      style={[friend.unread > 0 ? styles.previewUnread : styles.preview, { color: friend.unread > 0 ? color.ink : color.inkMuted }]}
                    >
                      {friend.preview}
                    </Text>
                  </View>
                  <View style={styles.meta}>
                    {time ? <Text style={[styles.caption, { color: friend.unread > 0 ? color.accentDeep : color.inkSoft }]}>{time}</Text> : null}
                    <UnreadBadge count={friend.unread} testID={`amigos-amigo-${index}-no-leidos`} />
                  </View>
                </Pressable>
              );
            })}
          </ListCard>
        )}
      </View>

      <View>
        <ListSectionLabel>Agregar amigos</ListSectionLabel>
        <View style={[styles.card, { backgroundColor: color.surface, borderColor: color.border }]} testID="amigos-mi-codigo">
          <Text style={[styles.caption, { color: color.inkSoft }]}>Tu código</Text>
          <Text selectable style={[styles.code, { color: color.ink }]}>
            {overview.code}
          </Text>
          <View style={styles.buttons}>
            <AppButton icon="whatsapp" onPress={() => void invite()} testID="amigos-invitar">
              Invitar por WhatsApp
            </AppButton>
            <AppButton icon="copy" onPress={() => void copyCode()} testID="amigos-copiar" variant="secondary">
              Copiar mi código
            </AppButton>
          </View>
        </View>

        <View style={[styles.card, styles.cardGap, { backgroundColor: color.surface, borderColor: color.border }]}>
          <Text style={[styles.label, { color: color.ink }]}>Agregar con código</Text>
          <View style={[styles.inputRow, { borderColor: color.borderStrong }]}>
            <TextInput
              accessibilityLabel="Código de amigo"
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={12}
              onChangeText={setCode}
              onSubmitEditing={lookUp}
              placeholder="BAH-1A2B3C4"
              placeholderTextColor={color.inkFaint}
              returnKeyType="search"
              style={[styles.input, { color: color.ink }]}
              testID="amigos-codigo-input"
              value={code}
            />
            <SmallButton disabled={code.trim().length === 0} label="Buscar" onPress={lookUp} primary testID="amigos-codigo-buscar" />
          </View>
        </View>
      </View>

      {overview.sent.length > 0 ? (
        <View>
          <ListSectionLabel>Esperando respuesta</ListSectionLabel>
          <ListCard testID="amigos-enviadas">
            {overview.sent.map((request, index) => (
              <View key={request.friendshipId} style={styles.personRow}>
                <FriendAvatar initial={request.initial} />
                <View style={styles.personText}>
                  <Text style={[styles.name, { color: color.ink }]}>{request.name}</Text>
                  <Text style={[styles.caption, { color: color.inkSoft }]}>Le mandaste una solicitud</Text>
                </View>
                <SmallButton
                  disabled={busyId !== null}
                  label="Cancelar"
                  onPress={() => void run(request.friendshipId, () => remove({ friendshipId: request.friendshipId }))}
                  testID={`amigos-enviada-${index}-cancelar`}
                />
              </View>
            ))}
          </ListCard>
        </View>
      ) : null}

      {blocked && blocked.length > 0 ? (
        <ListCard>
          <ListRow
            action={showBlocked ? "Ocultar" : "Ver"}
            count={blocked.length}
            onPress={() => setShowBlocked((value) => !value)}
            testID="amigos-bloqueados"
            title="Personas bloqueadas"
          />
          {showBlocked
            ? blocked.map((person, index) => (
                <View key={person.blockId} style={styles.personRow}>
                  <FriendAvatar initial={person.initial} />
                  <View style={styles.personText}>
                    <Text style={[styles.name, { color: color.ink }]}>{person.name}</Text>
                  </View>
                  <SmallButton
                    disabled={busyId !== null}
                    label="Desbloquear"
                    onPress={() => void run(person.blockId, () => unblock({ blockId: person.blockId }))}
                    testID={`amigos-bloqueado-${index}-desbloquear`}
                  />
                </View>
              ))
            : null}
        </ListCard>
      ) : null}

      <Text style={[styles.footnote, { color: color.inkSoft }]}>
        Solo te escriben las personas que aceptás. Los mensajes se guardan para entregarlos y se borran si dejan de ser
        amigos, si bloqueás a la persona o si eliminás tu cuenta.
      </Text>
    </AppScreen>
  );
}

/** Botón pill chico de los renglones (Aceptar, Rechazar, Cancelar). */
function SmallButton({
  disabled = false,
  label,
  onPress,
  primary = false,
  testID,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
  disabled?: boolean;
  testID: string;
}) {
  const { color } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={withPressed(styles.small, {
        backgroundColor: primary ? color.ink : color.surface,
        borderColor: primary ? color.ink : color.borderStrong,
        opacity: disabled ? tokens.opacity.imageMuted : 1,
      })}
      testID={testID}
    >
      <Text style={[styles.smallLabel, { color: primary ? color.surface : color.ink }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { gap: tokens.space.md, paddingBottom: tokens.space.xxl },
  body: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.body.size, lineHeight: tokens.type.body.lineHeight },
  bodySm: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.bodySm.size, lineHeight: tokens.type.bodySm.lineHeight },
  note: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.bodySm.size,
    lineHeight: tokens.type.bodySm.lineHeight,
    paddingHorizontal: tokens.cardPadding.horizontal,
    paddingVertical: tokens.cardPadding.vertical,
  },
  caption: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.caption.size, lineHeight: tokens.type.caption.lineHeight },
  footnote: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.caption.size,
    lineHeight: tokens.type.caption.lineHeight,
    marginTop: tokens.space.md,
  },
  personRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: tokens.space.md,
    paddingHorizontal: tokens.cardPadding.horizontal,
    paddingVertical: tokens.space.lg,
  },
  personText: { flex: 1, gap: tokens.space.xxs },
  personTap: { alignItems: "center", flex: 1, flexDirection: "row", gap: tokens.space.md },
  name: { fontFamily: tokens.font.serif, fontSize: tokens.type.subtitle.size, lineHeight: tokens.type.bodySm.lineHeight },
  preview: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.bodySm.size, lineHeight: tokens.type.bodySm.lineHeight },
  previewUnread: { fontFamily: tokens.font.sansMedium, fontSize: tokens.type.bodySm.size, lineHeight: tokens.type.bodySm.lineHeight },
  meta: { alignItems: "flex-end", gap: tokens.space.xs },
  requestActions: { flexDirection: "row", gap: tokens.space.xs },
  small: {
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    paddingHorizontal: tokens.space.md,
    paddingVertical: tokens.space.xs,
  },
  smallLabel: { fontFamily: tokens.font.sansMedium, fontSize: tokens.type.caption.size, lineHeight: tokens.type.caption.lineHeight },
  card: {
    borderRadius: tokens.radius.xl,
    borderWidth: 1,
    gap: tokens.space.sm,
    paddingHorizontal: tokens.cardPadding.horizontal,
    paddingVertical: tokens.cardPadding.vertical,
  },
  cardGap: { marginTop: tokens.space.md },
  code: { fontFamily: tokens.font.serif, fontSize: tokens.type.title.size, lineHeight: tokens.type.title.lineHeight },
  buttons: { gap: tokens.space.sm, marginTop: tokens.space.xs },
  label: { fontFamily: tokens.font.sans, fontSize: tokens.type.label.size, lineHeight: tokens.type.subtitle.lineHeight },
  inputRow: {
    alignItems: "center",
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: tokens.space.sm,
    paddingLeft: tokens.space.lg,
    paddingRight: tokens.space.xs,
    paddingVertical: tokens.space.xs,
  },
  input: { flex: 1, fontFamily: tokens.font.sans, fontSize: tokens.type.body.size },
});
