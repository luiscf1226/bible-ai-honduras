# RevenueCat sandbox — Pro $4.99/mes

La app Expo ya existe. El contrato de producto se puede crear ahora en el
**Test Store** de RevenueCat. Una compra real en Test Store **no corre en CI**:
hace falta un humano en el dashboard y un **Expo development build**. Expo Go
solo mockea las APIs y no puede completar una compra.

Convex es la fuente de verdad de Pro (`entitlements`). El SDK de la app
(`src/lib/revenuecat.ts`) solo compra y restaura; **nunca** lee `CustomerInfo`
para decidir `isPro`. La UI lee `entitlements.mine`.

## Product contract (nombres estables)

| Objeto RevenueCat | Valor |
| --- | --- |
| Entitlement ID | `pro` |
| Offering ID | `default` (marcar Current) |
| Package | Monthly (`$rc_monthly`) |
| Test Store product ID | `pro_monthly` |
| Precio / duración | USD $4.99 / 1 mes, auto-renovable |
| Trial / intro offer | Ninguno en v1 |

No hardcodear `$4.99` como precio de checkout en UI (#30). El paywall debe
mostrar el string localizado que entrega la store.

`app_user_id` de RevenueCat **debe** ser el Clerk `identity.subject` (el mismo
string que `users.clerkId`). `src/lib/revenuecat.ts` → `logIn(clerkUserId)`.

## Cómo retomar el Test Store (humano)

1. Crear un proyecto RevenueCat para esta app (dev y prod en el mismo proyecto).
2. **Product catalog → Test Store**: crear `pro_monthly`, USD 4.99, 1 mes.
3. Crear el entitlement `pro` y adjuntar `pro_monthly`.
4. Crear el offering `default`; paquete Monthly con `pro_monthly`; marcarlo Current.
5. Copiar la **Test Store public SDK key** a `EXPO_PUBLIC_REVENUECAT_API_KEY`
   en `.env.local`. No commitearla. Nunca usar la secret API key en la app.
6. Configurar el webhook:
   - URL: `https://<deployment>.convex.site/revenuecat`
   - Authorization header en el dashboard: `Bearer <mismo valor que REVENUECAT_WEBHOOK_SECRET>`
   - En Convex: `npx convex env set REVENUECAT_WEBHOOK_SECRET`
   - Enviar eventos sandbox (y más adelante production).
7. Instalar `react-native-purchases` (SDK 9.5.4+) en el issue **#31** y generar
   un development build (`npx expo run:ios` / `run:android` o EAS). El wrapper
   de #4 tira `RevenueCatDevBuildRequiredError` hasta que exista el nativo.
8. Tras el login de Clerk, `logIn(identity.subject)`. Comprar el paquete Monthly
   del offering `default`. Restore con `restorePurchases`.
9. Verificar: el webhook deja `entitlements.isPro = true`; `quotas.checkAndConsume`
   deja de contar. Test Store renueva un sub de 1 mes cada 5 minutos y expira
   después de cinco renovaciones.

iOS bundle ID y Android application ID finales se confirman antes de productos
reales de App Store / Play. Hoy `app.json` tiene `android.package`
`com.bibleaihonduras.app`; iOS todavía no declara `bundleIdentifier`.

## Lo que este issue NO hace

- No hay pantalla de paywall (`app/paywall.tsx` es #30).
- No hay flujo de compra en la app más allá del wrapper (#31).
- No se creó el proyecto en el dashboard (humano).
- No hay productos de Apple/Google todavía.

## Antes de release (no de este PR)

- Cambiar la Test Store key por las keys de plataforma en builds de store.
- Restore visible + Terms/Privacy en el paywall (#30/#33).
- Compra sandbox real de Apple y de Google license-tester.
- Verificar que EXPIRATION deja `isPro: false` y las cuotas free vuelven.

## Coste (orden de magnitud)

Plan público de RevenueCat: gratis hasta ~$2,500 MTR, después 1% del tracked
revenue. Test Store no genera venta. A $4.99/mes, ~501 suscriptores activos
antes del umbral. Re-chequear al crear la cuenta.

## Fuentes (19–24 agosto 2026)

- [Productos, entitlements, offerings](https://www.revenuecat.com/docs/projects/configuring-products)
- [Test Store](https://www.revenuecat.com/docs/test-and-launch/sandbox/test-store)
- [Expo](https://www.revenuecat.com/docs/getting-started/installation/expo)
- [Identidad / App User ID](https://www.revenuecat.com/docs/customers/identifying-customers)
- [Webhooks](https://www.revenuecat.com/docs/integrations/webhooks)
