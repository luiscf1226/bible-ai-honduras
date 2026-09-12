# Manifiesto de capturas de tienda

**Estado:** plantilla de ejecución. **No hay PNG de tienda en este
repositorio** (no se inventan capturas). Bloqueado por build estable en
dispositivo (#37 E2E / #101 TestFlight–Play Internal) e ícono/splash de
producción (#102).

## Precondiciones

1. Usar una build candidata en un dispositivo físico de cada plataforma, no
   Expo Go ni una captura del navegador. El ícono visible en springboard /
   launcher debe ser el de #102, no el default de Expo.
   **Hoy ese ícono todavía es provisional** (ver "Ícono y splash" abajo): no
   tomar capturas de tienda hasta que llegue el arte definitivo.
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

## Ícono y splash

`app.json` ya declara `expo.icon`, `expo.android.adaptiveIcon`, `expo.web.favicon`
y el `backgroundColor` del splash con el token `bg` (`#E9E1D5` en
`design/tokens.json`). Los PNG viven en `assets/`:

| Archivo | Tamaño | Alfa | Destino |
| --- | --- | --- | --- |
| `assets/icon.png` | 1024×1024 | **no** | Ícono de App Store y Play; el mismo que se sube como ícono de ficha |
| `assets/adaptive-icon.png` | 1024×1024 | sí | Foreground adaptativo de Android |
| `assets/splash-icon.png` | 1024×1024 | sí | Splash |
| `assets/favicon.png` | 48×48 | sí | Web |

**Estos archivos son provisionales.** `design/logo.png` mide 232×232, muy por
debajo de los 1024×1024 que exigen las tiendas, y ya trae las esquinas
redondeadas dibujadas en el arte. No se amplió: el logo va a resolución nativa
centrado en el lienzo, así que el ícono se ve claramente como un placeholder.

Antes de subir la ficha hace falta:

- el arte definitivo de ícono en **1024×1024 o vectorial**, cuadrado a sangre,
  sin redondeo ni canal alfa (detalle y regeneración en `assets/README.md`);
- instalar `expo-splash-screen`, porque en Expo SDK 57 la clave raíz
  `expo.splash` quedó inerte y el splash nativo lo aplica ese config plugin.

El ícono que se suba al portal debe ser byte por byte el mismo `assets/icon.png`
de la build capturada, para que la ficha y el springboard no se contradigan.

## Destinos y nomenclatura

Guardar los PNG finales **fuera de git**, en el repositorio seguro de
materiales de release, con estos nombres:

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
| `{{platform}}-cuenta-{{locale}}-{{build}}.png` | Ajustes > Cuenta | Correo, **Cerrar sesión** y **Eliminar mi cuenta** | Afirmar que falta borrado in-app (guideline 5.1.1(v)) |

## Secuencia de evidencia para #37 / #101

Para cada plataforma, registrar junto a las imágenes:

- modelo y versión de SO del dispositivo;
- identificador de build y commit probado;
- fecha, zona horaria y persona que ejecutó la prueba;
- resultado del onboarding, de los cinco módulos, de borrar historial, de
  cerrar sesión / eliminar cuenta (#107), de compra/restore sandbox y de la
  navegación a la política publicada;
- defectos o divergencias entre la imagen y la build.

Una captura solo se marca como aprobada cuando coinciden la imagen, la build y
el comportamiento en el dispositivo. Conservar los originales sin edición y
usar versiones recortadas únicamente si el portal lo exige.
