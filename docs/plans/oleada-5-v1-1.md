# Oleada 5: v1.1

Revisión del 30 de septiembre de 2026 de los dos ítems de la oleada 5:
**#162** (plan en familia o en grupo) y **#151, parte de código** (habilitar RVR1960).
Este documento separa lo que entra en el PR, lo que sigue bloqueado y las ideas nuevas
propuestas como tickets.

---

## 1. Lo que entra en este PR

| Pedido | Qué se hizo |
|---|---|
| #151 — "cargar el texto, agregarlo a `AVAILABLE_BIBLE_VERSIONS` y evaluar" | Los dos scripts del RAG tenían **`RV1909` fijo**: `rag:ingest` cargaba cualquier archivo como RV1909 y `rag:evaluate` solo medía RV1909. Así, el paso "cargar el texto" del issue no se podía hacer. Ahora los dos aceptan `--version RV1909\|RVR1960\|NVI` (RV1909 por defecto, así que nada cambia para el uso actual). Los comentarios rechazan el flag porque no tienen versión. |
| Pasos para habilitar una versión | Sección nueva **"Habilitar una versión nueva (#151)"** en `docs/rag-ingestion.md`: dry-run, carga en dev, evaluación, carga en prod y, **al final**, el cambio de una línea en `AVAILABLE_BIBLE_VERSIONS`. |
| #162 — plan en familia o en grupo | No se construye. Ver §2. |

**No se habilita RVR1960.** No hay licencia ni texto cargado. Si se agrega a
`AVAILABLE_BIBLE_VERSIONS` ahora, quien la elija recibe cero resultados en Preguntar, Voces
y Sentir, que es justo lo que el criterio de aceptación de #151 prohíbe.

No hay cambios de UI en este PR.

---

## 2. Qué sigue bloqueado y qué lo destraba

### #151 — RVR1960
- **Bloqueo:** licencia comercial de Sociedades Bíblicas Unidas, sin resolver desde el
  arranque (PRD §6). Es una decisión legal o de producto, no de código.
- **Cuando llegue:** son unos 30 minutos siguiendo `docs/rag-ingestion.md` § "Habilitar una
  versión nueva".

### #162 — Plan en familia o en grupo
Tiene tres bloqueos, y ninguno se resuelve escribiendo código:
1. **Depende de la comunidad** (PRD §9c), que no existe: no hay grupos ni membresías en
   `convex/` ni en `app/`. El PRD pone tres condiciones para empezarla: usuarios pagando, más
   tiempo o presupuesto y **una decisión de moderación**.
2. **El alcance está "a definir"** en el propio issue.
3. **No hay pantalla en el prototipo.** Por la regla dura #1, se diseña primero en Claude
   Design.

Hay un camino más corto: una versión **sin comunidad**. Es solo para el grupo de la familia
o de la célula, con invitación por WhatsApp y sin contenido escrito por usuarios, así que no
necesita moderación. Ver la idea N1.

---

## 3. Ideas nuevas propuestas como tickets

Ninguna repite lo que ya está abierto (#153, #154, #157–#161). Todas respetan las reglas
duras:
- El contenido bíblico sigue anclado al RAG (#4).
- Los límites pasan por `convex/quotas.ts` y compartir por el componente de #36 (#3).
- Toda pantalla nueva pasa antes por Claude Design (#1).

### N1 — Plan en grupo "cerrado", sin comunidad · *destraba #162*
Un grupo privado de hasta ~15 personas con un plan compartido, al que se entra por enlace de
WhatsApp (componente #36). Solo se ve el avance del plan: no hay chat, publicaciones,
peticiones ni ranking. Como no hay contenido escrito por usuarios, no hace falta moderar y
no choca con PRD §9c.3.
**Código:** tablas `readingGroups` y `readingGroupMembers`, invitación con token, borrado de
cuenta. **Antes:** diseño en Claude Design y aprobar el recorte con el fundador.

### N2 — Decidir cómo se modera lo que escriben los usuarios · *spike, destraba la comunidad*
PRD §9c.3 lo pone como condición para la comunidad completa. El spike define quién
modera, qué se reporta, cómo se bloquea y qué se filtra automáticamente, y cuánto cuesta.
Entrega un documento de decisión, no código.

### N3 — Notas personales en los versículos guardados
Hoy `readingBookmarks` solo guarda la referencia. Se agrega un campo `note` opcional y
privado: "por qué guardé esto" o "lo predicó el pastor el domingo". Va con la misma
privacidad que Sentir y entra en el borrado de cuenta.
**Código:** campo en el schema, mutación, campo de texto en la hoja del versículo y en la
lista de guardados.

### N4 — Referencias cruzadas en el lector
Desde la hoja del versículo: "Pasajes relacionados", con datos del *Treasury of Scripture
Knowledge* (dominio público). No es IA: es un índice fijo, así que la regla #4 no aplica y
no cuesta nada por consulta. Ayuda a quien lee por primera vez a entender un pasaje con otro.
**Antes:** confirmar que el mapeo de libros y capítulos de TSK calza con RV1909.

### N5 — Guía para la célula o la escuela dominical (Pro)
Desde un capítulo del lector: "Preparar para mi grupo". Genera 4 o 5 preguntas de
conversación y un resumen, cada una con su cita del RAG. Es un caso de uso fuerte para
líderes de célula, que también son quienes pueden recomendar la app.
**Antes:** se discute por la regla #4. Se propone que sea una variante de Preguntar con el
mismo pipeline y la misma cuota, no generación libre.

### N6 — Widget del versículo del día (iOS y Android)
El versículo del día en la pantalla de inicio del teléfono, que abre el devocional al
tocarlo. Ayuda a que la gente vuelva cada día sin depender solo de la notificación (#153).
**Código:** config plugin de Expo y un build nativo (no corre en Expo Go). **Antes:** diseño
del widget en Claude Design.

### N7 — Prueba de que toda versión habilitada tiene texto cargado
Un test o cron que falle si una versión de `AVAILABLE_BIBLE_VERSIONS` tiene menos de 31.102
versículos en el deployment. Así se evita repetir el error que motivó #93 §4b: una versión
seleccionable que devuelve cero citas sin avisar.
**Código:** query de conteo por versión y un chequeo en `npm run rag:evaluate`.

### Foco elegido: lo personal (UI/UX) — tickets creados

| Issue | Qué | Depende de |
|---|---|---|
| #166 | Guardados: mostrar el texto del versículo y poder quitarlo desde la lista. Hoy GUARDADOS en Leer solo muestra "Juan 3:16" y crece sin límite. | — |
| #167 | Notas personales en los versículos guardados (N3) | #166 |
| #168 | Lector: subrayar versículos con colores de `design/tokens.json` | — |
| #169 | **Mi espacio**: una sola pantalla con todo lo personal (separador, guardados y notas, subrayados, peticiones #159, memorizar #158, Sentir, conversaciones) | #166, #167, #168 |
| #170 | Widget del versículo del día (N6) | — |
| #171 | Bloquear Mi espacio y Sentir con Face ID, huella o PIN (apagado por defecto) | #169 |
| #172 | Inicio: "Hace un año guardaste…", un guardado viejo una vez por semana | #166, #167 |
| #173 | Exportar mis notas y guardados (texto o PDF) | #166, #167, #169 |
| #174 | Chequeo: toda versión habilitada tiene su texto completo (N7, sin UI) | — |

Todos pasan antes por Claude Design (regla dura #1). Orden: **#174 → #166 → #167 → #168 → #169 →
#171 → #172 → #173**, y #170 en paralelo. N1, N2, N4 y N5 quedan como propuestas sin ticket por ahora.

### Orden sugerido (todas las ideas)
**N7 → N3 → N4 → N6 → N1 → N5**, con N2 en paralelo, porque es solo una decisión.
- N7 y N3 son chicas y no necesitan diseño nuevo (N3 sí necesita el campo en el
  prototipo).
- N1 y N5 requieren decisiones de producto antes de escribir código.
