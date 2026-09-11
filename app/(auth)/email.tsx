import { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { useSignIn, useSignUp } from "@clerk/expo";

import { AppButton } from "../../src/components/AppButton";
import { AppScreen } from "../../src/components/AppScreen";
import {
  authErrorMessage,
  canResend,
  classifySendError,
  classifyVerifyError,
  resendCooldownRemaining,
  resendLabel,
  sendEmailCode,
  type AuthErrorKind,
  type SendCodeDeps,
} from "../../src/features/auth/emailCodeFlow";
import { tokens } from "../../src/theme/tokens";

type Step = "email" | "code";

// `@clerk/expo@4.5.0` reexporta los hooks de `@clerk/react@6.14.4`: `useSignIn()`
// devuelve `{ signIn, errors, fetchStatus }` y `signIn` es un SignInFutureResource.
// Los métodos devuelven `{ error }` (no lanzan) y `finalize()` activa la sesión —
// no hay `setActive` en el hook. Clerk no tiene una sola API para "entrar o
// registrarse con este correo", así que se intenta sign-in y solo si el
// identificador no existe se cae a sign-up; los dos comparten la pantalla de
// código porque ambos usan la estrategia email_code.
export default function EmailScreen() {
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<AuthErrorKind | null>(null);
  const [lastSentAt, setLastSentAt] = useState<number | null>(null);
  const [cooldown, setCooldown] = useState(0);

  // El guard del doble envío vive en un ref y no en el state: `pending` se lee
  // de la closure del render y dos taps seguidos en el mismo frame verían el
  // valor viejo. El ref es la misma caja en todos los renders.
  const inFlight = useRef(false);

  // El contador se recalcula contra el reloj en cada tick en vez de descontar,
  // así un render perdido o un tick atrasado no acortan el cooldown.
  useEffect(() => {
    if (lastSentAt === null) {
      setCooldown(0);
      return;
    }
    setCooldown(resendCooldownRemaining(lastSentAt, Date.now()));
    const timer = setInterval(() => {
      const remaining = resendCooldownRemaining(lastSentAt, Date.now());
      setCooldown(remaining);
      if (remaining === 0) {
        clearInterval(timer);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [lastSentAt]);

  const goBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/login");
  }, []);

  const useDifferentEmail = useCallback(() => {
    setStep("email");
    setCode("");
    setError(null);
    setLastSentAt(null);
  }, []);

  const requestCode = useCallback(
    async (isResend: boolean) => {
      if (inFlight.current) {
        return;
      }
      if (isResend && !canResend(lastSentAt, Date.now())) {
        return;
      }
      inFlight.current = true;
      setError(null);
      setPending(true);
      try {
        // Un reenvío no vuelve a crear nada: el intento ya existe en el cliente
        // de Clerk, así que se re-prepara el mismo factor.
        if (isResend) {
          const { error: resendError } =
            mode === "signIn" ? await signIn.emailCode.sendCode() : await signUp.verifications.sendEmailCode();
          if (resendError) {
            console.error("No se pudo reenviar el código", resendError);
            setError(classifySendError(resendError));
            return;
          }
          setLastSentAt(Date.now());
          return;
        }

        const deps: SendCodeDeps = {
          sendSignInCode: (emailAddress) => signIn.emailCode.sendCode({ emailAddress }),
          createSignUp: (emailAddress) => signUp.create({ emailAddress }),
          sendSignUpCode: () => signUp.verifications.sendEmailCode(),
        };
        const result = await sendEmailCode(email.trim(), deps);
        if (!result.ok) {
          console.error("No se pudo enviar el código", result.error, result.cause);
          setError(result.error);
          return;
        }
        setMode(result.mode);
        setStep("code");
        setLastSentAt(Date.now());
      } finally {
        inFlight.current = false;
        setPending(false);
      }
    },
    [email, lastSentAt, mode, signIn, signUp]
  );

  const sendCode = useCallback(() => requestCode(false), [requestCode]);
  const resendCode = useCallback(() => requestCode(true), [requestCode]);

  const confirmCode = useCallback(async () => {
    if (inFlight.current) {
      return;
    }
    inFlight.current = true;
    setError(null);
    setPending(true);
    try {
      const { error: verifyError } =
        mode === "signIn"
          ? await signIn.emailCode.verifyCode({ code })
          : await signUp.verifications.verifyEmailCode({ code });
      if (verifyError) {
        console.error("La verificación del código falló", verifyError);
        setError(classifyVerifyError(verifyError));
        return;
      }

      const status = mode === "signIn" ? signIn.status : signUp.status;
      if (status !== "complete") {
        console.error("El intento quedó en un estado inesperado tras verificar el código", status);
        setError("moreSteps");
        return;
      }

      // `finalize()` es lo que activa la sesión; si falla, no navegamos.
      const { error: finalizeError } = mode === "signIn" ? await signIn.finalize() : await signUp.finalize();
      if (finalizeError) {
        console.error("No se pudo activar la sesión", finalizeError);
        setError(classifySendError(finalizeError));
        return;
      }
      router.replace("/onboarding");
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }, [code, mode, signIn, signUp]);

  return (
    <AppScreen contentStyle={styles.content} style={styles.screen}>
      <View>
        <Text style={styles.title}>{step === "email" ? "Tu correo" : "Revisá tu correo"}</Text>
        <Text style={styles.description}>
          {step === "email"
            ? "Te enviamos un código de un solo uso, sin contraseña que recordar."
            : `Escribí el código de 6 dígitos que enviamos a ${email.trim()}.`}
        </Text>
      </View>
      <View style={styles.actions}>
        {error ? <Text style={styles.error}>{authErrorMessage(error)}</Text> : null}
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
            <AppButton disabled={pending || email.trim().length === 0} onPress={sendCode}>
              {pending ? "Enviando…" : "Enviar código"}
            </AppButton>
            <AppButton disabled={pending} onPress={goBack} variant="quiet">
              Volver
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
            <AppButton disabled={pending || cooldown > 0} onPress={resendCode} variant="quiet">
              {resendLabel(cooldown)}
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
