# Sub-plan / baton — Issue #26: Compartir historia ilustrada

## Alcance aprobado

- Tipo: **modify**.
- Agregar al visor existente el botón de compartir definido en el prototipo.
- Construir el texto a partir de la historia actual y delegar la apertura del share sheet y el link con referido exclusivamente en `src/lib/share.ts`.
- Usar el `referralCode` del usuario autenticado cuando esté disponible.

## Fuera de alcance

- Servicio alterno de WhatsApp, compartir binarios/imágenes, generación, persistencia, cuota/muestra/pago (#24), historial, backend nuevo y archivos `convex/_generated`.

## Criterios de terminado

- El visor ofrece la acción de compartir, con el estilo y copy del prototipo.
- El mensaje incluye título, referencia y número real de escenas de la historia, más el link referido emitido por el servicio compartido.
- La acción se deshabilita mientras no haya un código de referido y reporta un fallo recuperable.
- Pruebas enfocadas, typecheck, tests y export pasan.

## Progreso

- [x] Issue, contrato visual, servicio compartido y visor #25 revisados.
- [x] Añadir formateo puro del contenido de la historia y prueba.
- [x] Conectar la acción al share sheet compartido dentro del visor.
- [x] Validar, revisar diff y crear commit separado.

## Estado

**Completo.** La pantalla delega la compartición a `src/lib/share.ts`; no incluye lógica local de links, APIs nativas, generación ni cuota.

## Evidencia / siguiente paso

- El servicio dueño de compartir recibe `{ text, referralCode }` y genera el link; no se duplicará su lógica ni se añadirá acceso nativo local.
- Validación final: `npm test` pasa (35/35), `npm run typecheck` pasa y `CI=1 npm run export` compila el bundle web de Expo.
- Siguiente: commit separado de #26; el dueño del track puede continuar con el flujo de PR cuando corresponda.
