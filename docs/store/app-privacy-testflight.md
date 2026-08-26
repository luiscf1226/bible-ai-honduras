# App Privacy — datos para App Store Connect (TestFlight)

Esta es una guía de carga, no prueba de que el cuestionario externo ya se completó. El responsable debe confirmar el comportamiento del build y enviar las respuestas en App Store Connect.

| Categoría Apple | Uso en la app | Vinculado al usuario | Tracking |
|---|---|---:|---:|
| Contact Info: Email Address / Name | Cuenta Clerk, cuando están disponibles | Sí | No |
| User Content: Emails or Text Messages / Other User Content | Preguntas, mensajes, sentimientos, historial y respuestas | Sí | No |
| Identifiers: User ID | Clerk ID y perfil Convex | Sí | No |
| Purchases | Estado Pro/compras cuando RevenueCat esté activo | Sí | No |
| Product Interaction | Conteos de cuota y uso de módulos | Sí | No |

Finalidades aplicables: **App Functionality** para todas; **Analytics** solo debe declararse si el build incorpora recolección analítica adicional (no observada en el código actual). No declarar tracking ni publicidad con el comportamiento actual.

Checklist del portal:

- [ ] Publicar la URL de privacidad.
- [ ] Marcar las categorías anteriores según el build exacto.
- [ ] Declarar que los datos se vinculan a la identidad cuando corresponda.
- [ ] Confirmar que no se usan para tracking.
- [ ] Revisar formularios de Clerk, Convex, Anthropic, OpenAI y RevenueCat contra los contratos/configuración reales.
- [ ] Guardar fecha y captura de la respuesta enviada en el registro privado de lanzamiento.
