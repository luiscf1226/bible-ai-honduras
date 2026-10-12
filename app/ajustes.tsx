import { useAction, useMutation, useQuery } from "convex/react";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Linking, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { api } from "../convex/_generated/api";
import { AppButton } from "../src/components/AppButton";
import { AppScreen } from "../src/components/AppScreen";
import { Icon } from "../src/components/Icon";
import { ListCard, ListRow, ListSectionLabel } from "../src/components/ListRow";
import { Switch } from "../src/components/Switch";
import { ScreenHeader } from "../src/components/ScreenHeader";
import { DEFAULT_BIBLE_VERSION, bibleVersionIsAvailable } from "../convex/bibleVersions";
// Los números salen de las cuotas reales: el prototipo decía "3 preguntas y 2
// devocionales", pero el límite es otro y la tarjeta mentía.
import { QUOTA_LIMITS } from "../convex/quotas";
import { bibleDownloadState } from "../src/features/offline/bibleDownload";
import { removeOfflineBible, startBibleDownload, useOfflineBible } from "../src/features/offline/offlineBible";
import { bibleRowCopy, REMOVE_BIBLE_BODY, REMOVE_BIBLE_TITLE } from "../src/features/offline/offlineCopy";
import { useOfflineSync } from "../src/features/offline/OfflineSyncProvider";
import { PRIVACY_POLICY_URL, TERMS_OF_USE_URL } from "../src/lib/legalLinks";
import { lockSettingHint } from "../src/features/personal/personalLock";
import { usePersonalLockSetting } from "../src/features/personal/personalLockStore";
import { canEnterReferral, claimMessage } from "../src/lib/referralCopy";
import { REMINDER_HOURS } from "../src/lib/reminderHours";
import { useSignOut } from "../src/features/auth/useSignOut";
import { useAppUpdate } from "../src/hooks/useAppUpdate";
import { withPressed } from "../src/theme/pressed";
import { useTheme } from "../src/theme/ThemeProvider";
import { tokens } from "../src/theme/tokens";

// #93 §4b / #108: solo RV1909 está en AVAILABLE_BIBLE_VERSIONS. RVR1960 y NVI
// se muestran deshabilitadas (licencia/corpus pendientes). La fuente de verdad
// es `bibleVersionIsAvailable`.
const VERSIONS = [
  { label: "RV1909", value: "RV1909" as const },
  { label: "RVR1960", value: "RVR1960" as const },
  { label: "NVI", value: "NVI" as const },
];


// Eliminar cuenta (#107 · App Store 5.1.1(v)): confirmación de dos pasos.
// Paso 1 el diálogo destructivo; paso 2 escribir esta palabra exacta.
const DELETE_KEYWORD = "ELIMINAR";
const DELETE_DIALOG_TITLE = "¿Eliminar tu cuenta?";
const DELETE_DIALOG_BODY =
  "Se borra para siempre tu perfil, tus conversaciones, tus devocionales guardados, " +
  "tus historias con sus ilustraciones y tu plan dentro de la app. Esto no se puede deshacer.\n\n" +
  "Ojo: eliminar la cuenta NO cancela tu suscripción. Eso se hace desde App Store o Google Play.";
const DELETE_CONFIRM_COPY =
  `Último paso: escribí ${DELETE_KEYWORD} para confirmar que querés borrar todo. ` +
  "Acordate de cancelar la suscripción en App Store o Google Play: acá no se cancela.";

export default function AjustesScreen() {
  const { color } = useTheme();
  const user = useQuery(api.users.current);
  const entitlement = useQuery(api.entitlements.mine);
  const updatePreferences = useMutation(api.users.updatePreferences);
  const deleteHistory = useMutation(api.history.deleteAll);
  const deleteAccount = useAction(api.users.deleteAccount);
  const claimReferral = useMutation(api.referrals.claim);
  const [referralDraft, setReferralDraft] = useState("");
  const [referralNotice, setReferralNotice] = useState<string | null>(null);
  const [claimingReferral, setClaimingReferral] = useState(false);
  const { askSignOut, endSession, signingOut } = useSignOut();
  const [cleared, setCleared] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteKeyword, setDeleteKeyword] = useState("");
  const [deleting, setDeleting] = useState(false);
  const busy = signingOut ? "signOut" : deleting ? "delete" : null;
  const keywordMatches = deleteKeyword.trim().toUpperCase() === DELETE_KEYWORD;
  const isPro = entitlement?.isPro === true;
  // Una preferencia sin corpus (RVR1960/NVI) se muestra como RV1909, que es lo
  // que el backend usa de verdad al recuperar.
  const storedVersion = user?.bibleVersion ?? DEFAULT_BIBLE_VERSION;
  const bibleVersion = bibleVersionIsAvailable(storedVersion) ? storedVersion : DEFAULT_BIBLE_VERSION;
  const darkMode = user?.darkMode ?? false;
  // "Hace un año guardaste…" (#172): sin preferencia guardada está encendida,
  // igual que en el servidor (`savedMemory.thisWeek` solo la apaga con false).
  const savedMemoryEnabled = user?.savedMemoryEnabled !== false;
  const appUpdate = useAppUpdate();
  // Biblia sin conexión (#160). Leer es gratis: no pasa por cuotas.
  const { online, forgetNotes } = useOfflineSync();
  const offlineBible = useOfflineBible();
  const manifest = useQuery(api.offlineBible.manifest, { version: bibleVersion });
  const bibleState = bibleDownloadState(offlineBible.index, manifest);
  const bibleCopy = bibleRowCopy({
    state: bibleState,
    downloading: offlineBible.downloading,
    failed: offlineBible.failed,
    online,
    version: bibleVersion,
    totalBytes: manifest?.totalBytes,
  });

  function onBibleRow() {
    if (!bibleCopy.actionable) return;
    if (bibleState.kind === "ready" || (bibleState.kind === "update" && !online)) {
      Alert.alert(REMOVE_BIBLE_TITLE, REMOVE_BIBLE_BODY, [
        { text: "Cancelar", style: "cancel" },
        { text: "Quitar", style: "destructive", onPress: () => void removeOfflineBible() },
      ]);
      return;
    }
    if (manifest) void startBibleDownload(manifest);
  }

  const personalLock = usePersonalLockSetting();
  const [lockNotice, setLockNotice] = useState<string | null>(null);
  const lockAvailable = personalLock.availability?.available === true;

  // Proteger lo personal (#171): encender y apagar piden Face ID, huella o PIN.
  async function toggleLock() {
    setLockNotice(null);
    const next = !personalLock.enabled;
    const changed = await personalLock.setEnabled(next);
    if (!changed && lockAvailable) {
      setLockNotice("No se cambió: hace falta confirmar con Face ID, huella o el PIN del teléfono.");
    }
  }

  // Invitaciones (PRD §9b): en iPhone no hay forma automática de saber quién
  // mandó el link de la tienda, así que se puede escribir el código.
  async function submitReferral() {
    setClaimingReferral(true);
    try {
      const result = await claimReferral({ code: referralDraft, via: "manual" });
      setReferralNotice(claimMessage(result.status));
      if (result.status === "ok") setReferralDraft("");
    } catch {
      setReferralNotice("No pudimos guardarlo. Revisá tu conexión e intentá de nuevo.");
    } finally {
      setClaimingReferral(false);
    }
  }

  function askDeleteAccount() {
    Alert.alert(DELETE_DIALOG_TITLE, DELETE_DIALOG_BODY, [
      { text: "Cancelar", style: "cancel" },
      // #173: antes de borrar, poder llevarse lo propio.
      { text: "Exportar primero", onPress: () => router.push("/exportar") },
      {
        text: "Continuar",
        style: "destructive",
        onPress: () => {
          setDeleteKeyword("");
          setConfirmingDelete(true);
        },
      },
    ]);
  }

  // El perfil de Mi espacio abre Ajustes con `?eliminar=1`: la confirmación de
  // dos pasos vive solo acá, pero se llega en un toque desde el perfil.
  const params = useLocalSearchParams<{ eliminar?: string }>();
  useEffect(() => {
    if (params.eliminar !== "1") return;
    router.setParams({ eliminar: undefined });
    askDeleteAccount();
  }, [params.eliminar]);

  async function confirmDeleteAccount() {
    if (!keywordMatches) {
      return;
    }
    setDeleting(true);
    try {
      const result = await deleteAccount({});
      if (result.status === "datos_incompletos") {
        setDeleting(false);
        Alert.alert(
          "No pudimos borrar todo",
          "Quedaron datos sin borrar, así que tu cuenta sigue activa. Probá de nuevo en un rato.",
        );
        return;
      }
      if (result.status === "clerk_pendiente") {
        // Datos borrados pero la identidad sobrevive: se dice en voz alta y se
        // cierra sesión igual. Nunca datos borrados con sesión viva y en silencio.
        Alert.alert(
          "Tus datos ya se borraron",
          "Borramos todo lo tuyo en la app. La baja del correo puede tardar unos minutos; " +
            "vamos a cerrar tu sesión ahora.",
          [{ text: "Entendido", onPress: () => void endSession() }],
        );
        return;
      }
      await endSession();
    } catch {
      setDeleting(false);
      Alert.alert("No pudimos eliminar tu cuenta", "Revisá tu conexión e intentá de nuevo.");
    }
  }

  return (
    <AppScreen scroll contentStyle={styles.content} style={{ backgroundColor: color.surface }}>
      <ScreenHeader
        accessibilityLabel="Volver"
        style={styles.header}
        title="Ajustes"
      />

      <Pressable
        accessibilityRole="button"
        onPress={() => router.push("/paywall")}
        style={withPressed(styles.planCard, { backgroundColor: isPro ? color.surfaceSunk : color.ink })}
        testID="ajustes-plan"
      >
        <View style={styles.planText}>
          <Text style={[styles.planTitle, { color: isPro ? color.ink : color.surface }]}>
            {isPro ? "Pro activo" : "Plan gratis"}
          </Text>
          <Text style={[styles.planSub, { color: isPro ? color.inkSoft : color.inkFaint }]}>
            {isPro
              ? "Sin límites de preguntas ni conversaciones"
              : `${QUOTA_LIMITS.qa} preguntas y ${QUOTA_LIMITS.feelings} devocionales al día`}
          </Text>
        </View>
        <Icon color={color.accent} name="chevronRight" size="sm" />
      </Pressable>

      {/* Mi espacio, Exportar y Mis conversaciones viven en la pestaña Mi espacio (#232). */}
      <ListSectionLabel>Lo tuyo</ListSectionLabel>
      <ListCard>
        <ListRow
          hint="Una vez por semana, el inicio te trae un versículo que guardaste hace tiempo"
          title="Recuerdos de tus guardados"
          trailing={
            <Switch
              accessibilityLabel="Recuerdos de tus guardados"
              disabled={!user}
              onChange={(next) => void updatePreferences({ savedMemoryEnabled: next }).catch(() => undefined)}
              testID="ajustes-recuerdos-switch"
              value={savedMemoryEnabled}
            />
          }
        />
        {/* Mismo bloque que la confirmación de "Eliminar mi cuenta": copy,
            campo y botón. Desaparece a los 30 días o cuando ya hay invitación. */}
        {canEnterReferral(user) ? (
          <View style={styles.deleteBlock} testID="ajustes-referral">
            <View>
              <Text style={[styles.rowLabel, { color: color.ink }]}>¿Te invitó alguien?</Text>
              <Text style={[styles.rowHint, { color: color.inkSoft }]}>
                Escribí su código (empieza con BAH-). Solo nos sirve para saber cómo llegaste; no le avisamos a nadie.
              </Text>
            </View>
            <TextInput
              accessibilityLabel="Código de quien te invitó"
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={12}
              onChangeText={(value) => {
                setReferralDraft(value);
                setReferralNotice(null);
              }}
              placeholder="BAH-"
              placeholderTextColor={color.inkFaint}
              style={[styles.deleteInput, { borderColor: color.borderStrong, color: color.ink }]}
              testID="ajustes-referral-input"
              value={referralDraft}
            />
            {referralNotice ? (
              <Text accessibilityRole="alert" style={[styles.rowHint, { color: color.inkSoft }]} testID="ajustes-referral-notice">
                {referralNotice}
              </Text>
            ) : null}
            <AppButton
              disabled={claimingReferral || referralDraft.trim().length === 0}
              onPress={() => void submitReferral()}
              testID="ajustes-referral-save"
              variant="secondary"
            >
              Guardar código
            </AppButton>
          </View>
        ) : user?.referredBy && referralNotice ? (
          // Recién guardado: la fila se va, pero el "Listo" se queda esta vez.
          <Text accessibilityRole="alert" style={[styles.privacyCopy, { color: color.inkSoft }]} testID="ajustes-referral-notice">
            {referralNotice}
          </Text>
        ) : null}
      </ListCard>

      <ListSectionLabel>Lectura</ListSectionLabel>
      <ListCard>
        <View style={styles.versionBlock}>
          <Text style={[styles.rowLabel, { color: color.ink }]}>Versión de la Biblia</Text>
          <View style={styles.versionPicker}>
            {VERSIONS.map((version) => {
              const available = bibleVersionIsAvailable(version.value);
              const active = available && bibleVersion === version.value;
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !available, selected: active }}
                  disabled={!available}
                  key={version.value}
                  onPress={() => updatePreferences({ bibleVersion: version.value })}
                  style={[
                    styles.versionPill,
                    {
                      backgroundColor: active ? color.surfaceSunk : color.surface,
                      borderColor: active ? color.borderStrong : color.border,
                    },
                    !available && styles.versionPillDisabled,
                  ]}
                  testID={`ajustes-version-${version.value}`}
                >
                  <Text
                    style={[
                      styles.versionPillLabel,
                      { color: active ? color.ink : available ? color.inkSoft : color.inkFaint },
                    ]}
                  >
                    {version.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={[styles.versionHint, { color: color.inkSoft }]} testID="ajustes-version-hint">
            RVR1960 y NVI todavía no están disponibles: son de licencia comercial.
          </Text>
        </View>

        <ListRow
          accessibilityHint={bibleCopy.hint}
          disabled={!bibleCopy.actionable}
          onPress={onBibleRow}
          testID="ajustes-biblia-sin-conexion"
          title="Leer sin conexión"
          trailing={
            <Text style={[styles.glyph, { color: bibleState.kind === "ready" ? color.sage : color.inkFaint }]}>
              {bibleCopy.glyph}
            </Text>
          }
        >
          <Text style={[styles.rowHint, { color: color.inkSoft }]} testID="ajustes-biblia-sin-conexion-estado">
            {bibleCopy.hint}
          </Text>
        </ListRow>

        <ListRow
          hint="Para el devocional antes de dormir"
          title="Modo noche suave"
          trailing={
            <Switch
              accessibilityLabel="Modo noche suave"
              onChange={(next) => void updatePreferences({ darkMode: next })}
              testID="ajustes-dark-mode"
              value={darkMode}
            />
          }
        />
      </ListCard>

      <ListSectionLabel>Recordatorio</ListSectionLabel>
      <ListCard>
        <View style={styles.reminderRow}>
          <Text style={[styles.rowLabel, { color: color.ink }]}>Aviso del versículo</Text>
          <View style={styles.hourPicker}>
            {REMINDER_HOURS.map((option) => {
              const active = user?.reminderHour === option.hour;
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  key={option.hour}
                  onPress={() => updatePreferences({ reminderHour: option.hour })}
                  style={[
                    styles.hourPill,
                    {
                      backgroundColor: active ? color.surfaceSunk : color.surface,
                      borderColor: active ? color.borderStrong : color.border,
                    },
                  ]}
                  testID={`ajustes-hour-${option.hour}`}
                >
                  <Text style={[styles.hourPillLabel, { color: active ? color.ink : color.inkSoft }]}>
                    {option.display}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </ListCard>

      <ListSectionLabel>Privacidad</ListSectionLabel>
      <ListCard>
        <Text style={[styles.privacyCopy, { color: color.inkMuted }]}>
          Tus conversaciones son privadas. Compartimos con proveedores de IA solo lo necesario para responderte.
        </Text>
        <ListRow
          testID="ajustes-proteger"
          title="Proteger lo personal"
          tone={lockAvailable ? "ink" : "soft"}
          trailing={
            <View style={!lockAvailable ? styles.versionPillDisabled : undefined}>
              <Switch
                accessibilityLabel="Proteger lo personal"
                disabled={personalLock.loading || (!lockAvailable && !personalLock.enabled)}
                onChange={() => void toggleLock()}
                testID="ajustes-proteger-switch"
                value={personalLock.enabled}
              />
            </View>
          }
        >
          <Text style={[styles.rowHint, { color: color.inkSoft }]} testID="ajustes-proteger-hint">
            {personalLock.availability ? lockSettingHint(personalLock.availability) : "…"}
          </Text>
          {lockNotice ? (
            <Text accessibilityRole="alert" style={[styles.rowHint, { color: color.danger }]} testID="ajustes-proteger-aviso">
              {lockNotice}
            </Text>
          ) : null}
        </ListRow>
        <ListRow
          accessibilityHint="Abre la política en el navegador"
          accessibilityRole="link"
          onPress={() => void Linking.openURL(PRIVACY_POLICY_URL)}
          testID="ajustes-politica-privacidad"
          title="Política de privacidad"
          trailing={<Text style={[styles.glyph, { color: color.inkFaint }]}>↗</Text>}
        />
        <ListRow
          accessibilityHint="Abre los términos en el navegador"
          accessibilityRole="link"
          onPress={() => void Linking.openURL(TERMS_OF_USE_URL)}
          testID="ajustes-terminos"
          title="Términos de uso"
          trailing={<Text style={[styles.glyph, { color: color.inkFaint }]}>↗</Text>}
        />
        <ListRow
          disabled={cleared}
          onPress={() => {
            Alert.alert(
              "¿Borrar tu historial?",
              "Se eliminan de verdad tus conversaciones, tu diario de oración, tus notas de prédica y las notas de tus versículos guardados. No se puede deshacer.",
              [
                { text: "Cancelar", style: "cancel" },
                {
                  text: "Borrar",
                  style: "destructive",
                  onPress: () => {
                    void forgetNotes();
                    void deleteHistory({}).then(() => setCleared(true));
                  },
                },
              ],
            );
          }}
          testID="ajustes-borrar-historial"
          title={cleared ? "Historial borrado" : "Borrar mi historial"}
          tone={cleared ? "soft" : "danger"}
          trailing={null}
        />
      </ListCard>

      <ListSectionLabel>Cuenta</ListSectionLabel>
      <ListCard>
        <ListRow title="Correo">
          <Text style={[styles.rowHint, { color: color.inkSoft }]} testID="ajustes-correo">
            {user?.email ?? "Sin correo registrado"}
          </Text>
        </ListRow>
        <ListRow
          disabled={busy !== null}
          onPress={askSignOut}
          testID="ajustes-cerrar-sesion"
          title={busy === "signOut" ? "Cerrando sesión…" : "Cerrar sesión"}
        />
        <ListRow
          disabled={busy !== null}
          onPress={askDeleteAccount}
          testID="ajustes-eliminar-cuenta"
          title="Eliminar mi cuenta"
          tone="danger"
          trailing={null}
        />
        {confirmingDelete ? (
          <View style={styles.deleteBlock}>
            <Text style={[styles.deleteCopy, { color: color.inkMuted }]}>{DELETE_CONFIRM_COPY}</Text>
            <TextInput
              accessibilityLabel={`Escribí ${DELETE_KEYWORD} para confirmar`}
              autoCapitalize="characters"
              autoCorrect={false}
              editable={busy !== "delete"}
              onChangeText={setDeleteKeyword}
              placeholder={DELETE_KEYWORD}
              placeholderTextColor={color.inkFaint}
              style={[
                styles.deleteInput,
                { backgroundColor: color.surfaceSunk, borderColor: color.borderStrong, color: color.ink },
              ]}
              testID="ajustes-eliminar-cuenta-palabra"
              value={deleteKeyword}
            />
            <AppButton
              disabled={!keywordMatches || busy === "delete"}
              onPress={() => void confirmDeleteAccount()}
              testID="ajustes-eliminar-cuenta-confirmar"
            >
              {busy === "delete" ? "Eliminando…" : "Eliminar mi cuenta para siempre"}
            </AppButton>
            {/* La única otra entrada a Exportar, además de Mi espacio (#232). */}
            <AppButton
              disabled={busy === "delete"}
              onPress={() => router.push("/exportar")}
              testID="ajustes-eliminar-cuenta-exportar"
              variant="secondary"
            >
              Exportar lo mío primero
            </AppButton>
            <AppButton
              disabled={busy === "delete"}
              onPress={() => {
                setConfirmingDelete(false);
                setDeleteKeyword("");
              }}
              testID="ajustes-eliminar-cuenta-cancelar"
              variant="quiet"
            >
              Cancelar
            </AppButton>
          </View>
        ) : null}
      </ListCard>

      {/* Versión visible para soporte: "¿qué build tenés?" se contesta desde acá. */}
      <ListSectionLabel>App</ListSectionLabel>
      <ListCard>
        <ListRow title="Versión instalada">
          <Text style={[styles.rowHint, { color: color.inkSoft }]} testID="ajustes-version-app">
            {appUpdate.label}
          </Text>
        </ListRow>
        {appUpdate.storeName ? (
          <ListRow
            accessibilityHint={`Abre ${appUpdate.storeName}`}
            accessibilityRole="link"
            hint={
              appUpdate.updateAvailable
                ? `Actualizá en ${appUpdate.storeName} para ver lo último`
                : `Abre ${appUpdate.storeName}`
            }
            onPress={() => void appUpdate.openStore()}
            testID="ajustes-actualizar-app"
            title={appUpdate.updateAvailable ? "Hay una versión nueva" : "Buscar actualizaciones"}
            tone={appUpdate.updateAvailable ? "accent" : "ink"}
            trailing={<Text style={[styles.glyph, { color: color.inkFaint }]}>↗</Text>}
          />
        ) : null}
      </ListCard>

      <Text style={[styles.disclaimer, { color: color.inkFaint }]}>
        Esta app acompaña tu lectura; no sustituye el consejo pastoral. La IA puede cometer errores.
      </Text>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: { gap: 0 },
  header: { marginBottom: tokens.space.xxl },
  planCard: {
    alignItems: "center",
    borderRadius: tokens.radius.xl,
    flexDirection: "row",
    gap: tokens.space.md,
    justifyContent: "space-between",
    paddingHorizontal: tokens.space.xl,
    paddingVertical: tokens.space.xl,
  },
  planText: { flex: 1 },
  planTitle: { fontFamily: tokens.font.serif, fontSize: tokens.type.subtitle.size, lineHeight: tokens.type.subtitle.lineHeight },
  planSub: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.caption.size, lineHeight: tokens.type.caption.lineHeight, marginTop: tokens.space.xs },
  glyph: { fontFamily: tokens.font.sans, fontSize: tokens.type.body.size },
  versionBlock: { paddingHorizontal: tokens.cardPadding.horizontal, paddingVertical: tokens.cardPadding.vertical },
  versionPicker: { flexDirection: "row", gap: tokens.space.sm, marginTop: tokens.space.lg },
  versionPill: { borderRadius: tokens.radius.sm, borderWidth: 1, flex: 1, paddingVertical: tokens.space.md },
  versionPillDisabled: { opacity: tokens.opacity.pressed },
  versionPillLabel: { fontFamily: tokens.font.sans, fontSize: tokens.type.bodySm.size, textAlign: "center" },
  versionHint: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.caption.size,
    lineHeight: tokens.type.caption.lineHeight,
    marginTop: tokens.space.sm,
  },
  reminderRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: tokens.cardPadding.horizontal,
    paddingVertical: tokens.cardPadding.vertical,
  },
  rowLabel: { fontFamily: tokens.font.sans, fontSize: tokens.type.label.size, lineHeight: tokens.type.label.lineHeight },
  rowHint: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.caption.size, lineHeight: tokens.type.caption.lineHeight, marginTop: tokens.space.xs },
  hourPicker: { flexDirection: "row", gap: tokens.space.xs },
  hourPill: { borderRadius: tokens.radius.sm, borderWidth: 1, paddingHorizontal: tokens.space.md, paddingVertical: tokens.space.sm },
  hourPillLabel: { fontFamily: tokens.font.sans, fontSize: tokens.type.caption.size },
  deleteBlock: {
    gap: tokens.space.md,
    paddingHorizontal: tokens.cardPadding.horizontal,
    paddingVertical: tokens.cardPadding.vertical,
  },
  deleteCopy: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.bodySm.size,
    lineHeight: tokens.type.bodySm.lineHeight,
  },
  deleteInput: {
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    fontFamily: tokens.font.sans,
    fontSize: tokens.type.body.size,
    paddingHorizontal: tokens.space.lg,
    paddingVertical: tokens.space.lg,
  },
  privacyCopy: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.bodySm.size,
    lineHeight: tokens.type.bodySm.lineHeight,
    paddingHorizontal: tokens.cardPadding.horizontal,
    paddingVertical: tokens.cardPadding.vertical,
  },
  disclaimer: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.caption.size,
    lineHeight: tokens.type.caption.lineHeight,
    marginTop: tokens.space.xxl,
    textAlign: "center",
  },
});
