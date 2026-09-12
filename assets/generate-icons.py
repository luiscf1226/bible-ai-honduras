#!/usr/bin/env python3
"""Genera los assets de icono/splash a partir de `design/logo.png`.

PROVISIONAL — ver `assets/README.md`. El arte fuente mide 232x232, muy por
debajo de los 1024x1024 que exigen App Store y Play. Este script **nunca
escala hacia arriba**: compone el logo a su tamaño nativo sobre un lienzo de
1024x1024. Cuando llegue el arte definitivo (>=1024x1024 o vectorial), cambiar
SOURCE y volver a correr:

    python3 assets/generate-icons.py

Colores: `bg` = #E9E1D5, tomado de `design/tokens.json` (regla dura #1).
"""
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "design" / "logo.png"
OUT = ROOT / "assets"

# Token `bg` de design/tokens.json (tema claro). No es un hex improvisado.
BG = (0xE9, 0xE1, 0xD5)
CANVAS = 1024
FAVICON = 48


def centered(size: int, background) -> Image.Image:
    """Lienzo `size`x`size` con el logo centrado a resolucion nativa."""
    logo = Image.open(SOURCE).convert("RGBA")
    mode = "RGB" if len(background) == 3 else "RGBA"
    canvas = Image.new(mode, (size, size), background)
    canvas.paste(logo, ((size - logo.width) // 2, (size - logo.height) // 2), logo)
    return canvas


def main() -> None:
    OUT.mkdir(exist_ok=True)

    # icon.png — Apple rechaza canal alfa y esquinas redondeadas: RGB plano.
    centered(CANVAS, BG).save(OUT / "icon.png")

    # adaptive-icon.png — foreground con alfa; Android lo recorta en circulo,
    # squircle, etc. El logo ocupa 232/1024 = 23%, dentro de la zona segura
    # del 66% (676 px), asi que ninguna mascara lo corta.
    centered(CANVAS, (0, 0, 0, 0)).save(OUT / "adaptive-icon.png")

    # splash-icon.png — con alfa; `resizeMode: contain` lo ajusta al ancho.
    centered(CANVAS, (0, 0, 0, 0)).save(OUT / "splash-icon.png")

    # favicon.png — web. Reducir si es valido; ampliar no.
    logo = Image.open(SOURCE).convert("RGBA")
    logo.resize((FAVICON, FAVICON), Image.LANCZOS).save(OUT / "favicon.png")


if __name__ == "__main__":
    main()
