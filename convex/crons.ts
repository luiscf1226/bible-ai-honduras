import { cronJobs } from "convex/server";

import { internal } from "./_generated/api";

const crons = cronJobs();

// Honduras no observa horario de verano: las 06:05 UTC corresponden a las
// 00:05 locales y dejan listo el contenido antes del primer acceso del día.
crons.daily(
  "preparar ventana de devocionales",
  { hourUTC: 6, minuteUTC: 5 },
  internal.devotional.ensureWindow,
);

// Siembra la copia servible de cada plan de lectura (anual #114 y recorridos
// #115) que todavía no exista. Es un no-op para los ya sembrados — no pisa
// contenido existente, así que correrla a diario es inofensivo, evita depender
// de un paso manual de deploy y siembra sola un recorrido nuevo del catálogo.
crons.daily(
  // Solo ASCII: Convex rechaza el push completo si el identificador tiene
  // tildes (#135).
  "sembrar-planes-lectura",
  { hourUTC: 6, minuteUTC: 10 },
  internal.readingPlans.ensurePlanSeeded,
);

export default crons;
