# Spike #22 — proveedor de generación de imágenes

**Estado:** listo para ejecutar con credenciales de backend.  
**Fecha de precios consultados:** 2026-08-19. Los precios y modelos cambian; volver a comprobar las fuentes antes de producción.

## Decisión propuesta

Adoptar **OpenAI `gpt-image-1.5`, 1024×1024, calidad `medium`** para el MVP de Historias ilustradas, detrás de un adaptador de Convex, sujeto a la corrida de validación. Es la opción de referencia por consistencia visual e instrucción detallada; el costo de lista de **USD 0.034 por imagen** es prácticamente igual al candidato de menor costo de lista, por lo que no justifica sacrificar calidad en una función Pro.

No se debe incorporar todavía una clave ni una llamada desde Expo: `ARCHITECTURE.md` exige que la clave viva sólo en una Convex action. El issue #25 debe implementar ese adaptador y almacenar los binarios en Convex Storage.

**Condición de cierre:** ejecutar el benchmark con ambas claves y completar la rúbrica de calidad de abajo. Si Gemini obtiene una media de calidad a no más de 0.5 puntos de OpenAI y su p95 de latencia es menor, se cambia la decisión a Gemini antes de #25.

## Candidatos comparados

Se compara una imagen cuadrada de 1K, adecuada para una escena individual del libro ilustrado. El costo de la entrada de texto es marginal y se reporta separadamente por los proveedores; las cifras siguientes representan la salida de imagen.

| Proveedor / modelo | Costo de lista por imagen | Latencia | Calidad esperada / riesgo | Veredicto |
| --- | ---: | --- | --- | --- |
| OpenAI `gpt-image-1.5`, `medium` | USD 0.034 | Se mide con p50/p95 en el script | Mejor adherencia a instrucciones según la ficha del modelo; ofrece formato PNG y API de imágenes dedicada. | **Recomendado** |
| Google `gemini-3.1-flash-lite-image`, 1K | USD 0.0336 | Se mide con p50/p95 en el script | Modelo optimizado por Google para costo y latencia; se mantiene como alternativa de ahorro y contingencia. | Alternativa |

Fuentes primarias:

- OpenAI lista USD 0.034 para 1024×1024 en calidad media y expone `v1/images/generations`: [modelo GPT Image 1.5](https://developers.openai.com/api/docs/models/gpt-image-1.5).
- Google publica USD 0.0336 para una salida 1K de Flash Lite Image y lo posiciona para costo/latencia: [precios de Gemini API](https://ai.google.dev/gemini-api/docs/pricing).
- La llamada REST de Gemini usada por el benchmark (`v1beta/interactions`) y sus campos de respuesta están documentados aquí: [generación de imágenes de Gemini](https://ai.google.dev/gemini-api/docs/image-generation).

## Impacto económico

El costo incremental de una imagen del proveedor recomendado es USD 0.034. Como referencia, a 10, 30 y 100 imágenes por suscriptor Pro/mes equivale a USD 0.34, USD 1.02 y USD 3.40 respectivamente, antes de comisiones de la tienda y del resto de infraestructura. El producto debe fijar controles de abuso y límites razonables aunque Pro diga “ilimitado”; ese control pertenece al servicio de cuotas transversal, no al cliente.

## Benchmark reproducible

El script no requiere dependencias nuevas y nunca escribe claves. Genera tres escenas bíblicas con el mismo prompt de arte, tres veces por proveedor por defecto (18 solicitudes); mide latencia de pared, escribe muestras PNG locales y guarda un JSON con p50/p95, fallos y costo estimado.

```sh
# No genera imágenes ni cobra; comprueba configuración y plan de solicitudes.
npm run spike:images -- --dry-run

# Requiere claves de prueba con facturación. No usar claves de Expo.
OPENAI_API_KEY=... GEMINI_API_KEY=... npm run spike:images
```

Para reducir la corrida inicial a dos solicitudes:

```sh
OPENAI_API_KEY=... GEMINI_API_KEY=... npm run spike:images -- --runs=1
```

El informe se escribe en `docs/spikes/results/image-provider-benchmark.json` y las muestras en `docs/spikes/results/images/`; ambos están ignorados para que una clave, una respuesta o arte de prueba no llegue al repositorio por accidente. Copiar al PR únicamente el resumen agregado y las puntuaciones de calidad.

## Rúbrica de calidad

Dos revisores puntúan de 0 a 5 cada muestra de forma independiente. Se promedia primero por escena y después por proveedor.

| Criterio | 0 | 5 |
| --- | --- | --- |
| Fidelidad narrativa | No representa el pasaje/prompt | Personajes, acción y época coinciden claramente |
| Coherencia visual | Anatomía, manos o composición fallan | Anatomía natural y composición de libro ilustrado |
| Dirección de arte | Ignora el estilo o incluye texto | Acuarela serena, cálida, sin texto ni anacronismos |
| Seguridad cultural | Estereotipos graves u ofensa | Representación respetuosa y apta para audiencia familiar |

Una muestra con texto legible no solicitado, anacronismos importantes o una representación irrespetuosa se marca además como incidencia. Cualquier proveedor con una incidencia no se adopta sin corregir prompt/guardrails y repetir el escenario.

## Resultado pendiente de credenciales

Este worktree no contiene `OPENAI_API_KEY` ni `GEMINI_API_KEY`, por lo que no se ejecutó una llamada que pueda generar un cargo. No se inventan métricas de latencia o calidad: el reporte generado por el comando anterior es la evidencia que completa el criterio de “medidos”.

Al registrar el resultado de la corrida, añadir una tabla como esta al PR:

| Proveedor | Muestras OK | p50 | p95 | Costo estimado | Calidad media | Incidencias |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| OpenAI |  |  |  |  |  |  |
| Gemini |  |  |  |  |  |  |
