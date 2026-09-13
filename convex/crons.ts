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

// Siembra la copia servible del plan de lectura anual (#114) si todavía no
// existe. Es un no-op después de la primera corrida — no pisa contenido ya
// sembrado, así que correrla a diario es inofensivo y evita depender de un
// paso manual de deploy.
crons.daily(
  "sembrar-plan-lectura-canonico",
  { hourUTC: 6, minuteUTC: 10 },
  internal.readingPlans.ensurePlanSeeded,
);

export default crons;
