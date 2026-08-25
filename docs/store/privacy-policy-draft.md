# Borrador de política de privacidad / Privacy policy draft

> **No publicada — pendiente de revisión legal y publicación.** Este archivo
> organiza los hechos técnicos verificables en el repositorio para que el
> titular redacte, revise y publique una política en una URL HTTPS estable.
> No es una declaración legal final ni debe enlazarse desde la tienda hasta
> completar los campos entre corchetes.

**Titular:** `[nombre legal del titular]`<br>
**Contacto de privacidad:** `[correo o formulario de contacto]`<br>
**URL publicada:** `[URL HTTPS definitiva]`<br>
**Fecha de vigencia:** `[fecha de publicación]`

## Español

### Alcance

Esta política describirá el tratamiento de información al usar Bible AI
Honduras. Antes de publicarla, el titular debe confirmar su jurisdicción,
base legal, plazos de retención, mecanismo de solicitudes de privacidad y los
proveedores que efectivamente estén configurados en producción.

### Información que el producto puede tratar

Según el código actual, las funciones usan o almacenan:

| Categoría | Ejemplos observables en el repositorio | Finalidad funcional |
| --- | --- | --- |
| Cuenta | identificador de Clerk; correo y nombre opcionales | autenticar y asociar datos a la cuenta |
| Preferencias | versión bíblica, hora de recordatorio, modo oscuro, código de referido | personalizar la experiencia |
| Contenido de uso | preguntas, mensajes, conversaciones, sentimiento expresado, devocionales generados e historias/escenas | responder, mostrar historial y generar las funciones solicitadas |
| Estado de acceso | conteos de cuota y estado de Pro/expiración | aplicar límites gratuitos y acceso a Pro |
| Notificaciones | preferencia/hora de recordatorio | enviar el recordatorio diario si la persona lo activa |

El texto final debe distinguir qué información es obligatoria, opcional o
recogida directamente por cada proveedor. No afirmar que no existe recopilación
adicional hasta revisar la configuración real de producción, SDKs y portales de
distribución.

### Proveedores y transferencias que deben confirmarse

El repositorio integra o prevé los siguientes servicios. El titular debe
confirmar cuáles se activan en producción y enlazar sus avisos correspondientes:

| Servicio | Papel visible en el repositorio | Pendiente antes de publicar |
| --- | --- | --- |
| Clerk | autenticación | confirmar regiones, retención y aviso aplicable |
| Convex | base de datos, funciones y almacenamiento | confirmar región, retención y aviso aplicable |
| Proveedor(es) de IA | respuestas/devocionales y posibles ilustraciones | confirmar proveedor/modelo final, datos enviados y términos; el proveedor de imágenes sigue sujeto al benchmark #22 |
| RevenueCat | compra/restauración y estado de Pro | confirmar productos de tienda y aviso aplicable |
| Apple / Google | distribución, compra y notificaciones de plataforma | completar los formularios de privacidad de cada portal |

### Historial y controles de la persona usuaria

El código de la app ofrece una acción para borrar el historial de
conversaciones. El PRD y la interfaz indican que el historial es privado por
cuenta y no se usa para entrenar modelos de IA de terceros. Antes de publicar,
el titular debe documentar con precisión qué registros se eliminan, cuáles se
conservan por seguridad/contabilidad y durante cuánto tiempo.

### Contenido sensible y asistencia

Las preguntas y sentimientos pueden revelar información personal o sensible.
La política final y la interfaz deben explicar cómo se manejan esos datos y no
prometer atención pastoral, médica, de salud mental, emergencia o crisis. La
app contiene contenido cristiano y resultados generados por IA, que pueden ser
incorrectos.

### Solicitudes y cambios

Antes de publicación, completar aquí el canal y el proceso verificable para
acceso, corrección, eliminación u otras solicitudes aplicables:

`[proceso y canal de solicitudes de privacidad]`

También completar cómo se avisarán cambios materiales de esta política:

`[método de aviso de cambios]`

## English

### Status and scope

This is a non-published working draft. Before publishing it, the data
controller must confirm the applicable jurisdiction, legal basis, retention
periods, privacy-request process, and the providers actually enabled in
production.

### Product data to validate

The current code uses or stores a Clerk identifier, optional email/name, user
preferences, feature content such as questions and conversations, quota and Pro
status, and reminder preferences. The final policy must explain which data is
required or optional, which provider collects it, its retention, and the
applicable choices.

### AI, privacy, and user controls

The product brief and interface state that conversation history is private to
the account, is not used to train third-party AI models, and can be deleted
from the app. The final policy must identify the actual AI providers and data
flows used in production, including the final illustration provider after the
#22 benchmark, and specify the exact deletion and retention behavior.

### Required publication details

- Legal controller: `[legal controller name]`
- Privacy contact: `[contact email or form]`
- Published HTTPS URL: `[final URL]`
- Effective date: `[publication date]`
- Privacy request process: `[verified process]`
- Notice-of-changes process: `[verified process]`
