---
name: frontend-claude-design
description: Regla obligatoria para TODO trabajo de frontend en Bible AI Honduras. Úsala antes de crear o modificar cualquier pantalla, componente, estilo, color, tipografía o espaciado en la app Expo/React Native — y siempre que el pedido mencione UI, pantalla, diseño, home, chat, paywall, ajustes, onboarding, personajes, historias, o cualquiera de los issues #1, #2, #8, #12, #14, #17, #25, #27, #30, #34. Garantiza que la UI se derive del prototipo de Claude Design en design/ y de design/tokens.json, en vez de inventarse en el editor.
---

# UI derivada de Claude Design — obligatorio

Este proyecto tiene un prototipo navegable que es **el contrato visual del v1**:
`design/Bible AI Honduras.dc.html`, exportado de
https://claude.ai/design/p/d47cead9-1ae1-42f9-90f8-05f74c8eec8d

No es inspiración. Es la especificación. Cuatro módulos se construyen en paralelo por
personas distintas; el prototipo es lo único que los mantiene viéndose como una sola app.

## Procedimiento — en este orden, sin saltarse pasos

### 1. Mirá el prototipo antes de escribir código

```bash
cd design && python3 -m http.server 8899
# http://localhost:8899/Bible%20AI%20Honduras.dc.html
```

Con `file://` no carga: el runtime hace fetch relativo de `support.js`,
`image-slot.js` y `ios-frame.jsx`.

Si no podés abrir un navegador, leé el HTML directamente y localizá la pantalla por su
texto en español (ej. `grep -n "Versículo del día" "design/Bible AI Honduras.dc.html"`).
El prototipo es un solo archivo con los 5 módulos; cada pantalla es un bloque con
estilos inline — ahí están los valores exactos.

### 2. Leé `design/tokens.json` y usá tokens, nunca literales

```
color.ink #3B352E · color.inkMuted #8E857A · color.bg #E9E1D5 · color.surface #FBF8F3
color.border #EDE6DA · color.accent #B08260 · color.accentDeep #8C6A4C · color.sage #7C8F7B
font.serif "EB Garamond" (títulos, versículos) · font.sans "DM Sans" 300/400/500 (UI)
radius.md 14 · radius.lg 16 · radius.xl 18 · radius.pill 999
space.xs 6 · space.sm 9 · space.md 12 · space.lg 14 · space.xl 20
```

**Prohibido en un componente:** un hex literal, un `fontSize` literal, un
`borderRadius` literal, un padding literal. Todo pasa por el token. Si el valor que
necesitás no existe como token, ese es el hallazgo — reportalo, no lo hardcodees.

### 3. Si el componente no existe en el prototipo, PARÁ

No lo inventes en el editor. El flujo correcto es:

1. Decir explícitamente qué falta y en qué pantalla.
2. Se diseña en Claude Design.
3. Se re-exporta a `design/` (ver "Re-exportar" abajo).
4. Recién ahí se codea.

Improvisar una pantalla "provisional" es exactamente lo que este archivo existe para
prevenir — se vuelve permanente y desalinea el módulo del resto de la app.

### 4. Antes de decir que terminaste

- [ ] La pantalla existe en el prototipo y la comparaste lado a lado.
- [ ] Cero hex / tamaños / radios literales en el diff — todo vía `tokens.json`.
- [ ] Serif solo para títulos y versículos; DM Sans para el resto de la UI.
- [ ] Si agregaste un token nuevo, sale de un valor medido en el prototipo, no elegido a ojo.

## Re-exportar el prototipo cuando el diseño cambia

Con el MCP de Claude Design autenticado (`/design-login`), `DesignSync`:

```
get_project  projectId=d47cead9-1ae1-42f9-90f8-05f74c8eec8d
list_files   projectId=…
get_file     path="Bible AI Honduras.dc.html"   → design/
```

Los assets que el HTML referencia y que deben viajar con él:
`support.js`, `image-slot.js`, `ios-frame.jsx`, `logo.png`. Si actualizás el HTML,
verificá que ninguna referencia nueva quedó sin exportar
(`grep -o 'src="\./[^"]*"' "design/Bible AI Honduras.dc.html"`).

Después de re-exportar, re-medí los tokens que cambiaron y actualizá `design/tokens.json`
en el mismo commit. Nunca dejes el HTML y los tokens desincronizados.

## Qué NO cubre esta skill

Backend, RAG, cuotas, RevenueCat, notificaciones. Esas tienen sus propias reglas duras
en `CLAUDE.md`.
