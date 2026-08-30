// Quotes stay in their original English wording rather than living in the i18n
// message files: literary quotations read best untranslated, and adding one is
// then a single line here instead of six hand-written translations.
export type HomeQuote = {
  text: string;
  attribution: string;
};

export const HOME_QUOTES: HomeQuote[] = [
  {
    text: "We read books to find out who we are.",
    attribution: "Ursula K. Le Guin",
  },
  {
    text: "A book is a heart that only beats in the chest of another.",
    attribution: "Rebecca Solnit",
  },
  {
    text: "Until I feared I would lose it, I never loved to read.",
    attribution: "Harper Lee",
  },
  {
    text: "In books I have travelled, not only to other worlds, but into my own. I learned who I was and who I wanted to be.",
    attribution: "Anna Quindlen",
  },
  {
    text: "Reading is the sole means by which we slip, involuntarily, often helplessly, into another's skin, another's voice, another's soul.",
    attribution: "Joyce Carol Oates",
  },
  {
    text: "I love the solitude of reading. I love the deep dive into someone else's story, the delicious ache of a last page.",
    attribution: "Naomi Shihab Nye",
  },
  {
    text: "Reading in another language implies a perpetual state of growth, of possibility.",
    attribution: "Jhumpa Lahiri",
  },
  {
    text: "A book must be the axe for the frozen sea within us.",
    attribution: "Franz Kafka",
  },
  {
    text: "In reading great literature I become a thousand men and yet remain myself.",
    attribution: "C. S. Lewis",
  },
  {
    text: "You learn that everyone else out there is a me, as well.",
    attribution: "Neil Gaiman",
  },
  {
    text: "Reading is a conversation. All books talk. But a good book listens as well.",
    attribution: "Mark Haddon",
  },
  {
    text: "There are worse crimes than burning books. One of them is not reading them.",
    attribution: "Joseph Brodsky",
  },
  {
    text: "You think your pain and your heartbreak are unprecedented in the history of the world, but then you read.",
    attribution: "James Baldwin",
  },
  {
    text: "Reading changed dreams into life and life into dreams.",
    attribution: "Mario Vargas Llosa",
  },
];

const MS_PER_DAY = 86_400_000;

// Deterministic PRNG (mulberry32) — a seeded shuffle needs randomness that both
// the server and the client reproduce from the same seed.
function randomFromSeed(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Each pass through the list gets its own shuffle, seeded by the pass number, so
// the order differs every cycle while still showing all quotes before repeating.
function shuffledOrder(cycle: number): number[] {
  const random = randomFromSeed(cycle);
  const order = HOME_QUOTES.map((_, index) => index);
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

// Indexed by UTC day so the server render and the client (cached home) render
// agree on the same quote without needing the viewer's timezone.
export function quoteOfTheDay(now: number = Date.now()): HomeQuote {
  const day = Math.floor(now / MS_PER_DAY);
  const cycle = Math.floor(day / HOME_QUOTES.length);
  const position = ((day % HOME_QUOTES.length) + HOME_QUOTES.length) %
    HOME_QUOTES.length;
  return HOME_QUOTES[shuffledOrder(cycle)[position]];
}
