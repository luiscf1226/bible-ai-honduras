# Fuente de devocionales diarios

El catálogo de lanzamiento vive en `convex/devotionalCatalog.ts`. Contiene 28 entradas curadas, suficientes para las primeras cuatro semanas; el backend las recorre de manera determinística por fecha y el cron mantiene persistida una ventana de 28 días.

Cada entrada contiene la referencia del versículo, una reflexión pastoral breve y una imagen de naturaleza. El texto bíblico se resuelve desde la fuente RVR1960 autorizada del producto; no se duplica aquí para respetar la licencia de la versión.

Las imágenes son enlaces de Unsplash con URL de atribución por registro. Antes de producción, reemplazarlas por activos licenciados y congelados en almacenamiento propio para evitar dependencia de enlaces externos.

## Operación

- `devotional.today` toma la fecha en `America/Tegucigalpa` y funciona incluso antes de la primera ejecución del cron, gracias al fallback al catálogo.
- A las 00:05 de Honduras (`06:05 UTC`), `devotional.ensureWindow` llena los siguientes 28 días de manera idempotente.
- No hay una mutación pública de siembra: el cliente solo puede leer contenido editorial público.
