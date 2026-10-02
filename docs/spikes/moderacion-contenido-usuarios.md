# Spike #186: cómo moderar lo que escriben los usuarios (N2)

**Estado:** decisión propuesta, falta que el fundador la apruebe.
**Fecha:** 2026-10-02.
**Destraba:** la comunidad completa de PRD §9c (condición 3). **No** bloquea el plan en
grupo cerrado (#185): ese está construido para que no haya nada que moderar (ver §1).

---

## Recomendación en una línea

**Moderar por etapas, y no abrir una etapa sin la anterior funcionando.** Hoy: cero
contenido escrito por usuarios (ya es así). Siguiente: peticiones de oración **solo dentro
de grupos cerrados**, con filtro automático antes de publicar, reportar, bloquear y el
fundador revisando reportes. La comunidad pública (feed, grupos abiertos) recién con
moderadores voluntarios de iglesias y las métricas de §6 en verde.

---

## 1. Qué hay hoy y por qué no necesita moderación

| Superficie | ¿Lo ve otra persona? | ¿Hace falta moderar? |
|---|---|---|
| Preguntar, Voces, Sentir | No (es tuyo) | No. Lo que genera la IA ya pasa por el RAG y la verificación de citas (regla #4). |
| Notas en guardados (#167) | No | No. Privadas, nunca se comparten ni van a la IA. |
| Compartir por WhatsApp (#36) | Sí, pero fuera de la app | No. Es texto de la app (versículo, respuesta citada) y lo manda la persona por su cuenta. |
| **Plan en grupo (#185)** | **Sí, hasta 15 personas** | **No.** El nombre del grupo sale de una lista fija + el nombre del plan; de cada miembro se ve su primer nombre de cuenta y cuántos días leyó. No hay campo de texto libre. |

El único texto que escribe un usuario y ve otro es el **nombre de la cuenta** (Clerk), que
también se ve en cualquier grupo de WhatsApp. Si alguien se pone un nombre ofensivo, quien
está a cargo del grupo puede cambiar el link y el resto puede salir; no justifica un sistema
de moderación. Queda anotado como riesgo bajo.

## 2. Qué se va a poder escribir (y qué no)

Ordenado por riesgo, de menor a mayor:

1. **Peticiones de oración en un grupo cerrado** ("Oren por la operación de mi mamá").
   Audiencia: ≤15 personas que se conocen y entraron por invitación.
2. **Reacciones fijas** ("Estoy orando 🙏") sobre esas peticiones. No es texto libre:
   no necesita moderación, solo límite de frecuencia.
3. **Publicaciones en un feed público** o grupos abiertos que cualquiera encuentra.
   Audiencia: desconocidos. Es lo que el PRD pospuso.

**No se va a construir:** mensajes directos entre usuarios, comentarios anidados, fotos o
audio subidos por usuarios. Cada uno multiplica el costo de moderar (imágenes en particular)
y no está en el PRD.

## 3. Qué se puede reportar

Un botón "Reportar" en cada petición o publicación, con **una sola elección** (sin texto
libre, para que el reporte no sea a su vez contenido a moderar):

| Motivo | Ejemplos reales del contexto hondureño | Acción automática |
|---|---|---|
| Ventas, préstamos o estafas | Pirámides, "inversiones", préstamos gota a gota, rifas, pedidos de dinero a desconocidos | Se oculta al reportarla 1 vez si además el filtro la marcó; si no, a los 2 reportes |
| Insultos, odio o acoso | Ataques a una persona, a una iglesia o a una denominación | Se oculta a los 2 reportes |
| Contenido sexual | — | Se oculta al primer reporte |
| Datos privados de otra persona | Nombre completo + diagnóstico, dirección, teléfono, situación legal de un tercero | Se oculta a los 2 reportes |
| Alguien está en peligro | Ideas de hacerse daño, violencia en la casa | **No se oculta**: se le muestran recursos de ayuda a quien reportó y a quien escribió, y llega primero a la cola del fundador |

**Doctrina no es un motivo de reporte.** Una célula bautista y una pentecostal van a orar
distinto; moderar teología entre usuarios es exactamente el riesgo que el PRD quiso evitar.
La regla #4 aplica a lo que dice la IA, no a lo que dicen las personas. Lo ofensivo entra
por "insultos u odio".

Los recursos de ayuda para "alguien está en peligro" tienen que ser **números verificados en
Honduras** antes de lanzar. Este documento no los inventa: queda como tarea.

## 4. Cómo se bloquea

Tres niveles, del más chico al más grande:

| Quién | Acción | Efecto |
|---|---|---|
| Cualquier persona | **Bloquear** a alguien | No ves nada de esa persona en ningún grupo, y ella no ve tus peticiones. No se le avisa. Se puede deshacer en Ajustes. |
| Quien está a cargo del grupo | **Sacar del grupo** y **cambiar el link** | La persona deja de ver el grupo; el link viejo deja de servir (`readingGroups.rotateInvite` ya existe). |
| Fundador / moderador | **Ocultar**, **suspender** (7 días sin publicar) o **vetar** (no puede publicar nunca más) | Leer, Preguntar, planes y todo lo personal siguen funcionando: se le quita solo la voz pública, nunca la Biblia. |

Datos (para el ticket que lo construya, no ahora): `reports` (quién, qué, motivo, fecha),
`userBlocks` (quién bloqueó a quién) y `moderationActions` (qué se hizo, por qué, hasta
cuándo). Las tres entran en el borrado de cuenta como las demás tablas por usuario.

## 5. Filtros automáticos

Antes de publicar, en una action de Convex (nunca en el cliente):

1. **Reglas locales**, sin costo: teléfonos, links, palabras de venta/préstamo y una lista
   corta de groserías en español de Honduras. Teléfono o link → no se publica ("Para
   cuidar al grupo, las peticiones no llevan teléfonos ni links"). Groserías → se pide
   reformular.
2. **Clasificador de moderación** (OpenAI `omni-moderation`, que la documentación de
   OpenAI publica como gratuito; verificar antes de integrarlo): sexual, odio, acoso,
   autolesión, violencia. Marca → no se publica, o en "autolesión" se publica con los
   recursos de ayuda y se avisa al fundador.
3. **Sin revisión teológica por IA.** Por la misma razón que §3: no es nuestro rol.

Mientras el filtro no responda (proveedor caído), la petición **no** se publica y se le
dice a la persona que lo intente en un rato. Mejor una petición demorada que una sin filtro.

Límites de frecuencia: 3 peticiones por persona por día, 10 reportes por persona por día.
Usan el mismo patrón de `convex/quotas.ts` pero **no** son cuota de producto (no hay Pro
que los quite), así que van en un módulo aparte y no en el paywall (regla #3 aplica a las
cuotas free/Pro).

## 6. Quién modera y cuánto cuesta

**Quién:** el fundador, solo, mientras se cumplan estos números. Después, 2 o 3
**moderadores de confianza** voluntarios (pastores o líderes de célula usuarios de la app),
con acceso a una cola de reportes y a ocultar/suspender, nunca a vetar ni a ver datos
personales.

Estimación con la meta del PRD (≈1.200 cuentas Pro) y supuestos conservadores:

| Supuesto | Valor |
|---|---|
| Personas en grupos que escriben peticiones | 20 % de 1.200 = 240 |
| Peticiones por persona por semana | 2 → **≈480 por semana** |
| Reportadas | 2 % → **≈10 reportes por semana** |
| Tiempo por reporte | ≈1 minuto (leer, decidir, un toque) |
| **Tiempo humano** | **≈10–15 minutos por semana** |
| Filtro local | USD 0 |
| Clasificador de moderación | USD 0 si se confirma la gratuidad; si no, un modelo chico de clasificación cuesta menos de un centavo de dólar por petición corta (≈USD 2–5 al mes a este volumen; verificar la tarifa vigente) |
| Desarrollo | ≈1 semana: tablas, filtro, botón de reportar, bloquear, cola simple para el fundador |

**Cuándo deja de alcanzar el fundador solo:** más de 40 reportes por semana, o cualquier
reporte de "alguien está en peligro" que tarde más de 24 horas en verse. Ahí entran los
moderadores voluntarios. El feed público no se abre hasta tener esos voluntarios
funcionando al menos un mes en grupos cerrados.

## 7. Requisitos de las tiendas

App Store (guía 1.2, contenido generado por usuarios) y Google Play piden, para cualquier
app con contenido de usuarios visible a otros: **filtro de contenido objetable, forma de
reportar, forma de bloquear y un contacto publicado**. La etapa recomendada en §8 cubre los
cuatro; sin ellos, la actualización que agregue peticiones puede ser rechazada.

## 8. Decisión propuesta, por etapas

| Etapa | Qué se abre | Condición para abrirla | Moderación |
|---|---|---|---|
| **0 (hoy)** | Plan en grupo cerrado (#185), sin texto libre | — | Ninguna |
| **1** | Peticiones de oración y reacciones fijas **dentro de grupos cerrados** | Etapa 0 en uso real; números de ayuda verificados | Filtro local + clasificador antes de publicar; reportar (§3), bloquear (§4); fundador revisa en ≤48 h (≤24 h si es "peligro") |
| **2** | Feed o grupos públicos (PRD §9c) | Usuarios pagando (PRD §9c.1), etapa 1 estable 1 mes, ≥2 moderadores voluntarios | Lo de la etapa 1 + las primeras 5 publicaciones de cada cuenta nueva esperan aprobación |

**Lo que se le pide aprobar al fundador:**
1. Que doctrina **no** sea motivo de reporte (§3).
2. Que el fundador sea el moderador de la etapa 1, con el SLA de arriba.
3. Que la etapa 2 espere a los moderadores voluntarios, aunque haya presión por abrirla.
