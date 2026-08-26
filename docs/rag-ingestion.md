# Ingesta y reindexado del RAG

El repositorio no distribuye el texto completo de RVR1960 ni comentarios de terceros. Ambos deben obtenerse por una vía autorizada y revisarse con el titular de derechos antes de copiarlos al proyecto o a Convex. El archivo local usado para la carga no debe agregarse a git.

## Formato

Versículos: un arreglo JSON de 31.102 objetos `{ "book", "chapter", "verse", "text" }`. Comentarios: un arreglo de objetos `{ "source", "book", "chapter", "text" }`. También se acepta un objeto con una llave `verses` o `commentaries`.

## Carga

1. Configurar el deployment de Convex y `OPENAI_API_KEY` en ese deployment.
2. Validar sin enviar datos:

   `npm run rag:ingest -- --kind verses --file /ruta/licenciada/rvr1960.json --dry-run`

3. Reindexar todo el corpus (desarrollo por defecto; agregar `--prod` para producción):

   `npm run rag:ingest -- --kind verses --file /ruta/licenciada/rvr1960.json --batch-size 64`

4. Si una ejecución se interrumpe, reanudar desde el número de lote mostrado:

   `npm run rag:ingest -- --kind verses --file /ruta/licenciada/rvr1960.json --start-batch 120`

La acción hace upsert por referencia, así que volver a ejecutar un lote no duplica filas. OpenAI recibe los textos del lote en una sola solicitud y la salida final informa filas, tokens, segundos y costo estimado. La estimación usa USD 0,02 por millón de tokens, tarifa publicada para `text-embedding-3-small` al 25-08-2026; confirmar la tarifa vigente antes de presupuestar.

Los vectores de Voyage y OpenAI no son comparables. La migración solo termina cuando se reingresan **todos** los versículos y comentarios del deployment; no debe mezclarse un índice parcialmente migrado con consultas de OpenAI.

## Comentarios evangélicos

Usar el mismo flujo con `--kind commentaries`. Registrar en un documento separado la obra, edición, idioma, fuente, licencia y atribución exigida. No asumir que una obra en dominio público en inglés conserva ese estado en una traducción española moderna.

## Evaluación de recuperación

Después de la carga completa:

`npm run rag:evaluate -- --prod`

El set de `docs/rag-evaluation-questions.json` no copia el fixture y calcula recall@3 sobre cinco capítulos esperados. Guardar el resultado en el issue #93. OpenAI no ofrece el `input_type: document/query` que usaba Voyage; este benchmark es el criterio mínimo para detectar una degradación por esa pérdida. Antes de ampliar la beta se recomienda conservar un baseline de Voyage y comparar los mismos casos, umbral y corpus.
