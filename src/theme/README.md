# Sistema de diseño nativo

La fuente visual es [`design/tokens.json`](../../design/tokens.json), medida del prototipo
de Claude Design. No agregues colores, tamaños, radios ni espaciados directamente en una
pantalla: primero se registra y se genera desde ese archivo.

## Uso

```tsx
import { Button, Card, Chip } from "../src/components";
import { tokens, typography } from "../src/theme";
```

- `tokens.color`, `tokens.space`, `tokens.radius` y `tokens.component` cubren color,
  espaciado, radios y los contratos de cada componente.
- `typography` y `tokens.type` traducen EB Garamond y DM Sans a las familias cargadas por Expo.
- `Button` ofrece las variantes `primary`, `secondary` y `quiet`.
- `Card` ofrece superficies `default`, `subtle` y `sunk`, y padding `default`, `module` o `none`.
- `Chip` representa opciones breves y puede reflejar el estado `selected`.

## Flujo de cambios

1. Medí o reexportá el valor desde `design/Bible AI Honduras.dc.html`.
2. Actualizá `design/tokens.json`.
3. Ejecutá `npm run tokens:build`.
4. Confirmá con `npm run tokens:check` antes de abrir la PR.
