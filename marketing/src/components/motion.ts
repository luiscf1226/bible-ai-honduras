import { Easing, interpolate } from "remotion";

import { motion } from "../theme";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const ease = Easing.out(Easing.cubic);

/** 0 → 1 desde `start` durante `duration` cuadros, con la curva lenta de la app. */
export function progress(frame: number, start: number, duration = motion.fade) {
  return interpolate(frame, [start, start + duration], [0, 1], { ...clamp, easing: ease });
}

/** Entrada de la app: aparece subiendo `motion.rise` puntos (el versículo del feed). */
export function rise(frame: number, start: number, duration = motion.fade): React.CSSProperties {
  const p = progress(frame, start, duration);
  return { opacity: p, transform: `translateY(${(1 - p) * motion.rise}px)` };
}

/** Fundido de entrada y salida de una escena de `length` cuadros. Sin `fadeIn`, el primer cuadro ya se ve: es la portada. */
export function sceneOpacity(frame: number, length: number, fadeIn = true, duration = motion.crossfade) {
  const fadeOut = interpolate(frame, [length - duration, length], [1, 0], clamp);
  return fadeIn ? Math.min(fadeOut, interpolate(frame, [0, duration], [0, 1], clamp)) : fadeOut;
}

/** Cuántas letras de `text` ya se escribieron, a `perFrame` letras por cuadro. */
export function typed(text: string, frame: number, start: number, perFrame: number) {
  const count = Math.max(0, Math.floor((frame - start) * perFrame));
  return text.slice(0, count);
}
