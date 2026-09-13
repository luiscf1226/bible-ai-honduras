#!/usr/bin/env python3
"""Genera los assets de icono/splash a partir de `assets/logo-source.png`.

`logo-source.png` (1024x1024, sin alfa) es el logo final de #102: una
reinterpretación en alta resolución de `design/logo.png` (232x232) hecha con
GPT Image 2, conservando el concepto del prototipo (Biblia abierta, cruz con
halo, ramas de olivo, paleta crema/marrón/salvia). `design/` no se toca: es el
export de Claude Design.

    python3 assets/generate-icons.py

Colores: `bg` = #E9E1D5, tomado de `design/tokens.json` (regla dura #1).
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "assets" / "logo-source.png"
OUT = ROOT / "assets"

# Token `bg` de design/tokens.json (tema claro).
BG = (0xE9, 0xE1, 0xD5)
CANVAS = 1024
FAVICON = 48


def blended(source: Image.Image, scale: float) -> Image.Image:
    """Logo a `scale` del lienzo, con borde circular difuminado sobre `bg`.

    El fondo crema del logo no es exactamente el token `bg`; sin el
    difuminado se vería un cuadrado en la splash y en el adaptive icon.
    """
    size = int(CANVAS * scale)
    logo = source.resize((size, size), Image.LANCZOS)
    mask = Image.new("L", (size, size), 0)
    inset = int(size * 0.13)
    ImageDraw.Draw(mask).ellipse((inset, inset, size - inset, size - inset), fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(size * 0.045))
    canvas = Image.new("RGB", (CANVAS, CANVAS), BG)
    offset = (CANVAS - size) // 2
    canvas.paste(logo, (offset, offset), mask)
    return canvas


def main() -> None:
    source = Image.open(SOURCE).convert("RGB")

    # icon.png — App Store / Play: full-bleed, RGB sin alfa, sin esquinas
    # redondeadas (iOS aplica su propia máscara).
    source.resize((CANVAS, CANVAS), Image.LANCZOS).save(OUT / "icon.png")

    # adaptive-icon.png — Android recorta en círculo/squircle; el 80% con
    # borde difuminado deja lo esencial dentro de la zona segura.
    blended(source, 0.80).save(OUT / "adaptive-icon.png")

    # splash-icon.png — lo muestra el plugin expo-splash-screen sobre `bg`.
    blended(source, 1.0).save(OUT / "splash-icon.png")

    source.resize((FAVICON, FAVICON), Image.LANCZOS).save(OUT / "favicon.png")


if __name__ == "__main__":
    main()
