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

  it("no se esquiva con caracteres invisibles ni letras de adorno", () => {
    for (const text of [
      "pu\u200bta", // zero-width space
      "pu\u200cta", // zero-width non-joiner
      "pu\u200dta", // zero-width joiner
      "pu\u2060ta", // word joiner
      "pu\u00adta", // guion blando
      "pu\ufeffta", // BOM
      "pu\ufe0fta", // selector de variante
      "p\u034futa", // combining grapheme joiner
      "pu\u3164ta", // relleno hangul
      "ｐｕｔａ", // ancho completo
      "ＭＩＥＲＤＡ",
      "𝐩𝐮𝐭𝐚", // negrita matemática
      "p\u0336u\u0336t\u0336a\u0336", // tachado con marcas combinadas
      "\u0440uta", // p cirílica
      "m\u0456erda", // i cirílica
    ]) {
      expect(blocked(text), JSON.stringify(text)).toBe(true);
    }
  });

  it("no se esquiva partiendo la palabra con separadores", () => {
    for (const text of [
      "pu.ta",
      "pu-ta",
      "pu_ta",
      "pu*ta",
      "pu ta",
      "qué pu ta",
      "p.uta",
      "mier.da",
      "pen-dejo",
      "hijue.puta",
      "p u u t a a",
      "puuu.taaa",
      "h d p",
      "put a", // el mensaje entero aplastado
      "mier da",
    ]) {
      expect(blocked(text), text).toBe(true);
    }
  });

  it("no bloquea palabras normales que tienen una grosería adentro ni dos palabras que juntas la forman", () => {
    for (const text of [
      "Se me arruinó la computadora",
      "La computación es mi carrera",
      "Ganaron la disputa en la final",
      "Disputaron el partido",
      "Cuidá tu reputación",
      "El imputado salió libre",
      "Me compré una pijama",
      "Fui a ver gas para la estufa",
      "El cabro necesito que venga",
      "Qué estupendo sermón",
      "Estoy aprendiendo otro idioma",
      "Leí la bitácora del viaje",
      "La culebra del Génesis",
      "No me siento culpable",
      "Calculo que llego a las 7",
      "Tengo un pendiente con el pastor",
      "Me gusta el color fucsia",
      "No se lo de la mi",
      "Ezequiel 37:1-14",
      "Juan 3:16",
      "Mi número: 3345-1709",
      "Bendiciones 🙏🏽",
      "Amén ❤️",
    ]) {
      expect(blocked(text), text).toBe(false);
    }
  });

  it("no se esquiva con tildes, números, letras repetidas ni letras separadas", () => {
    for (const text of ["PÚTA", "qué put4", "m13rda", "puuuuuta", "perrrrra", "p.u.t.a", "p u t a", "imbécil", "@sshole"]) {
      expect(blocked(text), text).toBe(true);
    }
  });
});
