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

export default crons;
