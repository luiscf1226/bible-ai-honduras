import { devotionalMonths, type DevotionalEntry } from "./devotionals";

export type DevotionalCatalogItem = Omit<DevotionalEntry, "day"> & {
  /** Mes-día del calendario, "MM-DD" (p. ej. "02-29"). */
  catalogId: string;
  imageUrl: string;
  imageAlt: string;
  imageAttributionUrl: string;
};

const images = {
  amanecer: {
    imageAlt: "Amanecer cálido entre montañas",
    imageAttributionUrl: "https://unsplash.com/photos/1500534623283-312aade485b7",
    imageUrl: "https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=1600&q=80",
  },
  bosque: {
    imageAlt: "Bosque iluminado por el sol de la mañana",
    imageAttributionUrl: "https://unsplash.com/photos/1441974231531-c6227db76b6e",
    imageUrl: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1600&q=80",
  },
  camino: {
    imageAlt: "Camino tranquilo rodeado de árboles",
    imageAttributionUrl: "https://unsplash.com/photos/1470770841072-f978cf4d019e",
    imageUrl: "https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=1600&q=80",
  },
  cielo: {
    imageAlt: "Cielo suave sobre un paisaje de montañas",
    imageAttributionUrl: "https://unsplash.com/photos/1501854140801-50d01698950b",
    imageUrl: "https://images.unsplash.com/photo-1501854140801-50d01698950b?auto=format&fit=crop&w=1600&q=80",
  },
  lago: {
    imageAlt: "Lago quieto entre montañas al amanecer",
    imageAttributionUrl: "https://unsplash.com/photos/1439853949127-fa647821eba0",
    imageUrl: "https://images.unsplash.com/photo-1439853949127-fa647821eba0?auto=format&fit=crop&w=1600&q=80",
  },
  luz: {
    imageAlt: "Rayos de luz entre árboles altos",
    imageAttributionUrl: "https://unsplash.com/photos/1500530855697-b586d89ba3ee",
    imageUrl: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1600&q=80",
  },
  rio: {
    imageAlt: "Río de montaña entre piedras y árboles verdes",
    imageAttributionUrl: "https://unsplash.com/photos/1464822759023-fed622ff2c3b",
    imageUrl: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1600&q=80",
  },
} as const;

// Las imágenes rotan día a día en este orden (mismo set del ciclo anterior).
const imageRotation = [images.amanecer, images.lago, images.camino, images.luz, images.rio, images.cielo, images.bosque];

function monthDayKey(month: number, day: number): string {
  return `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// Un devocional distinto por cada día del calendario: 366 entradas, de 01-01 a
// 12-31 pasando por 02-29. No contiene texto bíblico con licencia: el
// consumidor resuelve `verseRef` contra la fuente bíblica autorizada del
// producto. El contenido vive en `convex/devotionals/`, un archivo por mes.
export const devotionalCatalog: readonly DevotionalCatalogItem[] = devotionalMonths.flatMap((entries, monthIndex) =>
  entries.map(({ day, ...entry }) => ({ catalogId: monthDayKey(monthIndex + 1, day), ...entry })),
).map((item, index) => ({ ...item, ...imageRotation[index % imageRotation.length] }));

const byMonthDay = new Map(devotionalCatalog.map((item) => [item.catalogId, item]));

/** Devocional de un mes (1–12) y día (1–31) del calendario. */
export function devotionalForMonthDay(month: number, day: number): DevotionalCatalogItem {
  const item = byMonthDay.get(monthDayKey(month, day));
  if (!item) {
    throw new Error(`No hay devocional para ${monthDayKey(month, day)}`);
  }
  return item;
}
