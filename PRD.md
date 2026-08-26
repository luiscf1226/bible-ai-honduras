# PRD — Bible AI (Honduras)

**Estado:** Borrador post-entrevista (grill-me), listo para pasar a fase de diseño.
**Fecha:** 2026-08-16
**Mercado:** Honduras, consumidor final cristiano evangélico/protestante.

---

## 1. Resumen ejecutivo

App móvil (Expo React Native, iOS + Android) que combina devocional diario, preguntas y respuestas bíblicas ancladas en texto real (RAG), chat en primera persona con personajes bíblicos humanos, y un generador de historias bíblicas ilustradas por IA. Modelo freemium: gratis con límite diario, $4.99/mes (RevenueCat/IAP) para uso ilimitado + generación de imágenes. Meta de lanzamiento: ~1,200 pagos en 8-10 semanas, construido en solitario con agentes de IA.

**Competencia directa nombrada:** YouVersion (gratis, ya establecida, ya incorporando IA). La app no compite en amplitud — compite en profundidad conversacional (Q&A + personajes) y en el generador visual de historias, que YouVersion no ofrece.

---

## 2. Usuario objetivo

- Consumidor individual, no institucional (no se vende a iglesias como cliente B2B).
- Público evangélico/protestante hondureño.
- Descubre la app por redes sociales personales del fundador y grupos de WhatsApp de iglesia (canal orgánico, costo ~$0).

---

## 3. Propuesta de valor (diferenciación vs YouVersion)

| | YouVersion | Bible AI (esta app) |
|---|---|---|
| Devocional diario | Sí, gratis | Sí, gratis (con límite en Q&A) |
| Planes de lectura | Sí | No es foco del MVP |
| Q&A conversacional anclado en texto | Limitado/nuevo | Núcleo del producto |
| Chat en 1ra persona con personajes bíblicos | No | Sí (Pro, límite en free) |
| Generador de historias ilustradas por IA | No | Sí (exclusivo Pro) |
| Precio | Gratis | Freemium, $4.99/mes Pro |

---

## 4. Alcance del MVP (8-10 semanas)

Los 4 módulos se lanzan juntos, con recorte de complejidad dentro de cada uno para caber en el plazo:

1. **Página principal — Devocional diario, progresivo.** Primero solo el versículo del día (card simple, ligera). Al hacer click/tap, se expande al devocional completo: reflexión + imagen (curada/de stock, NO generada por IA — se evita el costo de generación en la pantalla de entrada, que es gratis y de uso diario). No es texto plano de una sola vez — es una experiencia en dos pasos, visual. Push notification. Gratis.
2. **Q&A bíblico guiado (RAG), híbrido.** Flujo principal: el usuario **elige libro → selecciona capítulo/versículo(s) → hace preguntas sobre ese pasaje específico**. También se permite pregunta libre sin seleccionar pasaje primero, para quien solo quiere preguntar directo. La IA responde citando el texto y comentarios verificados en ambos casos. Gratis: 3-5 preguntas/día. Pro: ilimitado.
3. **Chat con personaje bíblico, con avatar.** El usuario **elige de una lista** con qué personaje quiere hablar. 1ra persona, **solo personajes humanos** (Moisés, David, Pablo, Ester, etc.), cada uno con un avatar/ilustración visual propio en el chat. **Excluido explícitamente:** Jesús, Dios, Espíritu Santo — de estos se habla en 3ra persona, nunca se encarnan. Línea de producto dura, no sugerencia de diseño. Gratis: limitado. Pro: ilimitado.
4. **Devocional personalizado por sentimiento/problema o día de la persona.** El usuario indica cómo se siente, qué problema tiene, o cómo estuvo su día (ansiedad, duelo, decisión difícil, gratitud, etc.) y la IA genera un devocional a la medida (versículo + reflexión, ligado al mismo RAG del módulo 2, no opinión libre). **Freemium** — gratis con límite (mismo patrón que el módulo 2), Pro lo desbloquea ilimitado. Mecanismo de retención principal: la razón de que el usuario no necesite abrir otra app cuando algo le pasa, y por lo que vuelve.
5. **Generador de historias bíblicas ilustradas (Pro, con muestra gratis).** Genera imágenes estáticas de una historia bíblica (tipo libro ilustrado). **Solo imágenes en v1, sin video** (queda para v2). Usuarios gratis reciben **un (1) ejemplo generado como muestra** (prueba-antes-de-pagar), no uso ilimitado — controla el costo de generación en el tier gratis mientras sigue funcionando como gancho de conversión a Pro.

### Fuera de alcance para v1 (explícito)
- Generación de video (solo imágenes estáticas en el módulo 5).
- Licencias grupales para iglesias (B2B2C).
- Multi-denominacional configurable (católico, etc.).
- Revisor teológico externo antes de lanzar.
- **Comunidad completa (grupos públicos + feed + descubrimiento) — movida a v1.1.** Decisión explícita: full comunidad es, por sí sola, comparable en esfuerzo a otra app completa; sumada a los 5 módulos de arriba no cabe con calidad en 8-10 semanas con un solo builder. v1 lanza con el mecanismo de compartir por link (sección 9b); comunidad completa se construye como segunda ola una vez validado que hay usuarios pagando y pidiéndola. También reduce, en v1, el riesgo reputacional de un feed público sin moderación ni revisor teológico.

---

## 5. Postura teológica y mitigación de riesgo

- **Tradición doctrinal:** evangélica/protestante genérica. Canon de 66 libros.
- **Modelo de IA:** RAG anclado — la IA no genera opinión teológica libre; responde citando versículos y comentarios de fuentes evangélicas de dominio público/licenciadas (ej. Matthew Henry).
- **Versiones bíblicas soportadas:** RVR1960 y NVI, seleccionables por el usuario. (Nota: verificar licencia de uso de NVI antes de construir — RVR1960 es más seguro en términos de licencia.)
- **Revisión de contenido:** **sin revisor teológico externo.** Mitigación es solo vía system prompt/guías internas + disclaimers en la app ("esto no sustituye consejo pastoral", "la IA puede cometer errores"). **Riesgo aceptado conscientemente** — ver sección de riesgos.
- **Límite duro en personajes:** solo humanos en 1ra persona (ver sección 4, punto 3). Esta regla existe específicamente para evitar el escenario de mayor daño reputacional (percepción de blasfemia).

---

## 6. Modelo de negocio y monetización

### Free vs Pro

| Feature | Gratis | Pro ($4.99/mes) |
|---|---|---|
| Devocional diario (home) | Sí | Sí |
| Q&A bíblico guiado por pasaje | 3-5 preguntas/día | Ilimitado |
| Chat con personajes bíblicos (avatar) | Limitado | Ilimitado |
| Devocional por sentimiento/problema/día | Limitado (mismo patrón que Q&A) | Ilimitado |
| Generador de historias ilustradas | 1 ejemplo (muestra única) | Ilimitado |

### Pagos
- **RevenueCat** sobre IAP nativo de Apple/Google.
- Implica comisión de tienda (15-30%) sobre cada suscripción — factorizar en proyección de ingresos reales (~1,200 pagos brutos ≠ ~1,200 pagos netos de comisión).
- Filtro conocido: penetración de tarjeta de crédito/cuenta Apple-Google válida es limitada en Honduras — riesgo de conversión, no resuelto en esta ronda, marcar como variable a monitorear post-lanzamiento.

---

## 7. Plataforma y stack técnico

- **App:** Expo / React Native, iOS + Android.
- **Constructor:** una persona, apoyada en agentes de IA (Claude Code y similares).
- **Pagos:** RevenueCat.
- **Contenido bíblico:** RVR1960 + NVI (confirmar licencias).
- **LLM:** un solo proveedor de modelo de lenguaje cubre Q&A, chat de personajes y devocional por sentimiento (los 3 módulos conversacionales comparten el mismo RAG).
- **Generación de imágenes (módulo 5):** proveedor a definir en fase de diseño/build. El límite de "1 ejemplo gratis" acota el costo de generación en el tier gratis; factorizar costo por generación en el margen de los usuarios Pro.

---

## 8. Privacidad y datos

- Historial de conversación **privado por usuario**, ligado solo a su cuenta.
- **Bible AI Honduras no entrena modelos propios con el historial del usuario.**
  El tratamiento de entrenamiento por los proveedores de IA de terceros
  (Anthropic y OpenAI) depende de sus políticas y de la
  configuración de cuenta vigente — ver `docs/store/privacy-policy.md`.
- El usuario puede borrar su historial desde la app.
- Justificación: comunidad de iglesia es una red social densa — una filtración o percepción de "no privado" se propaga rápido y destruye confianza.

---

## 9. Distribución / Go-to-market

- **Canal principal:** orgánico — redes sociales personales del fundador + grupos de WhatsApp de iglesias/conocidos. Sin presupuesto de ads confirmado, sin canal institucional (iglesia como cliente).
- **Implicación:** el ritmo de adquisición depende del alcance personal del fundador, no de un canal escalable/pagado. Esto es una restricción real sobre qué tan agresiva puede ser la meta de 1,200 pagos en 8-10 semanas — vale la pena revisar semana a semana si el ritmo orgánico está en curva hacia la meta o no, para decidir a tiempo si se necesita presupuesto de ads/influencers como plan B.

### 9b. Compartir por WhatsApp (loop de crecimiento orgánico integrado al producto)

Dado que el canal es 100% orgánico, se construye un mecanismo de compartir ligero (sin feed social, sin backend de comunidad) directamente en 3 de los 5 módulos:

| Módulo | Qué se comparte | Motivo |
|---|---|---|
| 1. Devocional diario | Tarjeta: versículo + imagen + link a la app | Caso base, contenido diario natural de compartir |
| 2. Q&A guiado | Tarjeta: pregunta + versículo citado + resumen + link | Se siente auténtico (pregunta real), no como marketing |
| 3. Chat con personaje bíblico | Cita del personaje ("Moisés te responde: ...") + link | Formato único, mayor potencial de curiosidad/viralidad |
| 4. Devocional por sentimiento | **No se ofrece compartir** (o solo versión genérica/anónima) | Contenido ligado a problema/sentimiento personal — choca con la promesa de privacidad de la sección 8 |
| 5. Generador de imágenes | Compartir la imagen generada + link | Contenido visual, buen candidato a compartir, sin problema de privacidad |

- Cada link de compartir lleva un **código de referido simple** para medir cuántos pagos vienen de compartir vs. del alcance directo del fundador — bajo costo de construir, alto valor para saber si el loop orgánico está funcionando.
- **Explícitamente fuera de alcance v1:** feed social, comentarios, ver qué comparten otros usuarios, cualquier backend de "comunidad" real. Se limita a compartir + medir, no a construir una red social dentro de la app.

### 9c. Roadmap v1.1 — Comunidad completa

Visión confirmada por el fundador, **no descartada, solo pospuesta**: grupos públicos de oración/devocionales, feed, y descubrimiento de grupos — esencialmente una capa social dentro de la app. Se construye después de v1, una vez que:
1. Haya usuarios reales pagando (validación de que el núcleo del producto funciona).
2. Haya más tiempo/presupuesto que el de las 8-10 semanas iniciales.
3. Se resuelva cómo se modera el contenido generado por usuarios (petición de oración, publicaciones) — sin esto, el mismo riesgo teológico/reputacional que motivó posponerlo en v1 se repite en v1.1.

---

## 10. Métricas de éxito

- **Adquisición:** ~1,200 pagos en 8-10 semanas desde lanzamiento.
- **Retención:** meta de retención a mes 2 por definir con un umbral concreto (ej. ≥40% de los suscritos del mes 1 siguen activos/pagando en el mes 2) — esto es la señal real de product-market fit, no solo el conteo bruto de pagos iniciales. **Pendiente:** fijar el número exacto antes del lanzamiento.

---

## 11. Riesgos conocidos y decisiones aceptadas conscientemente

| Riesgo | Decisión tomada | Nota |
|---|---|---|
| Riesgo teológico / reputacional | Sin revisor externo, solo guías + disclaimers | Mayor exposición si el chat de personajes o el Q&A produce algo doctrinalmente ofensivo. Mitigado parcialmente por la regla dura de "solo humanos en 1ra persona". |
| Comisión de tienda (IAP) | Aceptada a cambio de simplicidad de implementación (RevenueCat) | Reduce el ingreso neto real por debajo de $4.99 x 1,200. |
| Baja penetración de tarjeta/cuenta de pago en Honduras | No resuelto — usar IAP igual en v1 | Puede limitar conversión real; monitorear tasa de fallo de pago post-lanzamiento. |
| Alcance de 4 features completas en 8-10 semanas, un solo builder | Aceptado explícitamente por el fundador | Mayor riesgo de calendario; recortado ya a lo esencial dentro de cada feature (sin video, sin multi-denominación, sin revisor externo) para intentar caber en el plazo. |
| Licencia de NVI | Pendiente de verificar | RVR1960 es la opción segura si NVI no es viable por licencia. |
| Canal de adquisición 100% orgánico | Aceptado | Sin plan B de presupuesto confirmado si el ritmo orgánico no alcanza la meta. |

---

## 12. Dirección de diseño (input para fase de Claude Design)

**Concepto:** minimalista, con vibe de paz. No debe sentirse como una app de productividad ni como una app "gamer"/redes sociales. Debe sentirse como abrir un espacio tranquilo, no como abrir una herramienta.

- **Paleta:** colores suaves y neutros — tonos tierra, azul suave, verde salvia, blancos cálidos, acentos de luz de amanecer/atardecer. Nada saturado, nada de colores "app corporativa" o "app fintech". Mucho espacio en blanco/negativo.
- **Tipografía:** una serif suave/humanista para el texto bíblico y las reflexiones (sensación atemporal, de libro físico), sans-serif limpia para navegación/UI. Tamaños generosos, interlineado amplio — nada apretado.
- **Imágenes:** naturaleza, luz suave, paisajes (amaneceres, montañas, agua) — nunca stock corporativo genérico. Donde aplique, imágenes que se sientan cercanas a Honduras, sin forzarlo.
- **Movimiento/transiciones:** lentas y suaves, nunca abruptas. Sin confetti, sin sonidos fuertes, sin gamificación ruidosa (esto choca directo con el módulo de devocional por sentimiento/problema, que necesita sentirse pastoral, no como una app de hábitos).
- **Densidad de pantalla:** pocos elementos por pantalla, un foco claro cada vez (coherente con el home progresivo: versículo primero, el resto se revela después).
- **Modo oscuro:** contemplar un modo oscuro suave (no negro puro/alto contraste) — el devocional antes de dormir es un momento de uso natural.
- **Tono de copy:** cálido y humano, nunca robótico ni corporativo — coherente con que la IA se presenta como acompañamiento, no como buscador o asistente técnico.
- **Iconografía:** líneas finas, minimalistas, sin colores llamativos.

## 13. Siguientes pasos

1. Pasar este PRD a fase de diseño (Claude Design) para producir pantallas y sistema de diseño.
2. Confirmar proveedor de generación de imágenes y modelar costo real por usuario Pro.
3. Verificar licencia de uso de NVI (o confirmar RVR1960 como única fuente v1).
4. Definir el número exacto de meta de retención a mes 2 antes del lanzamiento.
