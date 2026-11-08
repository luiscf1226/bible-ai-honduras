import { describe, expect, it } from "vitest";

import { checkMessageContent } from "./chatFilter";

const blocked = (text: string) => checkMessageContent(text).ok === false;

describe("checkMessageContent", () => {
  it("deja pasar mensajes normales, también los que citan la Biblia", () => {
    for (const text of [
      "Hola, ¿cómo estás? Te mando el versículo de hoy",
      "Las zorras tienen cavernas, y las aves del cielo nidos (Mateo 8:20)",
      "Mirá la película del domingo, maje",
      "El cipote ya se durmió, pisado",
      "¿Comemos una pera después del culto?",
      "Mi teléfono es 9999-1234",
      "1 Corintios 13:4",
      "Qué vergüenza llegar tarde",
      "Me voy a la playa con la familia",
      "Oremos por los que sufren",
    ]) {
      expect(blocked(text), text).toBe(false);
    }
  });

  it("rechaza groserías e insultos en español de Honduras", () => {
    for (const text of ["sos un hijueputa", "qué verga", "cerote", "Pendejos todos", "malparida", "vaya a la mierda", "CULERO"]) {
      expect(blocked(text), text).toBe(true);
    }
  });

  it("rechaza groserías e insultos en inglés", () => {
    for (const text of ["fuck you", "you are a bitch", "what the shit"]) {
      expect(blocked(text), text).toBe(true);
    }
  });

  it("no se esquiva con tildes, números, letras repetidas ni letras separadas", () => {
    for (const text of ["PÚTA", "qué put4", "m13rda", "puuuuuta", "perrrrra", "p.u.t.a", "p u t a", "imbécil", "@sshole"]) {
      expect(blocked(text), text).toBe(true);
    }
  });
});
