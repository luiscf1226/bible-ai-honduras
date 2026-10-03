import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Circle, Ellipse, G, Path, Rect } from "react-native-svg";

import { useTheme } from "../../theme/ThemeProvider";
import { tokens } from "../../theme/tokens";
import { isSeasonPalette } from "../../theme/seasonPalette";
import { GARLAND_HEIGHT, GARLAND_WIDTH, decorTones, garlandFor, type Motif } from "./seasonDecor";

type Tones = ReturnType<typeof decorTones>;
type Paint = { main: string; tones: Tones; sheen: string };

/** Puntas de una estrella de `points` picos centrada en (0, 0). */
function starPath(points: number, outer: number, inner: number): string {
  const steps = points * 2;
  const coords = Array.from({ length: steps }, (_, i) => {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = (Math.PI * i) / points - Math.PI / 2;
    return `${(radius * Math.cos(angle)).toFixed(2)} ${(radius * Math.sin(angle)).toFixed(2)}`;
  });
  return `M${coords.join("L")}Z`;
}

const LEAF = "M0 -11C6 -6 7 2 0 11C-7 2 -6 -6 0 -11Z";
const BRACT = "M0 0C3 -4 3.4 -9 0 -13C-3.4 -9 -3 -4 0 0Z";
const HOLLY_LEAF = "M0 0C2 -2 5 -1 6 -4C7 -1 10 -2 11 0C10 2 7 1 6 4C5 1 2 2 0 0Z";
const STAR = starPath(5, 10, 4.2);
const SPARKLE = starPath(4, 10, 2.4);

/** Cada adorno en la grilla de 24, centrado en (0, 0). */
const MOTIFS: Record<Motif, (paint: Paint) => ReactNode> = {
  leaf: ({ main, tones }) => (
    <>
      <Path d={LEAF} fill={main} />
      <Path d="M0 -8V12" stroke={tones.deep} strokeLinecap="round" strokeOpacity={0.45} strokeWidth={0.9} />
    </>
  ),
  pumpkin: ({ main, tones }) => (
    <>
      <Path d="M0 -6Q1 -10 3.5 -11" fill="none" stroke={tones.deep} strokeLinecap="round" strokeWidth={2} />
      <Path d="M1.5 -8C4 -12 8 -11 9 -9C6 -8 4 -7 1.5 -8Z" fill={tones.leaf} />
      <Ellipse cx={-5} cy={2} fill={main} rx={6} ry={7.5} />
      <Ellipse cx={5} cy={2} fill={main} rx={6} ry={7.5} />
      <Ellipse cx={0} cy={2} fill={main} rx={5.5} ry={8.5} />
      <Path
        d="M-3 -5.5Q-5.5 2 -3 9.5M3 -5.5Q5.5 2 3 9.5"
        fill="none"
        stroke={tones.deep}
        strokeOpacity={0.35}
        strokeWidth={0.9}
      />
    </>
  ),
  flower: ({ main, tones }) => (
    <>
      {Array.from({ length: 8 }, (_, i) => (
        <Ellipse cx={0} cy={-5.5} fill={main} key={i} transform={`rotate(${i * 45})`} rx={2.6} ry={5} />
      ))}
      <Circle fill={tones.deep} r={3} />
    </>
  ),
  wheat: ({ main, tones }) => (
    <>
      <Path d="M0 12V-11" stroke={tones.deep} strokeLinecap="round" strokeOpacity={0.6} strokeWidth={1.1} />
      {[-8, -4, 0, 4].map((y) => (
        <G key={y}>
          <Ellipse cx={-2.4} cy={y} fill={main} transform={`rotate(-30 -2.4 ${y})`} rx={1.7} ry={3.4} />
          <Ellipse cx={2.4} cy={y} fill={main} transform={`rotate(30 2.4 ${y})`} rx={1.7} ry={3.4} />
        </G>
      ))}
      <Ellipse cx={0} cy={-11} fill={main} rx={1.6} ry={3} />
    </>
  ),
  poinsettia: ({ main, tones }) => (
    <>
      {Array.from({ length: 7 }, (_, i) => (
        <Path d={BRACT} fill={main} key={`o${i}`} transform={`rotate(${i * (360 / 7)})`} />
      ))}
      {Array.from({ length: 5 }, (_, i) => (
        <Path d={BRACT} fill={tones.deep} key={`i${i}`} transform={`rotate(${i * 72 + 26}) scale(0.6)`} />
      ))}
      {[
        [0, -1.6],
        [1.6, 1],
        [-1.6, 1],
      ].map(([cx, cy]) => (
        <Circle cx={cx} cy={cy} fill={tones.gold} key={`${cx}-${cy}`} r={1.3} />
      ))}
    </>
  ),
  pine: ({ main, tones }) => (
    <>
      {/* Dos capas de agujas: la de atrás, más ancha y translúcida, le da cuerpo a la rama. */}
      {[-13, -10, -7, -4, -1, 2, 5, 8].map((x) => (
        <Path
          d={`M${x} 0L${x + 5} -6.5M${x} 0L${x + 5} 6.5`}
          key={`b${x}`}
          stroke={main}
          strokeLinecap="round"
          strokeOpacity={0.45}
          strokeWidth={2.2}
        />
      ))}
      <Path d="M-15 0H14" stroke={tones.deep} strokeLinecap="round" strokeOpacity={0.6} strokeWidth={1.2} />
      {[-14, -11.5, -9, -6.5, -4, -1.5, 1, 3.5, 6, 8.5].map((x) => (
        <Path
          d={`M${x} 0L${x + 4.5} -5.5M${x} 0L${x + 4.5} 5.5`}
          key={x}
          stroke={main}
          strokeLinecap="round"
          strokeWidth={1.7}
        />
      ))}
    </>
  ),
  ornament: ({ main, tones, sheen }) => (
    <>
      <Path d="M0 -16V-9" stroke={tones.deep} strokeOpacity={0.6} strokeWidth={0.9} />
      <Rect fill={tones.gold} height={3} rx={0.8} width={4.4} x={-2.2} y={-9.5} />
      <Circle cy={0} fill={main} r={7} />
      <Circle cx={-2.4} cy={-2.4} fill={sheen} opacity={tokens.opacity.ribbonSheen} r={2} />
    </>
  ),
  holly: ({ main, tones }) => (
    <>
      <G transform="rotate(200)">
        <Path d={HOLLY_LEAF} fill={tones.leaf} />
      </G>
      <G transform="rotate(-20)">
        <Path d={HOLLY_LEAF} fill={tones.leaf} />
      </G>
      <Circle cx={-1.8} cy={-1} fill={main} r={2.2} />
      <Circle cx={1.8} cy={-1} fill={main} r={2.2} />
      <Circle cx={0} cy={1.8} fill={main} r={2.2} />
    </>
  ),
  star: ({ main }) => <Path d={STAR} fill={main} />,
  sparkle: ({ main }) => <Path d={SPARKLE} fill={main} />,
  olive: ({ main, tones }) => (
    <>
      <Path d="M0 12Q2 0 0 -12" fill="none" stroke={tones.deep} strokeLinecap="round" strokeOpacity={0.5} strokeWidth={1} />
      {[-8, -3, 2, 7].map((y, i) => (
        <Ellipse
          cx={i % 2 === 0 ? -3 : 3.4}
          cy={y}
          fill={main}
          key={y}
          transform={`rotate(${i % 2 === 0 ? -35 : 35} ${i % 2 === 0 ? -3 : 3.4} ${y})`}
          rx={1.8}
          ry={4.4}
        />
      ))}
      <Ellipse cx={0.4} cy={-12} fill={main} rx={1.6} ry={3.6} />
    </>
  ),
};

/**
 * Guirnalda de temporada (design/oleada-ux.md §Decoración de temporada).
 * Cuelga del borde de arriba de la foto del versículo del día, como un adorno
 * en un cuadro: no ocupa alto, así el inicio compacto (U1b) sigue entrando en
 * una pantalla. Sobre la foto (con `imageScrim`) usa siempre los tonos de
 * noche, que son los claros. Es decorativa: no se lee ni se toca. Sin
 * temporada con paleta, no existe.
 */
export function SeasonGarland() {
  const { color, season } = useTheme();
  const paletteKey = season?.paletteKey;
  const garland = garlandFor(paletteKey);
  if (!garland || !isSeasonPalette(paletteKey)) return null;

  const tones = decorTones(paletteKey, true);

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={[styles.root, { aspectRatio: GARLAND_WIDTH / GARLAND_HEIGHT }]}
      testID={`season-garland-${paletteKey}`}
    >
      <Svg height="100%" viewBox={`0 0 ${GARLAND_WIDTH} ${GARLAND_HEIGHT}`} width="100%">
        {garland.cord ? (
          <Path d={garland.cord} fill="none" stroke={tones.deep} strokeOpacity={0.5} strokeWidth={1} />
        ) : null}
        {garland.ornaments.map((ornament, index) => (
          <G
            key={`${ornament.motif}-${index}`}
            transform={`translate(${ornament.x} ${ornament.y}) rotate(${ornament.rotate ?? 0}) scale(${ornament.scale ?? 1})`}
          >
            {MOTIFS[ornament.motif]({ main: tones[ornament.tone], sheen: color.surface, tones })}
          </G>
        ))}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { left: 0, position: "absolute", right: 0, top: 0 },
});
