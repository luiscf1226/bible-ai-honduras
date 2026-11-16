// Límites free que comparten servidor y app. Viven aparte de `quotas.ts` (el
// único servicio de cuotas, regla dura #3) para que la app no cargue el backend
// solo por un número: `src/lib/convexClientImports.test.ts`.

export type QuotaModule = "qa" | "voices" | "feelings" | "stories" | "verseImage";

/**
 * Usos gratis por día de Honduras (vuelven a medianoche de Tegucigalpa). Pro no
 * tiene límite. Para cambiar un número, cambialo acá: el servidor, los textos
 * del límite y Ajustes lo leen de esta tabla.
 */
export const QUOTA_LIMITS: Record<QuotaModule, number> = {
  // Preguntar: una respuesta del RAG con cita por pregunta.
  qa: 5,
  // Voces: cada mensaje a un personaje es una respuesta de la IA. Diez alcanzan
  // para una conversación de verdad; cinco se cortaban a la mitad.
  voices: 10,
  feelings: 3,
  // Historias ilustradas: cada una son varias imágenes de OpenAI, lo más caro
  // de la app. Volver a abrir una ya hecha no gasta.
  stories: 1,
  // Fondos con IA de "Crear imagen" (convex/verseImage.ts): cada uno es una imagen de OpenAI.
  verseImage: 3,
};
