# Prototipo de referencia — Bible AI Honduras

Exportado de Claude Design: https://claude.ai/design/p/d47cead9-1ae1-42f9-90f8-05f74c8eec8d

**Este es el contrato visual del v1.** Toda pantalla del issue #2 y de los issues de UI
(#8, #12, #14, #17, #25, #27, #30, #34) se deriva de aquí. Si un componente no existe
en el prototipo, se decide en Claude Design primero — no se inventa en el editor.

## Cómo abrirlo

```bash
cd design && python3 -m http.server 8899
# abrir http://localhost:8899/Bible%20AI%20Honduras.dc.html
```

Abrirlo con `file://` no funciona: el runtime carga `support.js`, `image-slot.js`
y `ios-frame.jsx` por fetch relativo.

## Archivos

| Archivo | Qué es |
|---|---|
| `Bible AI Honduras.dc.html` | El prototipo navegable — los 5 módulos |
| `support.js` | Runtime de Claude Design (generado, no editar) |
| `image-slot.js` | Componente de placeholder de imagen (generado, no editar) |
| `ios-frame.jsx` | Marco de dispositivo iOS del prototipo |
| `logo.png` | Logo |

## Tokens a extraer en #2

Paleta dominante medida sobre el prototipo:

| Token | Hex | Uso |
|---|---|---|
| `ink` | `#3B352E` | Texto principal |
| `ink-muted` | `#8E857A` | Texto secundario |
| `ink-soft` | `#A09789` | Texto terciario / labels |
| `bg` | `#E9E1D5` | Fondo de app |
| `surface` | `#FBF8F3` | Card |
| `surface-alt` | `#FAF5EE` / `#F4EFE6` | Card secundaria |
| `border` | `#EDE6DA` / `#E8E1D6` | Bordes y separadores |
| `accent` | `#B08260` | Acento / CTA |
| `accent-deep` | `#8C6A4C` | Links, hover |
| `sage` | `#7C8F7B` | Acento secundario |

Tipografía: **EB Garamond** (serif, títulos y versículos) + **DM Sans** (300/400/500, UI).

> La lista completa de hex está en el HTML. La tabla de arriba es el punto de partida
> de #2, no el resultado final — Dev B la consolida en el sistema de tokens.

## Reglas para agentes y devs de frontend

- Tokens machine-readable: **`design/tokens.json`** — importalo, no copies hex a mano.
- Regla dura del proyecto: **`CLAUDE.md` § Regla dura #1**.
- Skill que aplica el procedimiento completo (incluye cómo re-exportar desde Claude
  Design cuando el diseño cambia): **`.claude/skills/frontend-claude-design/SKILL.md`**.
