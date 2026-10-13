# App Privacy — edición gratuita 1.0

Guía para cargar el cuestionario de App Store Connect del build final de #234.
No certifica que el formulario del portal ya esté enviado. No responder “no
recopilamos datos”: la app guarda cuenta, contenido, lectura y diagnóstico.

| Tipo de dato Apple | Datos / finalidad | Vinculado a cuenta | Tracking |
| --- | --- | --- | --- |
| Contact Info: Name, Email Address | Clerk y nombre visible en grupos; App Functionality | Sí | No |
| Identifiers: User ID | Clerk ID, perfil Convex; App Functionality | Sí | No |
| User Content: Other User Content | Preguntas, conversaciones, notas, oración, respuestas e historias; App Functionality | Sí | No |
| Sensitive Info | Creencias religiosas y contenido sensible que se introduce voluntariamente; App Functionality | Sí | No |
| Usage Data: Product Interaction | Lectura, planes, repasos, cuotas e invitaciones; App Functionality | Sí | No |
| Other Data | Fechas opcionales de cumpleaños (día/mes) y bautismo/conversión; App Functionality | Sí | No |
| Usage Data: Product Interaction | Eventos de uso de la instalación; Analytics | No* | No |
| Identifiers: Device ID | Identificador aleatorio persistente de instalación usado en diagnóstico; Analytics / App Functionality | No* | No |
| Diagnostics: Crash Data / Other Diagnostic Data | Mensaje/stack de error JS, plataforma y build; App Functionality | No* | No |

\* El código no adjunta Clerk ID ni correo a la telemetría, que caduca a los
90 días. Confirmar en la configuración del servicio que no se relacione con
una identidad; Apple exige considerar también la vinculación por terceros.
Revisar si los errores del artefacto final cambian las categorías.

La edición 1.0 no ejecuta RevenueCat, no envía atributos de invitación al SDK y
no procesa compras, aunque exista una key remota. **Purchase History no se
selecciona por tener una dependencia instalada**: confirmar la recolección
real del build y los proveedores. Un acceso de cortesía previo no constituye
una compra nueva.

La guía antigua omitía diagnóstico y Analytics, que sí existen en
`src/lib/telemetry.ts` / `convex/telemetry.ts`. No copiar sus respuestas.
Preguntar/Voces/Sentir envían texto a OpenAI/Anthropic después del consentimiento.
Las notas/diario no se envían deliberadamente a IA. Los grupos muestran nombre
y progreso a sus integrantes; no son un chat público.

Pasos del portal:

- Cargar la URL `https://luiscf1226.github.io/bible-ai-honduras/privacidad/` después
  de desplegar su revisión para la edición gratuita.
- Revisar cada tipo y finalidad con el build, Clerk, Convex y los proveedores IA.
- Declarar contenido sensible, recolección opcional, vinculación y ausencia de
  tracking de acuerdo con los cuestionarios Apple, sin confundir Analytics con
  tracking publicitario.
- Probar `Ajustes → Cuenta → Eliminar mi cuenta`, incluido borrado Clerk.
- Guardar fecha y evidencia de las respuestas publicadas en el portal.

Referencia: [App privacy details](https://developer.apple.com/app-store/app-privacy-details/).
