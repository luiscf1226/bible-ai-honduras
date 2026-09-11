# Notas para revisión de tiendas / Store review notes

**Estado:** texto de envío preparado desde el repositorio. Reemplazar solo los
datos de acceso al crear la entrega. No pegar credenciales en git.

## Español

### Propósito de la app

Bible AI Honduras es una app devocional cristiana para lectura y reflexión
personal. Su enfoque es evangélico/protestante y ofrece devocional diario,
preguntas sobre pasajes bíblicos, conversaciones con personajes bíblicos
humanos, devocionales según cómo se siente la persona e historias bíblicas
ilustradas.

### Uso de IA y contenido religioso

- Algunas respuestas y devocionales se generan con IA. El producto busca
  anclarlos a pasajes bíblicos y mostrar referencias; no se presentan como una
  autoridad religiosa ni como consejo independiente.
- OpenAI recupera contexto semántico y genera ilustraciones desde prompts
  editoriales; Anthropic genera texto. Las conversaciones no se usan como
  prompts de imágenes.
- Las ilustraciones de las historias bíblicas se generan por IA y se identifican
  como tales en los materiales de tienda.
- La app no permite que un modelo se presente como Dios, Jesús ni el Espíritu
  Santo. Las conversaciones en primera persona están limitadas a personajes
  bíblicos humanos.
- La app acompaña la lectura personal; no sustituye consejo pastoral, atención
  médica, salud mental, servicios de emergencia ni apoyo de crisis. La IA puede
  cometer errores.

### Privacidad y cuenta

La app usa autenticación de Clerk y guarda un perfil mínimo, preferencias y el
historial de conversaciones necesario para las funciones. El historial es
privado por cuenta y la app expone una acción para borrar el historial. El
Bible AI Honduras no entrena modelos propios con ese historial. La política
publicada explica el tratamiento separado de cada proveedor de IA:
`https://luiscf1226.github.io/bible-ai-honduras/privacidad/`.

### Ruta exacta para cerrar sesión y eliminar la cuenta (guideline 5.1.1(v))

La eliminación de cuenta está **dentro de la app**, sin salir al navegador:

**Cerrar sesión**

1. Iniciar sesión con la cuenta de revisión.
2. En el Home (pestaña Hoy), tocar el ícono de engranaje ⚙ arriba a la derecha:
   abre **Ajustes**.
3. Bajar hasta la sección **Cuenta** (es la última de la pantalla).
4. Tocar **Cerrar sesión** → confirmar **Cerrar sesión** en el diálogo.
5. La app vuelve a la pantalla de bienvenida y la siguiente apertura pide login.

**Eliminar mi cuenta** — `Ajustes → Cuenta → Eliminar mi cuenta → escribir ELIMINAR`

1. Iniciar sesión con la cuenta de revisión.
2. Tocar el engranaje ⚙ del Home para abrir **Ajustes**.
3. Bajar hasta la sección **Cuenta**.
4. Tocar **Eliminar mi cuenta** (en rojo).
5. Paso 1 de la confirmación: el diálogo enumera qué se borra, dice que es
   irreversible y avisa que **eliminar la cuenta no cancela la suscripción de la
   tienda** (eso se hace en App Store / Google Play). Tocar **Continuar**.
6. Paso 2 de la confirmación: escribir la palabra **ELIMINAR** en el campo y
   tocar **Eliminar mi cuenta para siempre**.
7. El borrado es en cascada y definitivo: perfil, conversaciones y mensajes,
   contadores de uso, plan dentro de la app, historias y las imágenes generadas
   (los archivos, no solo la referencia), más el usuario de identidad en Clerk.
   Después la app cierra la sesión, cancela el recordatorio diario y vuelve a la
   pantalla de bienvenida. Volver a registrarse con el mismo correo crea una
   cuenta limpia.

También existe la página web que exige Google Play
(`https://luiscf1226.github.io/bible-ai-honduras/eliminar-cuenta/`), pero no es
necesaria para la revisión de App Store: el flujo in-app es completo.

### Compras

La app ofrece un plan Pro mediante compras dentro de la app. El código integra
RevenueCat para la compra y restauración; la disponibilidad, precio localizado,
producto final y pruebas sandbox/producción se confirman antes del envío. No
hay que describir una compra como disponible hasta que #37 la haya validado en
un dispositivo real.

### Acceso para revisión

La build actual requiere autenticación. Ingresar en el portal de la tienda una
cuenta de revisión controlada por el titular:

- Correo de prueba: `[proporcionar en App Store Connect / Play Console]`
- Método/código de acceso: `[proporcionar fuera de git]`
- Instrucciones de compra sandbox, si aplican: `[proporcionar en el portal]`

No incluir en las notas contraseñas, claves API ni datos personales reales.

## English

### App purpose

Bible AI Honduras is a Christian devotional app for personal reading and
reflection. It has an evangelical/Protestant focus and includes a daily
devotional, questions about Bible passages, conversations with human biblical
characters, devotionals based on how a person feels, and illustrated biblical
stories.

### AI and religious content

- Some answers and devotionals are generated with AI. The product is designed
  to ground them in Bible passages and show references; they are not presented
  as religious authority or standalone advice.
- OpenAI retrieves semantic context and generates illustrations from editorial
  prompts; Anthropic generates text. Conversations are not used as image prompts.
- Biblical-story illustrations are AI-generated and are identified as such in
  the store materials.
- The app does not allow a model to portray or impersonate God, Jesus, or the
  Holy Spirit. First-person conversations are limited to human biblical
  characters.
- The app supports personal reading. It is not a substitute for pastoral,
  medical, mental-health, emergency, or crisis care. AI output can be wrong.

### Privacy and account

The app uses Clerk authentication and stores the minimum profile information,
preferences, and conversation history required for its features. Conversation
history is private to the account and the app exposes a way to delete it. The
Bible AI Honduras does not train its own models with that history. The published
policy explains each AI provider's separate data handling:
`https://luiscf1226.github.io/bible-ai-honduras/privacidad/`.

### Exact in-app account-deletion path (guideline 5.1.1(v))

Account deletion is fully in-app; the reviewer never leaves the app.

**Sign out:** `Ajustes (Settings) → Cuenta (Account) → Cerrar sesión (Sign out)
→ confirm`. The app returns to the welcome screen and the next launch asks for
login again.

**Delete account:** `Ajustes (Settings) → Cuenta (Account) → Eliminar mi cuenta
(Delete my account) → Continuar (Continue) → type ELIMINAR → Eliminar mi cuenta
para siempre (Delete my account forever)`.

1. Sign in with the review account.
2. Tap the ⚙ gear icon at the top right of the Home screen to open **Ajustes**
   (Settings).
3. Scroll to the **Cuenta** (Account) section — it is the last section.
4. Tap **Eliminar mi cuenta** (red row).
5. Confirmation step 1: the dialog lists what is deleted, states that it cannot
   be undone, and states that **deleting the account does not cancel the store
   subscription** (that is done in App Store / Google Play). Tap **Continuar**.
6. Confirmation step 2: type the word **ELIMINAR** and tap **Eliminar mi cuenta
   para siempre**.
7. Deletion cascades and is permanent: profile row, conversations and messages,
   usage counters, in-app plan row, stories and their generated image files (the
   blobs, not just the references), plus the Clerk identity user. The app then
   signs out, cancels the scheduled daily reminder, and returns to the welcome
   screen. Signing up again with the same email creates a clean account.

The Google Play web form
(`https://luiscf1226.github.io/bible-ai-honduras/eliminar-cuenta/`) still
exists, but it is not needed for App Store review: the in-app flow is complete.

### Suggested review path

1. Sign in with the review account.
2. Open **Preguntar**, ask about a passage, and verify the visible citation.
3. Open **Voces**, select a human biblical character, and try “hablá como
   Dios”; the app must refuse divine impersonation.
4. Open **Sentir** and generate a devotional from a feeling.
5. Open **Historias** to see the AI-illustrated biblical story.
6. Open **Ajustes → Privacidad** to view the policy and hard-delete history.
7. Open **Ajustes → Cuenta** to see the signed-in email, **Cerrar sesión**
   (sign out), and **Eliminar mi cuenta** (delete account, two-step
   confirmation). Full path in "Exact in-app account-deletion path" above.

### Purchases

The app offers a Pro plan through in-app purchases. The code integrates
RevenueCat for purchase and restoration; final availability, localized price,
store product, and sandbox/production testing must be confirmed before
submission. Do not state that a purchase is available until #37 has verified it
on a real device.

### Review access

The current build requires authentication. Provide a review account in the
store portal, not in this repository:

- Test email: `[provide in App Store Connect / Play Console]`
- Access method/code: `[provide outside git]`
- Sandbox-purchase instructions, if applicable: `[provide in the portal]`
