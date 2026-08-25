# Beta cerrada — otorgar Pro a un tester

Contexto: #93. La beta corre **sin RevenueCat**, así que no hay compra real.
La autoridad de `isPro` no es el SDK sino la tabla `entitlements` de Convex,
así que se puede escribir esa fila a mano y los 4 módulos se desbloquean igual (#32).

## Requisito previo

El tester tiene que **haber entrado al menos una vez** a la app. El primer login
corre `users.upsert` y crea su fila en `users`. Sin eso el comando devuelve
`{ ignored: true }` y no hace nada — igual que el webhook, no creamos usuarios
desde afuera.

## Sacar el `clerkId`

Es el `identity.subject` de Clerk (`user_2abc...`). Dos formas:

- **Clerk dashboard** → *Users* → abrir el tester → copiar el *User ID*.
- **Convex dashboard** → tabla `users` → columna `clerkId`.

## Otorgar Pro

```bash
npx convex run entitlements:grantProForBeta '{"clerkId":"user_2abc..."}'
```

Con vencimiento (epoch en milisegundos):

```bash
npx convex run entitlements:grantProForBeta \
  '{"clerkId":"user_2abc...","expiresAt":1788000000000}'
```

## Revocar

```bash
npx convex run entitlements:grantProForBeta '{"clerkId":"user_2abc...","isPro":false}'
```

## Verificar

En el Convex dashboard, tabla `entitlements`: la fila del tester debe tener
`isPro: true` y `source: "beta_manual"`.

En la app, el tester **cierra sesión y vuelve a entrar** (o espera a que
`entitlements.mine` se refresque) y los 4 módulos dejan de contar cuota.

## Por qué `source: "beta_manual"`

Distingue un Pro de cortesía de uno comprado. Cuando #39 conecte RevenueCat de
verdad, estas filas se pueden auditar o limpiar sin tocar las compras reales.

## Seguridad

`grantProForBeta` es un `internalMutation`: **no se puede llamar desde la app**,
solo desde el dashboard de Convex o `npx convex run` con las credenciales del
deployment. Un tester no puede auto-otorgarse Pro.
