# Notas para revisión de tiendas / Store review notes

**Estado:** texto de envío preparado desde el repositorio. Reemplazar los
campos entre corchetes al crear la entrega. No pegar credenciales en git.

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
- Las ilustraciones de las historias bíblicas se generan por IA y se deben
  identificar como tales en el producto y en los materiales de tienda.
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
repositorio especifica que ese historial no se usa para entrenar modelos de IA
de terceros. La URL de la política de privacidad publicada será:
`[URL HTTPS de la política publicada]`.

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
- Biblical-story illustrations are AI-generated and should be labelled as such
  in the product and store materials.
- The app does not allow a model to portray or impersonate God, Jesus, or the
  Holy Spirit. First-person conversations are limited to human biblical
  characters.
- The app supports personal reading. It is not a substitute for pastoral,
  medical, mental-health, emergency, or crisis care. AI output can be wrong.

### Privacy and account

The app uses Clerk authentication and stores the minimum profile information,
preferences, and conversation history required for its features. Conversation
history is private to the account and the app exposes a way to delete it. The
repository specifies that this history is not used to train third-party AI
models. Published privacy-policy URL:
`[published HTTPS privacy-policy URL]`.

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
