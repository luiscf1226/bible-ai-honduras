# Sub-plan / baton — Issue #23: Catálogo de historias bíblicas

## Alcance aprobado

- Tipo: **create**.
- Crear un catálogo Convex de al menos cinco historias bíblicas, con tres o más escenas ordenadas por historia y prompts listos para el proveedor de imágenes elegido en #22.
- Exponer una consulta de sólo lectura para listar el catálogo y otra para obtener una historia por su identificador.
- Agregar pruebas de invariantes del contenido y del contrato público.

## Fuera de alcance

- Cuota de muestra (#24), generación/almacenamiento de imágenes y visor (#25), compartir (#26), historial, estado Pro, UI o cambios a tokens/esquema.

## Criterios de terminado

- Cinco historias, cada una con al menos tres escenas completas, referencias bíblicas y prompt de generación.
- API devuelve catálogo estable y búsqueda por `storyId`; identifica id desconocido como `null`.
- Pruebas enfocadas, typecheck y suite completa en verde.

## Progreso

- [x] Contexto, PRD, issue y decisión del proveedor #22 revisados.
- [x] Mapa operativo `.agentic/project.md` creado y comandos base verificados.
- [x] Crear catálogo y API Convex.
- [x] Agregar pruebas de contrato e invariantes.
- [x] Ejecutar validación completa, revisar diff y preparar commit.

## Estado

**Completo.** Commit creado: `feat(stories): agrega catálogo bíblico por escenas`.

## Evidencia / siguiente paso

- Base verificada: `npm test` (13/13), `npm run typecheck` y `npm run export` pasan.
- Validación final: `npm test` pasa (17/17), `npm run typecheck` pasa y `CI=1 npm run export` compila el bundle web de Expo.
- Convex codegen queda pendiente de configurar `CONVEX_DEPLOYMENT`; no se modificaron archivos bajo `convex/_generated/`.
- Siguiente: el dueño del track puede abrir el PR y ejecutar la compuerta `pr-no-mistakes`; no hay cambio de UI ni captura requerida.
