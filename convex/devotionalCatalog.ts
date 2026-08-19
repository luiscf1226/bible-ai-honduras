export type DevotionalCatalogItem = {
  catalogId: string;
  verseRef: string;
  reflection: string;
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

// Ciclo editorial de cuatro semanas. No contiene texto bíblico con licencia:
// el consumidor del contenido resuelve `verseRef` contra la fuente bíblica
// autorizada del producto.
export const devotionalCatalog: readonly DevotionalCatalogItem[] = [
  { catalogId: "esperanza", verseRef: "Lamentaciones 3:22-23", reflection: "La misericordia de Dios no se agota con lo que pasó ayer. Hoy podés recibir el día como un comienzo sostenido por su fidelidad.", ...images.amanecer },
  { catalogId: "descanso", verseRef: "Mateo 11:28", reflection: "No tenés que cargar todo con tus propias fuerzas. Presentá a Jesús lo que te pesa y permitite descansar en su cuidado.", ...images.lago },
  { catalogId: "direccion", verseRef: "Proverbios 3:5-6", reflection: "Cuando el camino no está claro, confiá paso a paso. Dios puede enderezar tu senda aun antes de que veás el mapa completo.", ...images.camino },
  { catalogId: "presencia", verseRef: "Isaías 41:10", reflection: "El temor suele hablar fuerte, pero no tiene la última palabra. Dios está presente y te sostiene en la decisión que hoy enfrentás.", ...images.luz },
  { catalogId: "paz", verseRef: "Filipenses 4:6-7", reflection: "Convertí tu preocupación en una oración concreta. La paz de Dios no niega la dificultad; guarda tu corazón mientras la atravesás.", ...images.rio },
  { catalogId: "fortaleza", verseRef: "Isaías 40:31", reflection: "Esperar en Dios no es quedarse inmóvil. Es renovar las fuerzas para caminar con paciencia y seguir haciendo el bien.", ...images.cielo },
  { catalogId: "cuidado", verseRef: "Salmos 23:1", reflection: "El Buen Pastor conoce lo que necesitás antes de que lo expliqués. Hoy podés vivir con gratitud por su provisión cercana.", ...images.bosque },
  { catalogId: "gozo", verseRef: "Salmos 118:24", reflection: "Este día no necesita ser perfecto para ser un regalo. Buscá una señal sencilla de la bondad de Dios y agradecela.", ...images.amanecer },
  { catalogId: "sabiduria", verseRef: "Santiago 1:5", reflection: "Pedir sabiduría es reconocer que no tenemos todas las respuestas. Dios recibe esa petición humilde y orienta tu próximo paso.", ...images.camino },
  { catalogId: "consuelo", verseRef: "2 Corintios 1:3-4", reflection: "Dios se acerca con consuelo real a quienes sufren. Lo que recibís de él también puede convertirse en compañía para otra persona.", ...images.lago },
  { catalogId: "valentia", verseRef: "Josué 1:9", reflection: "La valentía bíblica no es ausencia de miedo; es avanzar sabiendo que Dios va con vos. Elegí hoy una obediencia pequeña y concreta.", ...images.cielo },
  { catalogId: "perdon", verseRef: "1 Juan 1:9", reflection: "No escondás delante de Dios lo que él ya ve. Confesar abre espacio para recibir su perdón y volver a caminar en la luz.", ...images.rio },
  { catalogId: "gratitud", verseRef: "1 Tesalonicenses 5:18", reflection: "La gratitud no llama bueno a todo lo que duele. Te ayuda a reconocer que, aun en medio de ello, Dios sigue obrando y acompañando.", ...images.amanecer },
  { catalogId: "amor", verseRef: "Romanos 5:8", reflection: "El amor de Dios no depende de que hoy tengás un buen desempeño. Su iniciativa te invita a responder con confianza y amor hacia otros.", ...images.luz },
  { catalogId: "proposito", verseRef: "Efesios 2:10", reflection: "Tu vida tiene obras de bien preparadas para este día. Prestá atención a la necesidad cercana donde podés servir con sencillez.", ...images.bosque },
  { catalogId: "oracion", verseRef: "Jeremías 33:3", reflection: "La oración no requiere palabras elegantes. Hablá con honestidad y quedate atento a la dirección que Dios puede darte en su Palabra.", ...images.cielo },
  { catalogId: "refugio", verseRef: "Salmos 46:1", reflection: "Cuando todo parece moverse, Dios permanece como refugio. Tomá un momento para respirar y recordar dónde está puesta tu seguridad.", ...images.rio },
  { catalogId: "confianza", verseRef: "Romanos 8:28", reflection: "No siempre entendemos cómo se unen las piezas de nuestra historia. Podemos confiar en que Dios trabaja con amor en quienes le buscan.", ...images.camino },
  { catalogId: "humildad", verseRef: "Miqueas 6:8", reflection: "La fidelidad diaria se muestra al actuar con justicia, amar la misericordia y caminar humildemente. Empezá por la conversación que tenés enfrente.", ...images.luz },
  { catalogId: "paciencia", verseRef: "Gálatas 6:9", reflection: "El bien que sembrás puede tardar en verse. No te rindás en lo correcto por cansancio; Dios conoce cada acto fiel.", ...images.bosque },
  { catalogId: "familia", verseRef: "Colosenses 3:13", reflection: "La paciencia y el perdón se practican especialmente en lo cercano. Pedí a Dios un corazón dispuesto a escuchar y restaurar.", ...images.lago },
  { catalogId: "luz", verseRef: "Mateo 5:14-16", reflection: "Tu fe puede alumbrar sin hacer ruido. Una palabra amable, una decisión íntegra o una ayuda oportuna reflejan a Dios hoy.", ...images.amanecer },
  { catalogId: "generosidad", verseRef: "2 Corintios 9:7", reflection: "La generosidad nace de un corazón agradecido, no de presión. Mirá con libertad qué podés compartir: tiempo, atención o recursos.", ...images.rio },
  { catalogId: "verdad", verseRef: "Juan 8:32", reflection: "La verdad de Jesús libera de las voces que te acusan o confunden. Volvé a su Palabra antes de darle la última palabra a tus pensamientos.", ...images.cielo },
  { catalogId: "servicio", verseRef: "Marcos 10:45", reflection: "Servir no te hace menos; te acerca al ejemplo de Cristo. Buscá una forma concreta de aliviar la carga de alguien hoy.", ...images.bosque },
  { catalogId: "fidelidad", verseRef: "Hebreos 10:23", reflection: "Sostené con firmeza la esperanza que profesás. Dios es fiel incluso cuando tus emociones cambian de un día a otro.", ...images.luz },
  { catalogId: "renovacion", verseRef: "2 Corintios 4:16", reflection: "Aunque haya cansancio exterior, Dios puede renovar tu interior. Regalate un momento de silencio para volver a él.", ...images.lago },
  { catalogId: "bendicion", verseRef: "Números 6:24-26", reflection: "Terminá el ciclo recordando que la bendición de Dios incluye cuidado, gracia y paz. Recibila y compartila con alguien que amás.", ...images.amanecer },
];
