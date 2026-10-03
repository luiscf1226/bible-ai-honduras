import { enero } from "./01_enero";
import { febrero } from "./02_febrero";
import { marzo } from "./03_marzo";
import { abril } from "./04_abril";
import { mayo } from "./05_mayo";
import { junio } from "./06_junio";
import { julio } from "./07_julio";
import { agosto } from "./08_agosto";
import { septiembre } from "./09_septiembre";
import { octubre } from "./10_octubre";
import { noviembre } from "./11_noviembre";
import { diciembre } from "./12_diciembre";
import type { DevotionalEntry } from "./types";

export type { DevotionalEntry } from "./types";

/**
 * Los 12 meses del devocional diario, de enero (índice 0) a diciembre. Febrero
 * trae el 29: en años bisiestos existe ese día y tiene su propio devocional.
 * Un archivo por mes para que cada mes se revise (también pastoralmente) por
 * separado.
 */
export const devotionalMonths: readonly (readonly DevotionalEntry[])[] = [
  enero,
  febrero,
  marzo,
  abril,
  mayo,
  junio,
  julio,
  agosto,
  septiembre,
  octubre,
  noviembre,
  diciembre,
];

/** Días de cada mes en un año bisiesto: 366 en total. */
export const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;
