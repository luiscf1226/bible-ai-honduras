# Cita tocable (#192) y una conversación por tema (#191)

Capturas del harness de QA (`QA_HARNESS=1`, 390×844 @2x).

| Pantalla | Antes | Después |
|---|---|---|
| Preguntar (`/preguntar/chat?conversationId=qa-seed`) | `before-preguntar.png` | `after-preguntar.png` |
| Sentir, resultado del devocional | `before-sentir.png` | `after-sentir.png` |

- Visualmente idénticas. Único cambio: en Preguntar la cita pasa de
  `Salmos 46:1 (RV1909)` a `Salmos 46:1 · RV1909`, el mismo formato que ya usaba
  Sentir (`formatCitation`, #192).
- `after-tap.png`: tocar la cita en Preguntar abre `/leer/Salmos/46?verse=1`
  con la hoja del versículo abierta.
- El aviso rojo "Convex functions should not be imported in the browser" es
  del harness en dev y ya aparecía en `master`; no es de este cambio.
