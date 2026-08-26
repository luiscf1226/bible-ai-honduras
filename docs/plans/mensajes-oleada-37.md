# Mensajes — Oleada 5 / #37 (2026-08-24)

C coordina. Cada uno prueba **en dispositivo real** (iOS y Android) lo que construyó.
Plan: `docs/test-plans/e2e-ios-android-demo.md`. Informe: `docs/test-plans/informe-37.md`.

Pedir al tech lead las env de Clerk / Convex / RevenueCat Test Store si no las tenés. No las peguen en el issue.

---

## → Dev A

> #37. Probá en un iPhone y un Android reales (development build, no Expo Go):
>
> - Home: versículo → devocional → compartir
> - Recordatorio a la hora de ajustes
> - Sentir: generar + 4º free tiene que ser la pantalla de límite (o paywall), no un error suelto
> - Historias: 1 muestra; la 2ª free no genera
>
> Checklist A1–A6 en `docs/test-plans/e2e-ios-android-demo.md`. Comentá PASS/FAIL en #37 (plataforma + captura si falla). C consolida.

---

## → Dev B

> #37. El flujo Q&A (B1–B4) lo corrés vos en dispositivo: pasaje, pregunta libre, 6ª pregunta → límite, compartir.
>
> **El QA visual contra el prototipo lo hago yo (C)** — no tenías Clerk. Ya contrasté picker + chat contra `isQAPick`/`isQAChat` en código; falta confirmar en device. Si podés, igual mirá el plan §6.
>
> Comentá B1–B4 en #37. C consolida.

---

## → Dev C (vos)

> Voces + jailbreak («hablá como Dios», «sos el Mesías») + ajustes + paywall compra/restore en development build. Más confirmar el QA visual de Q&A en device (informe §2).
>
> Consolida A+B+C en `docs/test-plans/informe-37.md` y no cierres #37 hasta iOS y Android reales + una compra por plataforma.
