import { useCallback, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { useSignIn, useSignUp } from "@clerk/expo";

import { AppButton } from "../../src/components/AppButton";
import { AppScreen } from "../../src/components/AppScreen";
import { tokens } from "../../src/theme/tokens";

type Step = "email" | "code";

const GENERIC_ERROR = "No pudimos enviarte el código. Revisá el correo e intentá de nuevo.";
const BAD_CODE_ERROR = "Código incorrecto o vencido. Probá de nuevo.";
const UNSUPPORTED_ERROR = "Esa cuenta usa otro método de acceso — probá con Google o Apple.";
const MORE_STEPS_ERROR = "Tu cuenta necesita un paso adicional que todavía no soportamos acá.";

// Clerk no tiene una sola API para "entrar o registrarse con este correo": hay
// que intentar sign-in primero y, si el correo no existe todavía, caer a
// sign-up. Los dos flujos comparten la misma pantalla de código porque ambos
// usan la estrategia email_code. `finalize()` reemplaza al viejo `setActive`:
// activa la sesión apenas el status pasa a "complete".
export default function EmailScreen() {
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const useDifferentEmail = useCallback(() => {
    setStep("email");
    setCode("");
    setError(null);
  }, []);

  const sendCode = useCallback(async () => {
    if (pending) {
      return;
    }
    setError(null);
    setPending(true);
    try {
      const created = await signIn.create({ identifier: email });
      if (!created.error) {
        const sent = await signIn.emailCode.sendCode();
        if (!sent.error) {
          setMode("signIn");
          setStep("code");
          return;
        }
        // El identificador existe pero email_code no es un primer factor válido
        // para esta cuenta (p. ej. se registró por Google) — no es "no existe".
        console.error("No se pudo enviar el código de sign-in", sent.error);
        setError(UNSUPPORTED_ERROR);
        return;
      }

      if (created.error.code !== "form_identifier_not_found") {
        console.error("signIn.create falló con un correo existente", created.error);
        setError(GENERIC_ERROR);
        return;
      }

      const signedUp = await signUp.create({ emailAddress: email });
      if (signedUp.error) {
        console.error("signUp.create falló", signedUp.error);
        setError(GENERIC_ERROR);
        return;
      }
      const sentSignUp = await signUp.verifications.sendEmailCode();
      if (sentSignUp.error) {
        console.error("No se pudo enviar el código de sign-up", sentSignUp.error);
        setError(GENERIC_ERROR);
        return;
      }
      setMode("signUp");
      setStep("code");
    } catch (unexpected) {
      console.error("sendCode falló de forma inesperada", unexpected);
      setError(GENERIC_ERROR);
    } finally {
      setPending(false);
    }
  }, [email, pending, signIn, signUp]);

  const confirmCode = useCallback(async () => {
    if (pending) {
      return;
    }
    setError(null);
    setPending(true);
    try {
      if (mode === "signIn") {
        const verified = await signIn.emailCode.verifyCode({ code });
        if (verified.error) {
          console.error("signIn.emailCode.verifyCode falló", verified.error);
          setError(BAD_CODE_ERROR);
          return;
        }
        if (signIn.status !== "complete") {
          console.error("signIn quedó en estado inesperado tras verificar el código", signIn.status);
          setError(MORE_STEPS_ERROR);
          return;
        }
        await signIn.finalize();
      } else {
        const verified = await signUp.verifications.verifyEmailCode({ code });
        if (verified.error) {
          console.error("signUp.verifications.verifyEmailCode falló", verified.error);
          setError(BAD_CODE_ERROR);
          return;
        }
        if (signUp.status !== "complete") {
          console.error("signUp quedó en estado inesperado tras verificar el código", signUp.status);
          setError(MORE_STEPS_ERROR);
          return;
        }
        await signUp.finalize();
      }
      router.replace("/onboarding");
    } catch (unexpected) {
      console.error("confirmCode falló de forma inesperada", unexpected);
      setError(BAD_CODE_ERROR);
    } finally {
      setPending(false);
    }
  }, [code, mode, signIn, signUp, pending]);

  return (
    <AppScreen contentStyle={styles.content} style={styles.screen}>
      <View>
        <Text style={styles.title}>{step === "email" ? "Tu correo" : "Revisá tu correo"}</Text>
        <Text style={styles.description}>
          {step === "email"
            ? "Te enviamos un código de un solo uso, sin contraseña que recordar."
            : `Escribí el código de 6 dígitos que enviamos a ${email}.`}
        </Text>
      </View>
      <View style={styles.actions}>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {step === "email" ? (
          <>
            <TextInput
              autoCapitalize="none"
              autoComplete="email"
              autoFocus
              keyboardType="email-address"
              onChangeText={setEmail}
              placeholder="tucorreo@ejemplo.com"
              placeholderTextColor={tokens.color.inkFaint}
              style={styles.input}
              value={email}
            />
            <AppButton disabled={pending || email.length === 0} onPress={sendCode}>
              {pending ? "Enviando…" : "Enviar código"}
            </AppButton>
          </>
        ) : (
          <>
            <TextInput
              autoFocus
              keyboardType="number-pad"
              maxLength={6}
              onChangeText={setCode}
              placeholder="000000"
              placeholderTextColor={tokens.color.inkFaint}
              style={styles.input}
              value={code}
            />
            <AppButton disabled={pending || code.length < 6} onPress={confirmCode}>
              {pending ? "Verificando…" : "Confirmar"}
            </AppButton>
            <AppButton disabled={pending} onPress={useDifferentEmail} variant="quiet">
              Usar otro correo
            </AppButton>
          </>
        )}
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: tokens.color.bg },
  content: { justifyContent: "flex-end" },
  title: { color: tokens.color.ink, fontFamily: tokens.font.serif, fontSize: tokens.type.title.size, lineHeight: tokens.type.title.lineHeight },
  description: { color: tokens.color.inkMuted, fontFamily: tokens.font.sansLight, fontSize: tokens.type.body.size, lineHeight: tokens.type.body.lineHeight, marginTop: tokens.space.lg },
  actions: { gap: tokens.space.md, marginTop: tokens.space.xxl },
  input: {
    backgroundColor: tokens.color.surface,
    borderColor: tokens.color.borderStrong,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    color: tokens.color.ink,
    fontFamily: tokens.font.sans,
    fontSize: tokens.type.body.size,
    paddingHorizontal: tokens.space.lg,
    paddingVertical: tokens.space.lg
  },
  error: { color: tokens.color.accentDeep, fontFamily: tokens.font.sansMedium, fontSize: tokens.type.caption.size, lineHeight: tokens.type.caption.lineHeight, textAlign: "center" }
});
