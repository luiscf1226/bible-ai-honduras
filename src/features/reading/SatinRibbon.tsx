import Svg, { Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";

import { useTheme } from "../../theme/ThemeProvider";
import { tokens } from "../../theme/tokens";

const { width: W, fade: FADE, shadow: SHADOW, weaveInset: WEAVE } = tokens.size.ribbon;
/** Largo del corte en V (cola de golondrina) de la punta. */
const TAIL = W * 0.75;

/** Cinta de largo `length` con la punta cortada en V. */
function ribbonPath(length: number): string {
  return `M0 0H${W}V${length}L${W / 2} ${length - TAIL}L0 ${length}Z`;
}

/**
 * Cinta del separador como la de una Biblia de papel (design/oleada-ux.md
 * §Separador físico): satén que cae desde el borde de arriba de la página
 * hasta el renglón marcado. El satén es un degradado de `accentDeep` en los
 * bordes a `accent` al centro con un brillo de `surface`; los bordes tejidos
 * son dos puntadas finas, y una sombra corrida de `ink` la despega del papel.
 * Arriba se funde con `paper`: parece que entra por el canto del libro.
 */
export function SatinRibbon({ length }: { length: number }) {
  const { color } = useTheme();
  const body = ribbonPath(length);
  const weaveEnd = length - TAIL - WEAVE;

  return (
    <Svg height={length + SHADOW} width={W + SHADOW}>
      <Defs>
        <LinearGradient id="ribbon-satin" x1="0" x2="1" y1="0" y2="0">
          <Stop offset="0" stopColor={color.accentDeep} />
          <Stop offset="0.22" stopColor={color.accent} />
          <Stop offset="0.78" stopColor={color.accent} />
          <Stop offset="1" stopColor={color.accentDeep} />
        </LinearGradient>
        <LinearGradient id="ribbon-sheen" x1="0" x2="1" y1="0" y2="0">
          <Stop offset="0.2" stopColor={color.surface} stopOpacity={0} />
          <Stop offset="0.4" stopColor={color.surface} stopOpacity={tokens.opacity.ribbonSheen} />
          <Stop offset="0.55" stopColor={color.surface} stopOpacity={0} />
        </LinearGradient>
        <LinearGradient gradientUnits="userSpaceOnUse" id="ribbon-fade" x1="0" x2="0" y1="0" y2={FADE}>
          <Stop offset="0" stopColor={color.paper} stopOpacity={1} />
          <Stop offset="1" stopColor={color.paper} stopOpacity={0} />
        </LinearGradient>
      </Defs>

      <Path d={body} fill={color.ink} opacity={tokens.opacity.ribbonShadow} transform={`translate(${SHADOW} ${SHADOW})`} />
      <Path d={body} fill="url(#ribbon-satin)" />
      <Path d={body} fill="url(#ribbon-sheen)" />
      {weaveEnd > FADE ? (
        <Path
          d={`M${WEAVE} ${FADE}V${weaveEnd}M${W - WEAVE} ${FADE}V${weaveEnd}`}
          stroke={color.accentDeep}
          strokeDasharray="1.4 1.6"
          strokeOpacity={tokens.opacity.ribbonWeave}
          strokeWidth={0.7}
        />
      ) : null}
      <Rect fill="url(#ribbon-fade)" height={FADE} width={W + SHADOW} x={0} y={0} />
    </Svg>
  );
}
