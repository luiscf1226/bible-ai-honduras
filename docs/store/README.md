# Materiales de envío a App Store y Google Play (#38)

Este directorio reúne los materiales que se pueden preparar en el repositorio
para la ficha y revisión de tienda. No sustituye la configuración de los
portales de Apple o Google.

## Estado (actualizado tras #107 / PR #118 y #92)

| Entregable | Estado | Dependencia |
| --- | --- | --- |
| Política de privacidad (repo + Pages) | Publicada; copy actualizado con borrado in-app | Redeploy de Pages al fusionar este PR |
| Página externa de eliminación | Publicada; apunta también al flujo in-app | Google Play Data deletion |
| Ficha de tienda (es-HN) | Lista para copiar | Precio localizado final (#37) |
| Notas de revisión (ES + EN) | Listas; incluyen ruta 5.1.1(v) in-app | Cuenta de revisor en el portal |
| Consentimiento explícito de IA | Implementado en app (beta) | Validar en build de dispositivo (#37) |
| Cerrar sesión + eliminar cuenta in-app | Implementado (#107 / PR #118) | `CLERK_SECRET_KEY` en Convex; prueba en dispositivo |
| Manifiesto de capturas | Listo para ejecutar | Build estable (#37 / #101); ícono/splash (#102) |
| PNG de capturas de tienda | **Pendiente** — no inventados en git | #37 / #101 |

URL de la política:
`https://luiscf1226.github.io/bible-ai-honduras/privacidad/`.

## Archivos

- [screenshot-manifest.md](./screenshot-manifest.md): qué capturar, desde qué
  estado y cómo nombrar los archivos.
- [review-notes.md](./review-notes.md): texto bilingüe para App Review y Play
  Console, incluida la explicación de IA y contenido religioso, y la ruta
  exacta de cierre de sesión / eliminación de cuenta.
- [privacy-policy.md](./privacy-policy.md): copia editable de la política que
  se publica como HTML en GitHub Pages.
- [listing-es-HN.md](./listing-es-HN.md): título, subtítulo, descripción y
  palabras clave con conteos para App Store y Google Play.
- [app-privacy-testflight.md](./app-privacy-testflight.md): guía del
  cuestionario App Privacy de App Store Connect.
- [tester-beta-notice.md](./tester-beta-notice.md): aviso corto para testers
  de la beta cerrada.

## Lo que queda pendiente para cerrar #38

Estos ítems **no** se resuelven en este paquete de docs. Hasta que existan,
el criterio de aceptación de #38 (capturas + política + notas) sigue
incompleto en la parte de capturas:

1. **Capturas PNG de tienda** desde una build de dispositivo estable
   (#37 E2E / #101 TestFlight–Play Internal). No se suben capturas inventadas
   ni de Expo Go al repositorio.
2. **Ícono y splash de producción** (#102) antes de que la ficha se vea
   completa en springboard / launcher.
3. **Cuenta de revisión** y credenciales solo en App Store Connect / Play
   Console (nunca en git).
4. **Validación en dispositivo** del flujo `Ajustes → Cuenta → Eliminar mi
   cuenta` y de que `CLERK_SECRET_KEY` esté configurada en Convex (sin ella
   los datos se borran pero la identidad de Clerk puede quedar viva; ver
   PR #118).
5. **Producto / precio Pro localizado** confirmado en sandbox antes de
   publicar el precio en la ficha (#37 + RevenueCat).
6. **Carga humana** en los portales: App Privacy, Data safety, URL de
   privacidad, y notas de revisión pegadas desde
   [review-notes.md](./review-notes.md).

## Qué no certifica este paquete

- No certifica que las capturas se hayan tomado ni que representen una build
  de producción.
- No crea cuentas de Apple Developer, Google Play, Clerk, Convex o RevenueCat.
- No prueba compras reales, restauración ni los cinco módulos en dispositivos.
- No confirma licencias de contenido bíblico ni la disponibilidad de NVI; el
  PRD aún marca esa licencia como pendiente.

La evidencia de dispositivo y portales pertenece a #37 / #101 y a los
responsables de las cuentas de distribución.
