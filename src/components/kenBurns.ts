import { tokens } from "../theme/tokens";

/**
 * Hacia dónde pasea una imagen con zoom lento ("Ken Burns"). Sale fijo de una
 * semilla (la cita, la escena), así cada imagen se mueve siempre igual y dos
 * seguidas no se mueven igual.
 */
export type KenBurnsPath = { toScale: number; dx: number; dy: number };

const DIRECTIONS: readonly [number, number][] = [
  [1, 1],
  [-1, 1],
  [1, -1],
  [-1, -1],
  [1, 0],
  [-1, 0],
];

export function kenBurnsPath(seed: string): KenBurnsPath {
  let hash = 0x811c9dc5;
  for (let index = 0; index < seed.length; index += 1) hash = Math.imul(hash ^ seed.charCodeAt(index), 0x01000193);
  const [x, y] = DIRECTIONS[(hash >>> 0) % DIRECTIONS.length];
  const shift = tokens.motion.kenBurnsShift;
  return { toScale: tokens.motion.kenBurnsScale, dx: x * shift, dy: y * shift };
}
