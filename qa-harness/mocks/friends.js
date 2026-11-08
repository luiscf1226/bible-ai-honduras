// Amigos y chat 1 a 1 (1.0.3) en el harness de QA. Mismo contrato que
// convex/friends.ts. El texto de los versículos sale de topic-verses.json
// (RV1909 real), nunca inventado.
//
// ?amigos=normas  → la cuenta todavía no aceptó las normas
// ?amigos=vacio   → sin amigos ni solicitudes
import { checkMessageContent } from "../../convex/chatFilter";
import { friendInitial, messagePreview, verseRangeEnd } from "../../convex/friendsCore";
import TOPIC_VERSES from "./topic-verses.json";

function friendsScenario() {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("amigos");
}

const HOUR = 3600e3;
const now = Date.now();
const MY_CODE = "BAH-4QA7HN2";

function verseFor(book, chapter, verse, verseEnd) {
  const end = verseRangeEnd({ book, chapter, verse, verseEnd });
  const byVerse = TOPIC_VERSES[`${book} ${chapter}`];
  if (end === null || !byVerse?.[verse]) return null;
  const texts = [];
  let last = verse;
  for (let n = verse; n <= end && byVerse[n]; n += 1) {
    texts.push(byVerse[n]);
    last = n;
  }
  return { book, chapter, verse, ...(last > verse ? { verseEnd: last } : {}), version: "RV1909", text: texts.join(" ") };
}

const person = (name) => ({ name, initial: friendInitial(name) });

const state = {
  rulesAccepted: friendsScenario() !== "normas",
  friends:
    friendsScenario() === "vacio"
      ? []
      : [
          {
            friendshipId: "f1",
            ...person("Carlos M."),
            readAt: now - 25.5 * HOUR,
            friendReadAt: now - 24 * HOUR,
            messages: [
              { id: "m1", fromMe: false, kind: "text", text: "¿Cómo te fue en la entrevista?", createdAt: now - 26 * HOUR },
              { id: "m2", fromMe: true, kind: "text", text: "Bien, gracias a Dios. Mañana me dicen 🙏", createdAt: now - 25.5 * HOUR },
              { id: "m3", fromMe: false, kind: "verse", verse: verseFor("Filipenses", 4, 6, 7), createdAt: now - 2 * HOUR },
              { id: "m4", fromMe: false, kind: "text", text: "Para que no te afanés. Estamos orando por vos en la célula.", createdAt: now - 1.9 * HOUR },
            ],
          },
          {
            friendshipId: "f2",
            ...person("María José Reyes"),
            readAt: now,
            friendReadAt: null,
            messages: [{ id: "m6", fromMe: true, kind: "verse", verse: verseFor("Salmos", 23, 1), createdAt: now - 30 * HOUR }],
          },
          { friendshipId: "f3", ...person("Daniel Castro"), readAt: now, friendReadAt: null, messages: [], acceptedAt: now - 72 * HOUR },
        ],
  requests: friendsScenario() === "vacio" ? [] : [{ friendshipId: "r1", ...person("Lucía Paz"), createdAt: now - 3 * HOUR }],
  sent: friendsScenario() === "vacio" ? [] : [{ friendshipId: "s1", ...person("Jorge Andino"), createdAt: now - 48 * HOUR }],
  blocked: friendsScenario() === "vacio" ? [] : [{ blockId: "b1", ...person("Kevin Torres") }],
};

// Códigos que el harness conoce para "Agregar con código" y el link de WhatsApp.
const CODES = { "BAH-7K2M9QX": person("Rebeca Sánchez"), [MY_CODE]: "self" };

function unread(friend) {
  return friend.messages.filter((message) => !message.fromMe && message.createdAt > friend.readAt).length;
}

function lastOf(friend) {
  return friend.messages[friend.messages.length - 1] ?? null;
}

function friendRow(friend) {
  const last = lastOf(friend);
  return {
    friendshipId: friend.friendshipId,
    name: friend.name,
    initial: friend.initial,
    preview: messagePreview(last),
    lastMessageAt: last?.createdAt ?? null,
    unread: unread(friend),
  };
}

/** Para `users:current`: lo mismo que `overview.rulesAccepted`. */
export function friendsRulesAcceptedAt() {
  return state.rulesAccepted ? now - 72 * HOUR : undefined;
}

export function friendHandlers(notify) {
  const find = (friendshipId) => state.friends.find((friend) => friend.friendshipId === friendshipId);
  const deliver = (friendshipId, message) => {
    const friend = find(friendshipId);
    if (!friend) return { status: "not_friends" };
    friend.messages.push({ id: `m${Date.now()}`, fromMe: true, createdAt: Date.now(), ...message });
    friend.readAt = Date.now();
    notify();
    return { status: "ok" };
  };

  return {
    "friends:summary": () => ({
      friends: state.friends.length,
      requests: state.requests.length,
      unread: state.friends.reduce((sum, friend) => sum + unread(friend), 0),
    }),
    "friends:overview": () => ({
      code: MY_CODE,
      rulesAccepted: state.rulesAccepted,
      suspended: false,
      requests: state.requests,
      sent: state.sent,
      friends: [...state.friends]
        .sort((a, b) => (lastOf(b)?.createdAt ?? b.acceptedAt ?? 0) - (lastOf(a)?.createdAt ?? a.acceptedAt ?? 0))
        .map(friendRow),
    }),
    "friends:blocked": () => state.blocked,
    "friends:thread": ({ friendshipId }) => {
      const friend = find(friendshipId);
      const request = state.requests.find((row) => row.friendshipId === friendshipId);
      if (!friend && !request) return null;
      const gate = state.rulesAccepted ? null : "rules_required";
      if (request) {
        return { friendshipId, status: "pending", requestedByMe: false, friend: person(request.name), friendReadAt: null, canWrite: false, gate, messages: [] };
      }
      return {
        friendshipId,
        status: "accepted",
        requestedByMe: false,
        friend: { name: friend.name, initial: friend.initial },
        friendReadAt: friend.friendReadAt,
        canWrite: gate === null,
        gate,
        messages: friend.messages,
      };
    },
    "friends:previewByCode": ({ code }) => {
      const match = CODES[code];
      if (match === "self") return { status: "self" };
      if (!match) return { status: "not_found" };
      return { status: "ok", ...match, code, relation: "none" };
    },
    "friends:versePreview": (args) => verseFor(args.book, args.chapter, args.verse, args.verseEnd),
    "friends:acceptRules": () => {
      state.rulesAccepted = true;
      notify();
      return { acceptedAt: Date.now() };
    },
    "friends:request": ({ code }) => {
      if (CODES[code] === "self") return { status: "self" };
      if (!CODES[code]) return { status: "not_found" };
      return { status: "sent", friendshipId: "s2" };
    },
    "friends:accept": ({ friendshipId }) => {
      const request = state.requests.find((row) => row.friendshipId === friendshipId);
      if (!request) return { status: "not_found" };
      state.requests = state.requests.filter((row) => row !== request);
      state.friends.unshift({ ...request, readAt: Date.now(), friendReadAt: null, messages: [], acceptedAt: Date.now() });
      notify();
      return { status: "ok" };
    },
    "friends:remove": ({ friendshipId }) => {
      state.friends = state.friends.filter((row) => row.friendshipId !== friendshipId);
      state.requests = state.requests.filter((row) => row.friendshipId !== friendshipId);
      state.sent = state.sent.filter((row) => row.friendshipId !== friendshipId);
      notify();
      return { removed: true };
    },
    "friends:block": ({ friendshipId }) => {
      const friend = find(friendshipId);
      if (!friend) return { blocked: false };
      state.friends = state.friends.filter((row) => row !== friend);
      state.blocked.push({ blockId: `b${Date.now()}`, name: friend.name, initial: friend.initial });
      notify();
      return { blocked: true };
    },
    "friends:unblock": ({ blockId }) => {
      state.blocked = state.blocked.filter((row) => row.blockId !== blockId);
      notify();
      return { unblocked: true };
    },
    "friends:report": () => ({ status: "ok" }),
    "friends:markRead": ({ friendshipId }) => {
      const friend = find(friendshipId);
      if (friend && unread(friend) > 0) {
        friend.readAt = Date.now();
        notify();
      }
      return null;
    },
    "friends:sendText": ({ friendshipId, text }) => {
      const clean = text.trim();
      if (!clean) return { status: "empty" };
      if (!checkMessageContent(clean).ok) return { status: "offensive" };
      return deliver(friendshipId, { kind: "text", text: clean });
    },
    "friends:sendVerse": (args) => {
      const verse = verseFor(args.book, args.chapter, args.verse, args.verseEnd);
      if (!verse) return { status: "verse_not_found" };
      return deliver(args.friendshipId, { kind: "verse", verse });
    },
  };
}
