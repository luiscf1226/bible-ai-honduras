# Assets de icono y splash

> **Estado: FINAL.** Logo definitivo de #102.

## Origen

`logo-source.png` (1024×1024, RGB sin alfa) es el logo maestro. Es una
reinterpretación en alta resolución de `design/logo.png` (232×232, el logo del
prototipo de Claude Design) generada con **GPT Image 2** a pedido del dueño del
producto, usando el logo del prototipo como referencia. Conserva el concepto:
Biblia abierta, cruz de madera con halo, ramas de olivo y la paleta
crema / marrón / salvia de `design/tokens.json`.

`design/logo.png` no se modifica: `design/` es el export de Claude Design.

## Archivos

| Archivo | Uso | Cómo se genera |
| --- | --- | --- |
| `icon.png` | App Store / Play (`expo.icon`) | `logo-source.png` a sangre completa, sin alfa, sin redondeo (iOS pone su máscara) |
| `adaptive-icon.png` | Android (`android.adaptiveIcon`) | Logo al 80% con borde difuminado sobre `bg`, dentro de la zona segura |
| `splash-icon.png` | Plugin `expo-splash-screen` | Logo con borde difuminado sobre `bg` (#E9E1D5), sin cuadrado visible |
| `favicon.png` | Web | 48×48 |

## Regenerar

```sh
python3 assets/generate-icons.py
```

Si cambia el logo, reemplazar `logo-source.png` (1024×1024, cuadrado, sin
esquinas redondeadas ni texto) y volver a correr el script.
