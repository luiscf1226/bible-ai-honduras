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

  it("no se esquiva partiendo la palabra dentro de una oración", () => {
    for (const text of [
      "sos una put a",
      "sos una p uta",
      "andate a la mier da",
      "qué ver ga contigo",
      "sos un pen dejo",
      "sos una mal parida",
      "sos un ma ri con",
      "sos un idio ta y lo sabés",
      "sos un hijo de p u t a",
      "andate a la m i e r d a",
      "sos un c u l e r o",
      "sos un ce ro te",
      "sos una pu.ta de verdad",
    ]) {
      expect(blocked(text), text).toBe(true);
    }
  });

  it("no se esquiva con números, símbolos, otros alfabetos ni letras repetidas al final", () => {
    for (const text of [
      "qué pvt4 vida",
      "sos un cu1o", // 1 como l
      "sos una 1diota", // 1 como i
      "sos un p!jud0",
      "sos un cu|ero",
      "sos una p\u057Dta", // u armenia
      "sos una \u0440\u057Dta", // p cirílica y u armenia
      "sos un \u0441\u0446lero", // c y u cirílicas
      "sos una p\u03BCta", // mu griega
      "sos un cu\u0142ero", // ł
      "sos un \u1D04\u1D1C\u029F\u1D0F", // versalitas
      "sos una perraa",
      "sos una puuutaaaa",
      "maaaariiiicoooon",
    ]) {
      expect(blocked(text), JSON.stringify(text)).toBe(true);
    }
  });

  it("deja pasar oraciones normales aunque dos palabras seguidas formen una grosería", () => {
    for (const text of [
      "Ayer se me apagó la computadora en pleno culto",
      "Hubo una disputa entre los hermanos y ya se arreglaron",
      "Cuidá su reputación en el trabajo",
      "Desde el barco se veía el mar icono de la costa norte",
      "Fui a ver gas natural para la cocina",
      "Salí con chamarra porque hace frío",
      "El monte es tupido por tanta lluvia",
      "El cabro no vino al ensayo",
      "El cabro nada en el río los sábados",
      "Saqué cero te digo, pero voy a estudiar más",
      "El cerro te espera para la caminata",
      "¿Jugamos play o vamos al parque?",
      "Salí con Mari con los niños al parque",
      "El imputado salió libre",
      "Me puse la pijama y me dormí",
      "Qué estupendo sermón el de hoy",
      "Leí la bitácora del viaje misionero",
      "La culebra del Génesis engañó a Eva",
      "No me siento culpable",
      "Calculo que llego a las 7",
      "Tengo un pendiente con el pastor",
      "Le compré un perro a mi hija",
      "Pasame la pera que está en la mesa",
      "Vamos a computar los votos del comité",
      "Esa es la ruta más corta a Tegucigalpa",
      "La puerta de la iglesia estaba abierta",
      "Disputaron la final en San Pedro Sula",
      "Oremos por la reputación del ministerio",
      "Mañana hay vigilia a las 10",
      "¿Viste el versículo que te mandé? Salmos 23:1",
      "El culto de jóvenes empieza a las 6",
      "Compré verduras en el mercado",
      "Me caí de la bici pero estoy bien",
      "Te llamo a las 8 para orar",
      "La ramera de Jericó escondió a los espías",
      "Voy a la capital con mi papá",
      "El cipote se portó bien, maje",
      "Mi abuela tiene 91 años",
      "La sopa de caracol estaba deliciosa",
      "Va a llover, llevate el paraguas",
      "Se fue la luz en todo el barrio",
      "El vuelo sale a las 5:40",
      "Me puse a estudiar Romanos 8",
      "Pídele a Dios sabiduría",
      "Hoy cumplí 30 años, gracias a Dios",
      "Pasame la receta de las tortillas",
      "Vivo en la colonia Kennedy",
    ]) {
      expect(blocked(text), text).toBe(false);
    }
  });
});
