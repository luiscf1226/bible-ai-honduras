# QA — Paywall con precio real (#144), Escuchar el capítulo (#157) y Dedicar (#202)

Harness web (`QA_HARNESS=1 EXPO_PUBLIC_REVENUECAT_API_KEY=qa_harness`), 390×844 @2x,
zona `America/Tegucigalpa`. "Antes" = `master` en `ac27190`.

**Paywall (#144)** — escenarios nuevos `?rc=` y `?precio=` (ver `qa-harness/README.md`).
- `antes-paywall-precio-escrito.png`: `$4.99` escrito a mano.
- `paywall-precio-de-la-tienda.png` / `paywall-precio-localizado-lempiras.png`: el
  precio sale de `product.priceString` (`US$4.99`, `L 124.00`).
- `paywall-terminos-y-renovacion.png`: duración, renovación automática con el
  precio de la tienda, Restaurar compras, Términos y Privacidad.
- `paywall-sin-red.png`, `paywall-sin-offering.png`: sin precio ni CTA, con aviso y
  "Intentar de nuevo". `paywall-compra-falla-sin-red.png`: la compra falla sin
  desbloquear Pro.

**Escuchar (#157)** — Chromium headless no trae voces: el script reemplaza
`speechSynthesis.speak` por uno que "habla" sin terminar, para fotografiar el control.
- `antes-lector.png` → `lector-boton-escuchar.png`: botón de auriculares junto a "Aa".
- `lector-escuchando.png`, `lector-en-pausa.png`, `lector-escuchando-noche.png`.
- `antes-lector-hoja.png` → `lector-hoja-escuchar-y-dedicar.png`: acciones Dedicar y Escuchar.
- `lector-escuchando-desde-v3.png`: desde el versículo tocado, marcado en la página.

**Dedicar (#202)**
- `antes-hoy-acciones.png` → `hoy-fila-dedicar.png`.
- `dedicar-vacio.png`, `dedicar-clasica-9x16.png`, `dedicar-noche-cuadrada.png`,
  `dedicar-cumpleanos-cuadrada.png`, `dedicar-temporada-adviento.png` (`?temporada=adviento`).
- `dedicar-nombre-y-dedicatoria-largos.png`: nombre (28) y dedicatoria (90) al tope.
- `imagen-dedicada-9x16.png`, `imagen-dedicada-cuadrada.png`: la vista previa, que es
  la misma imagen que se captura para WhatsApp.

El texto del lector es el placeholder del harness. El aviso de dev de Convex se ocultó
con CSS en las capturas (es del harness, ya salía en `master`).
