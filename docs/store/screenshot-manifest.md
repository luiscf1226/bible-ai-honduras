# Manifiesto de capturas de tienda

**Estado:** plantilla de ejecución. No hay capturas E2E adjuntas mientras #37
esté abierto.

## Precondiciones

1. Usar una build candidata en un dispositivo físico de cada plataforma, no
   Expo Go ni una captura del navegador.
2. Completar el flujo de email/Clerk con una cuenta de prueba controlada por el
   responsable de la tienda. No incluir credenciales en este repositorio ni en
   las imágenes.
3. Cargar contenido de prueba permitido y verificar que cada pantalla muestra
   texto en español, sin errores, datos personales ni identificadores de
   pruebas.
4. Si se muestra el paywall, usar la configuración sandbox correspondiente.
   No presentar una compra de prueba como una compra de producción.
5. Ocultar notificaciones del sistema, barras con datos personales y cualquier
   correo/código de autenticación antes de tomar la captura.

## Destinos y nomenclatura

Guardar los PNG finales fuera de git, en el repositorio seguro de materiales de
release, con estos nombres:

| Destino | Prefijo | Dispositivos a validar |
| --- | --- | --- |
| App Store | `ios-` | iPhone; iPad porque `app.json` declara `supportsTablet: true` |
| Google Play | `android-` | teléfono Android |

Usar `{{build}}` para la versión de la build y `{{locale}}` para el idioma, por
ejemplo `ios-home-es-0.1.0.png`. La persona que publica debe verificar en los
portales vigentes las dimensiones, cantidad y formato exigidos antes de subir:
esos requisitos son externos al repositorio y cambian con el tiempo.

## Capturas requeridas

| Archivo base | Pantalla / estado | Qué debe verse | Riesgo que evita |
| --- | --- | --- | --- |
| `{{platform}}-home-{{locale}}-{{build}}.png` | Inicio con versículo y devocional del día | Lectura tranquila, módulos y recordatorio diario | Que la ficha parezca solo un chat genérico |
| `{{platform}}-preguntar-{{locale}}-{{build}}.png` | Preguntar, con libro/capítulo/versículo elegido | Pregunta anclada a un pasaje bíblico | Consejo libre sin fuente |
| `{{platform}}-respuesta-{{locale}}-{{build}}.png` | Respuesta de Preguntar | Referencia/cita bíblica y copy de acompañamiento | Ocultar el carácter generado por IA |
| `{{platform}}-voces-{{locale}}-{{build}}.png` | Catálogo de personajes | Solo personajes humanos, si están disponibles | Confusión con una suplantación de Dios, Jesús o el Espíritu Santo |
| `{{platform}}-sentir-{{locale}}-{{build}}.png` | Selector de sentimiento o devocional resultante | Reflexión, versículo y límite de acompañamiento | Confundirlo con atención médica o de crisis |
| `{{platform}}-historias-{{locale}}-{{build}}.png` | Catálogo o visor de historia ilustrada | Escena bíblica, referencia y atribución de ilustración generada | No revelar que la imagen es generada por IA |
| `{{platform}}-pro-{{locale}}-{{build}}.png` | Paywall/plan Pro, si compra verificada | Beneficios, precio localizado y restauración | Afirmar precio o compra sin configuración final |
| `{{platform}}-privacidad-{{locale}}-{{build}}.png` | Ajustes > Privacidad | Mensaje de privacidad y borrado de historial | Contradecir la política publicada |

## Secuencia de evidencia para #37

Para cada plataforma, registrar junto a las imágenes:

- modelo y versión de SO del dispositivo;
- identificador de build y commit probado;
- fecha, zona horaria y persona que ejecutó la prueba;
- resultado del onboarding, de los cinco módulos, de borrar historial, de
  compra/restore sandbox y de la navegación a la política publicada;
- defectos o divergencias entre la imagen y la build.

Una captura solo se marca como aprobada cuando coinciden la imagen, la build y
el comportamiento en el dispositivo. Conservar los originales sin edición y
usar versiones recortadas únicamente si el portal lo exige.
