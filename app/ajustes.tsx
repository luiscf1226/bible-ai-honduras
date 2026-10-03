import { useAction, useMutation, useQuery } from "convex/react";
import { router } from "expo-router";
import { useAuth } from "@clerk/expo";
import { useState } from "react";
import { Alert, Linking, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { api } from "../convex/_generated/api";
import { AppButton } from "../src/components/AppButton";
import { AppScreen } from "../src/components/AppScreen";
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
import { cancelDailyDevotionalReminder } from "../src/lib/dailyReminder";
import { lockSettingHint } from "../src/features/personal/personalLock";
import { usePersonalLockSetting } from "../src/features/personal/personalLockStore";
import { canEnterReferral, claimMessage } from "../src/lib/referralCopy";
import { logOut as purchasesLogOut } from "../src/lib/revenuecat";
import { REMINDER_HOURS } from "../src/lib/reminderHours";
import { useAppUpdate } from "../src/hooks/useAppUpdate";
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
  const { signOut } = useAuth();
  const [cleared, setCleared] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteKeyword, setDeleteKeyword] = useState("");
  const [busy, setBusy] = useState<"signOut" | "delete" | null>(null);
  const keywordMatches = deleteKeyword.trim().toUpperCase() === DELETE_KEYWORD;
  const isPro = entitlement?.isPro === true;
  // Una preferencia sin corpus (RVR1960/NVI) se muestra como RV1909, que es lo
  // que el backend usa de verdad al recuperar.
  const storedVersion = user?.bibleVersion ?? DEFAULT_BIBLE_VERSION;
  const bibleVersion = bibleVersionIsAvailable(storedVersion) ? storedVersion : DEFAULT_BIBLE_VERSION;
  const darkMode = user?.darkMode ?? false;
  const appUpdate = useAppUpdate();
  // Biblia sin conexión (#160). Leer es gratis: no pasa por cuotas.
  const { online, clearUserData, forgetNotes } = useOfflineSync();
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

  // Cerrar sesión de verdad: Clerk, RevenueCat y el recordatorio local. Si el
  // aviso diario sobreviviera, seguirían llegando notificaciones de una cuenta
  // desconectada. Ningún paso puede bloquear a los otros.
  async function endSession() {
    try {
      // La cola sin conexión y lo último visto son de esta cuenta (#182). La
      // Biblia descargada no es de nadie: se queda en el teléfono.
      await clearUserData();
    } catch {
      // Un archivo que no se pudo borrar no bloquea el cierre de sesión.
    }
    try {
      await cancelDailyDevotionalReminder();
    } catch {
      // Sin permiso de notificaciones no hay nada agendado que cancelar.
    }
    try {
      await purchasesLogOut();
    } catch {
      // logOut ya devuelve el error en vez de lanzarlo; esto es cinturón.
    }
    try {
      await signOut();
    } finally {
      router.replace("/splash");
    }
  }

  function askSignOut() {
    Alert.alert("¿Cerrar sesión?", "Volvés a la pantalla de inicio. Tus datos siguen en tu cuenta.", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Cerrar sesión",
        style: "destructive",
        onPress: () => {
          setBusy("signOut");
          void endSession().finally(() => setBusy(null));
        },
      },
    ]);
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

  async function confirmDeleteAccount() {
    if (!keywordMatches) {
      return;
    }
    setBusy("delete");
    try {
      const result = await deleteAccount({});
      if (result.status === "datos_incompletos") {
        setBusy(null);
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
      setBusy(null);
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
        style={[
          styles.planCard,
          { backgroundColor: isPro ? color.surfaceSunk : color.ink },
        ]}
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
        <Text style={[styles.planChevron, { color: color.accent }]}>›</Text>
      </Pressable>

      <Text style={[styles.sectionLabel, { color: color.inkSoft }]}>Lo tuyo</Text>
      <View style={[styles.card, { backgroundColor: color.surface, borderColor: color.border }]}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/mi-espacio")}
          style={styles.row}
          testID="ajustes-mi-espacio"
        >
          <View style={styles.rowText}>
            <Text style={[styles.rowLabel, { color: color.ink }]}>Mi espacio</Text>
            <Text style={[styles.rowHint, { color: color.inkSoft }]}>Separador, guardados, subrayados y conversaciones</Text>
          </View>
          <Text style={[styles.planChevron, { color: color.inkFaint }]}>›</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/exportar")}
          style={[styles.row, styles.rowDivider, { borderTopColor: color.border }]}
          testID="ajustes-exportar"
        >
          <View style={styles.rowText}>
            <Text style={[styles.rowLabel, { color: color.ink }]}>Exportar lo mío</Text>
            <Text style={[styles.rowHint, { color: color.inkSoft }]}>Guardados, notas y subrayados, en texto o PDF</Text>
          </View>
          <Text style={[styles.planChevron, { color: color.inkFaint }]}>›</Text>
        </Pressable>
        {/* Mismo bloque que la confirmación de "Eliminar mi cuenta": copy,
            campo y botón. Desaparece a los 30 días o cuando ya hay invitación. */}
        {canEnterReferral(user) ? (
          <View style={[styles.deleteBlock, styles.rowDivider, { borderTopColor: color.border }]} testID="ajustes-referral">
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
          <Text
            accessibilityRole="alert"
            style={[styles.privacyCopy, styles.rowDivider, { borderTopColor: color.border, color: color.inkSoft }]}
            testID="ajustes-referral-notice"
          >
            {referralNotice}
          </Text>
        ) : null}
      </View>

      <Text style={[styles.sectionLabel, { color: color.inkSoft }]}>Lectura</Text>
      <View style={[styles.card, { backgroundColor: color.surface, borderColor: color.border }]}>
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

        {/* Mismo renglón que "Mi espacio": título, pista y glifo a la derecha. */}
        <Pressable
          accessibilityHint={bibleCopy.hint}
          accessibilityRole="button"
          accessibilityState={{ busy: offlineBible.downloading !== null, disabled: !bibleCopy.actionable }}
          disabled={!bibleCopy.actionable}
          onPress={onBibleRow}
          style={[styles.row, styles.rowDivider, { borderTopColor: color.border }]}
          testID="ajustes-biblia-sin-conexion"
        >
          <View style={styles.rowText}>
            <Text style={[styles.rowLabel, { color: color.ink }]}>Leer sin conexión</Text>
            <Text style={[styles.rowHint, { color: color.inkSoft }]} testID="ajustes-biblia-sin-conexion-estado">
              {bibleCopy.hint}
            </Text>
          </View>
          <Text style={[styles.planChevron, { color: bibleState.kind === "ready" ? color.sage : color.inkFaint }]}>
            {bibleCopy.glyph}
          </Text>
        </Pressable>

        <View style={[styles.row, styles.rowDivider, { borderTopColor: color.border }]}>
          <View style={styles.rowText}>
            <Text style={[styles.rowLabel, { color: color.ink }]}>Modo noche suave</Text>
            <Text style={[styles.rowHint, { color: color.inkSoft }]}>Para el devocional antes de dormir</Text>
          </View>
          <Pressable
            accessibilityRole="switch"
            accessibilityState={{ checked: darkMode }}
            onPress={() => updatePreferences({ darkMode: !darkMode })}
            style={[styles.switchTrack, { backgroundColor: darkMode ? color.sage : color.border }]}
            testID="ajustes-dark-mode"
          >
            <View
              style={[
                styles.switchKnob,
                { backgroundColor: color.surface },
                darkMode && styles.switchKnobActive,
              ]}
            />
          </Pressable>
        </View>
      </View>

      <Text style={[styles.sectionLabel, { color: color.inkSoft }]}>Recordatorio</Text>
      <View style={[styles.card, { backgroundColor: color.surface, borderColor: color.border }]}>
        <View style={styles.row}>
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
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/historial")}
          style={[styles.row, styles.rowDivider, { borderTopColor: color.border }]}
          testID="ajustes-historial"
        >
          <Text style={[styles.rowLabel, { color: color.ink }]}>Mis conversaciones</Text>
          <Text style={[styles.planChevron, { color: color.inkFaint }]}>›</Text>
        </Pressable>
      </View>

      <Text style={[styles.sectionLabel, { color: color.inkSoft }]}>Privacidad</Text>
      <View style={[styles.card, { backgroundColor: color.surface, borderColor: color.border }]}>
        <Text style={[styles.privacyCopy, { color: color.inkMuted }]}>
          Tus conversaciones son privadas. Compartimos con proveedores de IA solo lo necesario para responderte.
        </Text>
        {/* Mismo renglón con interruptor que "Modo noche suave". */}
        <View style={[styles.row, styles.rowDivider, { borderTopColor: color.border }]} testID="ajustes-proteger">
          <View style={styles.rowText}>
            <Text style={[styles.rowLabel, { color: lockAvailable ? color.ink : color.inkSoft }]}>Proteger lo personal</Text>
            <Text style={[styles.rowHint, { color: color.inkSoft }]} testID="ajustes-proteger-hint">
              {personalLock.availability ? lockSettingHint(personalLock.availability) : "…"}
            </Text>
            {lockNotice ? (
              <Text accessibilityRole="alert" style={[styles.rowHint, { color: color.danger }]} testID="ajustes-proteger-aviso">
                {lockNotice}
              </Text>
            ) : null}
          </View>
          <Pressable
            accessibilityLabel="Proteger lo personal"
            accessibilityRole="switch"
            accessibilityState={{ checked: personalLock.enabled, disabled: !lockAvailable && !personalLock.enabled }}
            disabled={personalLock.loading || (!lockAvailable && !personalLock.enabled)}
            onPress={() => void toggleLock()}
            style={[
              styles.switchTrack,
              { backgroundColor: personalLock.enabled ? color.sage : color.border },
              !lockAvailable && styles.versionPillDisabled,
            ]}
            testID="ajustes-proteger-switch"
          >
            <View
              style={[
                styles.switchKnob,
                { backgroundColor: color.surface },
                personalLock.enabled && styles.switchKnobActive,
              ]}
            />
          </Pressable>
        </View>
        <Pressable
          accessibilityHint="Abre la política en el navegador"
          accessibilityRole="link"
          onPress={() => void Linking.openURL(PRIVACY_POLICY_URL)}
          style={[styles.row, styles.rowDivider, { borderTopColor: color.border }]}
          testID="ajustes-politica-privacidad"
        >
          <Text style={[styles.rowLabel, { color: color.ink }]}>Política de privacidad</Text>
          <Text style={[styles.planChevron, { color: color.inkFaint }]}>↗</Text>
        </Pressable>
        <Pressable
          accessibilityHint="Abre los términos en el navegador"
          accessibilityRole="link"
          onPress={() => void Linking.openURL(TERMS_OF_USE_URL)}
          style={[styles.row, styles.rowDivider, { borderTopColor: color.border }]}
          testID="ajustes-terminos"
        >
          <Text style={[styles.rowLabel, { color: color.ink }]}>Términos de uso</Text>
          <Text style={[styles.planChevron, { color: color.inkFaint }]}>↗</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={cleared}
          onPress={() => {
            Alert.alert(
              "¿Borrar tu historial?",
              "Se eliminan de verdad tus conversaciones, tu diario de oración y las notas de tus versículos guardados. No se puede deshacer.",
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
          style={[styles.row, styles.rowDivider, { borderTopColor: color.border }]}
          testID="ajustes-borrar-historial"
        >
          <Text style={[styles.rowLabel, { color: cleared ? color.inkSoft : color.danger }]}>
            {cleared ? "Historial borrado" : "Borrar mi historial"}
          </Text>
        </Pressable>
      </View>

      <Text style={[styles.sectionLabel, { color: color.inkSoft }]}>Cuenta</Text>
      <View style={[styles.card, { backgroundColor: color.surface, borderColor: color.border }]}>
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={[styles.rowLabel, { color: color.ink }]}>Correo</Text>
            <Text style={[styles.rowHint, { color: color.inkSoft }]} testID="ajustes-correo">
              {user?.email ?? "Sin correo registrado"}
            </Text>
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          disabled={busy !== null}
          onPress={askSignOut}
          style={[styles.row, styles.rowDivider, { borderTopColor: color.border }]}
          testID="ajustes-cerrar-sesion"
        >
          <Text style={[styles.rowLabel, { color: color.ink }]}>
            {busy === "signOut" ? "Cerrando sesión…" : "Cerrar sesión"}
          </Text>
          <Text style={[styles.planChevron, { color: color.inkFaint }]}>›</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={busy !== null}
          onPress={askDeleteAccount}
          style={[styles.row, styles.rowDivider, { borderTopColor: color.border }]}
          testID="ajustes-eliminar-cuenta"
        >
          <Text style={[styles.rowLabel, { color: color.danger }]}>Eliminar mi cuenta</Text>
        </Pressable>
        {confirmingDelete ? (
          <View style={[styles.deleteBlock, styles.rowDivider, { borderTopColor: color.border }]}>
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
      </View>

      {/* Versión visible para soporte: "¿qué build tenés?" se contesta desde acá. */}
      <Text style={[styles.sectionLabel, { color: color.inkSoft }]}>App</Text>
      <View style={[styles.card, { backgroundColor: color.surface, borderColor: color.border }]}>
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={[styles.rowLabel, { color: color.ink }]}>Versión instalada</Text>
            <Text style={[styles.rowHint, { color: color.inkSoft }]} testID="ajustes-version-app">
              {appUpdate.label}
            </Text>
          </View>
        </View>
        {appUpdate.storeName ? (
          <Pressable
            accessibilityHint={`Abre ${appUpdate.storeName}`}
            accessibilityRole="link"
            onPress={() => void appUpdate.openStore()}
            style={[styles.row, styles.rowDivider, { borderTopColor: color.border }]}
            testID="ajustes-actualizar-app"
          >
            <View style={styles.rowText}>
              <Text style={[styles.rowLabel, { color: appUpdate.updateAvailable ? color.accentDeep : color.ink }]}>
                {appUpdate.updateAvailable ? "Hay una versión nueva" : "Buscar actualizaciones"}
              </Text>
              <Text style={[styles.rowHint, { color: color.inkSoft }]}>
                {appUpdate.updateAvailable
                  ? `Actualizá en ${appUpdate.storeName} para ver lo último`
                  : `Abre ${appUpdate.storeName}`}
              </Text>
            </View>
            <Text style={[styles.planChevron, { color: color.inkFaint }]}>↗</Text>
          </Pressable>
        ) : null}
      </View>

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
  planChevron: { fontFamily: tokens.font.sans, fontSize: tokens.type.body.size },
  sectionLabel: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.overline.size,
    letterSpacing: tokens.type.overline.letterSpacing,
    marginBottom: tokens.space.md,
    marginTop: tokens.space.xxl + tokens.space.xs,
    textTransform: "uppercase",
  },
  card: { borderRadius: tokens.radius.xl, borderWidth: 1, overflow: "hidden" },
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
  row: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", paddingHorizontal: tokens.cardPadding.horizontal, paddingVertical: tokens.cardPadding.vertical },
  rowDivider: { borderTopWidth: 1 },
  rowText: { flex: 1, paddingRight: tokens.space.md },
  rowLabel: { fontFamily: tokens.font.sans, fontSize: tokens.type.label.size, lineHeight: tokens.type.label.lineHeight },
  rowHint: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.caption.size, lineHeight: tokens.type.caption.lineHeight, marginTop: tokens.space.xs },
  hourPicker: { flexDirection: "row", gap: tokens.space.xs },
  hourPill: { borderRadius: tokens.radius.sm, borderWidth: 1, paddingHorizontal: tokens.space.md, paddingVertical: tokens.space.sm },
  hourPillLabel: { fontFamily: tokens.font.sans, fontSize: tokens.type.caption.size },
  switchTrack: {
    borderRadius: tokens.radius.pill,
    height: tokens.size.switchTrack.height,
    justifyContent: "center",
    padding: tokens.size.switchPadding,
    width: tokens.size.switchTrack.width,
  },
  switchKnob: { borderRadius: tokens.radius.pill, height: tokens.size.switchKnob, width: tokens.size.switchKnob },
  switchKnobActive: { transform: [{ translateX: tokens.size.switchKnobOffset }] },
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
