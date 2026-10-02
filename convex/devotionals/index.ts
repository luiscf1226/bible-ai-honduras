import { enero } from "./01-enero";
import { febrero } from "./02-febrero";
import { marzo } from "./03-marzo";
import { abril } from "./04-abril";
import { mayo } from "./05-mayo";
import { junio } from "./06-junio";
import { julio } from "./07-julio";
import { agosto } from "./08-agosto";
import { septiembre } from "./09-septiembre";
import { octubre } from "./10-octubre";
import { noviembre } from "./11-noviembre";
import { diciembre } from "./12-diciembre";
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
