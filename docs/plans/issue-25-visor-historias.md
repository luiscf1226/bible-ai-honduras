# Sub-plan / baton — Issue #25: Visor de historia ilustrada

## Alcance aprobado

- Tipo: **create**.
- Reemplazar el marcador de Historias con el catálogo navegable definido en el prototipo.
- Construir la ruta de visor con un panel por escena del contrato `stories.getById`.
- Cada panel presenta su texto y una ranura de imagen que muestra una URI generada sólo cuando el contrato la recibe; sin URI informa con claridad si está generando o no está disponible.

## Fuera de alcance

- Generar, guardar o pedir imágenes; cuota/muestra/pago (#24); historial; compartir (#26); cambios de esquema o archivos `convex/_generated`.

## Criterios de terminado

- Una historia del catálogo abre el visor y muestra todos sus paneles ordenados.
- Cada escena muestra su narración y el estado honesto de su imagen generada.
- La UI usa exclusivamente los tokens existentes y corresponde a la pantalla de Historias del prototipo.
- Typecheck, tests y export de Expo en verde.

## Progreso

- [x] Issue, catálogo #23, mapa del proyecto y pantalla del prototipo revisados.
- [x] Definir contrato de lectura del catálogo y estados de imagen del visor.
- [x] Implementar catálogo navegable y paneles del visor.
- [x] Validar, revisar diff y crear commit separado.

## Estado

**Completo.** El visor no declara una ilustración lista sin una URI generada; #24 y #26 permanecen fuera del cambio.

## Evidencia / siguiente paso

- El prototipo muestra tarjetas de catálogo que abren una historia y paneles con imagen + texto; su CTA de compartir se excluye por #26.
- Validación final: `npm test` pasa (19/19), `npm run typecheck` pasa y `CI=1 npm run export` compila el bundle web de Expo.
- Siguiente: commit separado de #25; el dueño del track puede continuar al flujo de PR cuando corresponda.
