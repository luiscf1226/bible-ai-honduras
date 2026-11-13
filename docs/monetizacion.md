# Monetización: freemium, Pro a US$2.99, donaciones y métricas

## Límite diario gratis

Los números viven en `convex/quotaLimits.ts` (`QUOTA_LIMITS`). Cambiar uno ahí
cambia el servidor, los textos del límite, el paywall y Ajustes.

| Función | Gratis por día | Costo medido por uso (oct–nov 2026) |
| --- | --- | --- |
| Preguntar | 5 preguntas | ~US$0.006 |
| Personajes (Voces) | 10 mensajes | ~US$0.003 |
| Historias ilustradas | 1 historia | ~US$0.21 (4 imágenes) |
| Sentir | 3 devocionales | ~US$0.007 |
| Fondos con IA | 3 | 1 imagen |

- Se aplica en Convex (`quotas.charge`), nunca solo en la app.
- El día es el de Honduras (UTC-6, sin horario de verano): el contador vuelve
  a las 00:00 de Tegucigalpa (06:00 UTC).
- Pro no tiene límite. Su uso se cuenta igual, para las métricas.
- Volver a abrir una historia ya hecha no gasta.

## Pagos: tres modos

`EXPO_PUBLIC_PAYMENTS_MODE` decide cada build (o actualización OTA):

| Modo | Qué pasa | Qué necesita |
| --- | --- | --- |
| `off` (sin valor) | Edición gratuita: límite sin paywall | Nada |
| `test` | Paywall a US$2.99 con compra simulada | `npx convex env set PAYMENTS_TEST_MODE 1` en un Convex de prueba |
| `revenuecat` | Compra real por App Store / Google Play | Todo lo de abajo |

El modo de prueba nunca toca una tienda. Fuera de un Convex con
`PAYMENTS_TEST_MODE=1`, `entitlements.grantTestPro` falla, así que en
producción nadie se regala Pro. Para repetir el flujo:
`entitlements.cancelTestPro`.

### Probar el límite y el paywall sin backend

```bash
QA_HARNESS=1 EXPO_PUBLIC_PAYMENTS_MODE=test npx expo start --web
# /preguntar?qa=limit → "Seguir sin límite con Pro" → paywall US$2.99 → "Empezar con Pro"
```

### Lo que Luis configura para cobrar de verdad

1. **App Store Connect**: suscripción auto-renovable mensual `pro_monthly` a
   US$2.99 (grupo de suscripción nuevo), con nombre y descripción en español.
   Aceptar el acuerdo de apps pagadas y cargar datos bancarios y fiscales.
2. **Google Play Console**: suscripción `pro_monthly`, plan base mensual a
   US$2.99. Perfil de pagos y cuentas de prueba de licencia.
3. **RevenueCat**: proyecto con las apps de iOS y Android, entitlement `pro`,
   offering `default` con el paquete mensual (detalle en
   `docs/revenuecat-sandbox.md`).
4. **Webhook**: URL `https://<deployment>.convex.site/revenuecat` con el mismo
   secreto que `npx convex env set REVENUECAT_WEBHOOK_SECRET`.
5. **EAS**: `EXPO_PUBLIC_PAYMENTS_MODE=revenuecat` y
   `EXPO_PUBLIC_REVENUECAT_API_KEY` (key pública por plataforma) como
   variables de EAS del perfil que se publica. Nunca en el repo.

El precio que ve la persona en una compra real sale de la tienda ya
localizado; la app no lo escribe (App Store 3.1.2).

## Donaciones

Pantalla `/donar`: explica para qué es y abre el link en el navegador. La app
no procesa pagos.

| Variable | Ejemplo |
| --- | --- |
| `EXPO_PUBLIC_DONATION_URL` | `https://…` (solo https) |
| `EXPO_PUBLIC_DONATION_PLATFORMS` | `android` · `android,ios,web` |

Sin las dos, la entrada de Ajustes no aparece. Cada plataforma se enciende a
mano por las reglas de las tiendas:

- **App Store**: pedir donaciones con un link afuera solo se acepta para una
  organización sin fines de lucro aprobada (guías 3.1.1, 3.2.1(vi) y
  3.2.2(iv)). Una "propina" al desarrollador tiene que ser compra dentro de la
  app. Dejar `ios` fuera hasta tener una ONG aprobada por Apple.
- **Google Play**: una donación sin Google Play Billing solo se acepta para una
  organización exenta de impuestos. Si la cuenta que recibe no lo es, dejar
  `android` fuera del build de Play.
- **APK del sitio**: no pasa por ninguna tienda; `android` se puede encender
  en el perfil `apk` de EAS.

## Métricas

Todo se calcula en Convex, solo agregados:

```bash
npx convex run monetization:report '{"days": 7}'
```

| Clave | Qué es |
| --- | --- |
| `users.active_1d` / `_7d` / `_30d` | Cuentas que abrieron la app o usaron la IA |
| `quota.usage` (por módulo) | Usos de IA del día, Pro incluido |
| `quota.limit_hit` (por módulo) | Cuentas que chocaron con el límite |
| `pro.active` / `pro.new` | Pro vigentes y conversiones nuevas del día |
| `pro.conversion` | Pro sobre el total de cuentas |
| `pro.conversion_after_limit` | De quienes chocaron con el límite en 30 días, cuántos son Pro |

La foto la arma `adminAdapter.rollupDay` cada hora y también se ve en el
dashboard de admin (sección Pro). Para llenar días pasados:
`npx convex run adminAdapter:backfill '{"days":30}'`.

Privacidad: la cuenta guarda solo los días (YYYY-MM-DD) en que estuvo activa,
los últimos 30, en su propia fila (`users.activeDays`). Nunca qué hizo. Se
borra con la cuenta.
