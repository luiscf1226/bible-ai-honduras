# Assets de icono y splash

> **Estado: PROVISIONAL. No publicar la beta con estos archivos.**
> Los PNG de esta carpeta cumplen los requisitos *técnicos* de App Store y Play
> (tamaño, canal alfa), pero **no son arte de tienda**. Ver
> "Qué arte falta" abajo. Issue #102, bloquea #101.

## Por qué son provisionales

El único arte del repositorio es `design/logo.png` y mide **232×232 px**. App Store
y Google Play exigen **1024×1024 px**. Ampliar 232 → 1024 es un escalado de 4.4×:
produce un icono borroso que además se ve mal al lado de cualquier otra app en el
springboard. Por eso **no se escaló**.

En lugar de eso, `assets/generate-icons.py` compone el logo **a su resolución
nativa (232 px) centrado en un lienzo de 1024×1024**. El resultado es técnicamente
válido y obviamente provisional: el logo ocupa el 23% del icono y el resto es el
color de fondo. Es intencional — tiene que verse como un placeholder para que
nadie lo publique por descuido.

`design/logo.png` tampoco sirve como fuente aunque tuviera el tamaño: ya trae las
**esquinas redondeadas y el marco del icono dibujados dentro del arte**. iOS aplica
su propia máscara, así que un icono con esquinas ya redondeadas sale con doble
borde. El arte definitivo tiene que ser **cuadrado a sangre completa, sin
redondeo**.

## Qué arte falta

Decisión del dueño del producto, no del equipo de desarrollo. Regla dura #1: sale
de Claude Design, no se improvisa en el editor.

| Entregable | Tamaño | Requisitos |
| --- | --- | --- |
| Icono maestro | **1024×1024 px** (o vectorial) | Cuadrado a sangre, **sin esquinas redondeadas**, **sin canal alfa**, sin sombra exterior |
| Foreground adaptativo Android | **1024×1024 px** con alfa | Todo el contenido legible dentro de la **zona segura del 66%** (círculo central de 676 px); el resto se recorta |
| Icono de splash | **1024×1024 px** con alfa | Solo la marca, sin fondo: el fondo lo pone `backgroundColor` |

Con esos tres archivos, regenerar todo:

```sh
python3 assets/generate-icons.py
```

Ajustar `SOURCE` en el script si el arte definitivo no reemplaza a `design/logo.png`.

## Archivos generados

| Archivo | Tamaño | Alfa | Usado por |
| --- | --- | --- | --- |
| `icon.png` | 1024×1024 | **no** | `expo.icon` (iOS + Android) |
| `adaptive-icon.png` | 1024×1024 | sí | `expo.android.adaptiveIcon.foregroundImage` |
| `splash-icon.png` | 1024×1024 | sí | `expo.splash.image` / `expo.web.splash.image` |
| `favicon.png` | 48×48 | sí | `expo.web.favicon` |

`icon.png` va sin canal alfa a propósito: App Store Connect rechaza la subida si
el icono tiene transparencia. Verificación:

```sh
sips -g pixelWidth -g pixelHeight -g hasAlpha assets/icon.png
#   pixelWidth: 1024
#   pixelHeight: 1024
#   hasAlpha: no
```

## Colores

`backgroundColor` del splash y del adaptive icon es `#E9E1D5`, que es el token
**`bg`** del tema claro en `design/tokens.json`. No es un hex elegido a mano
(regla dura #1). Si el token cambia, hay que actualizar `app.json` y este archivo.

## Pendiente conocido: el splash nativo todavía no se aplica

En **Expo SDK 57 la clave raíz `expo.splash` quedó inerte**. No aparece en el
esquema de `@expo/config-types` (ahí `splash` solo existe dentro de `web`, para
PWA) y no la lee ningún plugin de `@expo/prebuild-config`, `@expo/config-plugins`
ni `@expo/cli`. El splash nativo pasó a ser propiedad del config plugin del
paquete **`expo-splash-screen`**, que **no está instalado** en este proyecto (no
está en `package.json` ni en `package-lock.json`, y tampoco es dependencia
transitiva de `expo`).

Consecuencia: `expo.splash` en `app.json` documenta la intención y deja los
valores correctos listos para copiar, pero **iOS y Android siguen sin splash de
marca**. `expo.web.splash` sí funciona, porque es la ubicación válida del esquema.

Para cerrarlo hace falta un cambio en `package.json`, fuera del alcance de #102:

```sh
npx expo install expo-splash-screen
```

```json
[
  "expo-splash-screen",
  {
    "image": "./assets/splash-icon.png",
    "resizeMode": "contain",
    "backgroundColor": "#E9E1D5",
    "imageWidth": 200
  }
]
```

El icono (`expo.icon`) y el adaptive icon **sí** se aplican hoy: los resuelven
`withIosIcons`, `withAndroidIcons` y `withAndroidManifestIcons` de
`@expo/prebuild-config`, que están presentes en SDK 57.
