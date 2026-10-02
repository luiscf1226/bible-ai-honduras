import Svg, { Circle, Path, Rect } from "react-native-svg";

import { tokens } from "../theme/tokens";

/**
 * Set único de íconos de la app (design/oleada-ux.md §Íconos). Trazo fino
 * sobre una grilla de 24, como los SVG del prototipo: los que ya estaban en
 * `design/Bible AI Honduras.dc.html` se copiaron tal cual; los nuevos siguen
 * el mismo trazo. No se agrega otra librería de íconos.
 */
type Shape =
  | { kind: "path"; d: string }
  | { kind: "circle"; cx: number; cy: number; r: number }
  | { kind: "rect"; x: number; y: number; width: number; height: number; rx: number };

const path = (d: string): Shape => ({ kind: "path", d });

export const ICONS = {
  // Del prototipo.
  back: [path("M15 5l-7 7 7 7")],
  chevronRight: [path("M9 5l7 7-7 7")],
  chevronDown: [path("M6 9l6 6 6-6")],
  close: [path("M6 6l12 12M18 6L6 18")],
  send: [path("M12 19V5M6 11l6-6 6 6")],
  check: [path("M4 12.5l5 5L20 6.5")],
  book: [
    path(
      "M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5zM20 5.5A1.5 1.5 0 0 0 18.5 4H13v16h5.5A1.5 1.5 0 0 0 20 18.5z",
    ),
  ],
  chat: [
    path("M20 12.5c0 3.9-3.6 7-8 7-1 0-2-.2-2.9-.5L4.5 20.5l1.2-3.4A6.7 6.7 0 0 1 4 12.5c0-3.9 3.6-7 8-7s8 3.1 8 7z"),
  ],
  whatsapp: [path("M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3.5 20.5l1.6-5A8.4 8.4 0 1 1 21 11.5z")],
  image: [
    { kind: "rect", x: 3.5, y: 5, width: 17, height: 14, rx: 2.5 },
    path("M3.5 15.5l4.5-4 4 3.5 3-2.5 5 4.5"),
    { kind: "circle", cx: 9, cy: 9.5, r: 1.3 },
  ],
  sunrise: [
    { kind: "circle", cx: 12, cy: 13, r: 4 },
    path("M12 4v2.5M4.5 13H3M21 13h-1.5M6.2 7.2 5.1 6.1M17.8 7.2l1.1-1.1M3 19h18"),
  ],
  // Botón de Ajustes del inicio.
  sun: [
    { kind: "circle", cx: 12, cy: 12, r: 3.2 },
    path("M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8"),
  ],
  bookmark: [path("M6.5 4h11v16.5L12 16.5 6.5 20.5z")],
  clock: [{ kind: "circle", cx: 12, cy: 12, r: 8.5 }, path("M12 8v4.5l3 2")],
  lock: [{ kind: "rect", x: 5, y: 10.5, width: 14, height: 10, rx: 2.4 }, path("M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5")],
  refresh: [path("M20 11.5a8 8 0 1 0-2.5 5.8"), path("M20 5.5v6h-6")],
  // Nuevos, mismo trazo.
  menu: [path("M4 7h16M4 12h16M4 17h10")],
  search: [{ kind: "circle", cx: 11, cy: 11, r: 6.5 }, path("M16 16l4 4")],
  plus: [path("M12 5v14M5 12h14")],
  note: [path("M5 19l1-4L15.5 5.5a2.1 2.1 0 0 1 3 3L9 18z"), path("M13.5 7.5l3 3")],
  highlight: [path("M14.5 4.5l5 5-8 8H6.5v-5z"), path("M4 20.5h8")],
  ribbon: [path("M8 3v18l4-3.5 4 3.5V3")],
  share: [path("M12 15V4M8 8l4-4 4 4"), path("M5 12v6.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V12")],
  copy: [
    { kind: "rect", x: 8, y: 8, width: 12, height: 12, rx: 2 },
    path("M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8"),
  ],
  voice: [
    { kind: "circle", cx: 9, cy: 8, r: 3.5 },
    path("M3.5 20a5.5 5.5 0 0 1 11 0"),
    path("M17 7.5a4 4 0 0 1 0 5M19.5 5a7.5 7.5 0 0 1 0 10"),
  ],
  textSize: [path("M3 18l4.5-11L12 18M4.6 14h5.8"), path("M14 18l3-7 3 7M15 15.8h4")],
  calendar: [{ kind: "rect", x: 4, y: 5.5, width: 16, height: 14.5, rx: 2.4 }, path("M4 10h16M8.5 3.5v4M15.5 3.5v4")],
} as const satisfies Record<string, readonly Shape[]>;

export type IconName = keyof typeof ICONS;

type IconProps = {
  name: IconName;
  color: string;
  size?: keyof typeof tokens.size.icon;
  /** Relleno con el mismo color (p. ej. "Guardado"). */
  filled?: boolean;
  testID?: string;
};

export function Icon({ name, color, size = "md", filled = false, testID }: IconProps) {
  const px = tokens.size.icon[size];
  const fill = filled ? color : "none";
  return (
    <Svg height={px} testID={testID} viewBox="0 0 24 24" width={px}>
      {ICONS[name].map((shape: Shape, index) => {
        const common = {
          fill,
          stroke: color,
          strokeLinecap: "round" as const,
          strokeLinejoin: "round" as const,
          strokeWidth: tokens.size.iconStroke,
        };
        if (shape.kind === "circle") return <Circle key={index} {...common} cx={shape.cx} cy={shape.cy} r={shape.r} />;
        if (shape.kind === "rect") {
          return <Rect key={index} {...common} height={shape.height} rx={shape.rx} width={shape.width} x={shape.x} y={shape.y} />;
        }
        return <Path key={index} {...common} d={shape.d} />;
      })}
    </Svg>
  );
}
