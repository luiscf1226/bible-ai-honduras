# Inicio compacto (U1b) — todo en una pantalla

Capturas del QA harness (`QA_HARNESS=1 npx expo start --web`), a 2×. El alto es
el útil de cada teléfono (pantalla menos barra de estado y gesto/navegación):

| Captura | Viewport | Scroll |
|---|---|---|
| `antes-iphone-390x763.png` | iPhone 12–15, antes | sí: solo entran el versículo y Leer |
| `despues-iphone-390x763.png` | iPhone 12–15 | no |
| `despues-oscuro-temporada-390x763.png` | iPhone 12–15, noche + Mes de la Reforma | no |
| `despues-android-360x728.png` | Android 360 × 800 | no |
| `despues-android-temporada-360x728.png` | Android 360 × 800 + temporada | no |
| `despues-iphone-se-375x647.png` | iPhone SE | sí, ~30 pt (respaldo) |

El toast rojo de desarrollo ("Convex functions should not be imported…") se
escondió en las capturas: es un aviso de dev que ya existía y no sale en un build.
