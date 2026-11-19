import { cardKey } from "./parse";
import type { CardData, Color, ManaColor } from "./types";

/**
 * Cliente mínimo de la API de Scryfall (https://scryfall.com/docs/api).
 * - /cards/collection acepta hasta 75 identificadores por petición.
 * - Scryfall pide 50-100 ms entre peticiones: se respetan con una pausa.
 * - Los resultados se guardan en localStorage para no repetir peticiones.
 */
const API = "https://api.scryfall.com";
const BATCH = 75;
const CACHE_KEY = "forja-scryfall-v1";
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7; // una semana (precios incluidos)

interface ScryfallFace {
  name: string;
  mana_cost?: string;
  type_line?: string;
  oracle_text?: string;
  image_uris?: { normal?: string };
}

export interface ScryfallCard {
  name: string;
  cmc: number;
  mana_cost?: string;
  type_line: string;
  oracle_text?: string;
  color_identity: string[];
  produced_mana?: string[];
  game_changer?: boolean;
  legalities: Record<string, string>;
  image_uris?: { normal?: string };
  card_faces?: ScryfallFace[];
  prices?: { eur?: string | null; usd?: string | null };
  scryfall_uri?: string;
  set?: string;
  collector_number?: string;
}

const MAIN_TYPES = ["Creature", "Planeswalker", "Battle", "Instant", "Sorcery", "Artifact", "Enchantment", "Land"];

export function normalizeCard(c: ScryfallCard): CardData {
  const front = c.card_faces?.[0];
  const typeLine = front?.type_line ?? c.type_line;
  const frontTypes = typeLine.split("—")[0];
  const oracle = c.oracle_text ?? (c.card_faces ?? []).map((f) => f.oracle_text ?? "").join("\n//\n");
  return {
    name: c.name,
    cmc: c.cmc ?? 0,
    manaCost: c.mana_cost ?? front?.mana_cost ?? "",
    typeLine: c.type_line,
    types: MAIN_TYPES.filter((t) => frontTypes.includes(t)),
    oracleText: oracle,
    colorIdentity: c.color_identity as Color[],
    producedMana: (c.produced_mana ?? []) as ManaColor[],
    gameChanger: !!c.game_changer,
    legalCommander: c.legalities?.commander === "legal",
    image: c.image_uris?.normal ?? front?.image_uris?.normal,
    priceEur: c.prices?.eur ? Number(c.prices.eur) : undefined,
    priceUsd: c.prices?.usd ? Number(c.prices.usd) : undefined,
    scryfallUri: c.scryfall_uri,
  };
}

type Cache = Record<string, { at: number; card: CardData }>;

function readCache(): Cache {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) ?? "{}");
  } catch {
    return {};
  }
}
function writeCache(cache: Cache) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    /* lleno o no disponible: se sigue sin caché */
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface FetchResult {
  cards: Map<string, CardData>;
  notFound: string[];
}

/** Lo que sabemos de una carta de la lista para encontrarla. */
export interface CardLookup {
  name: string;
  alts?: string[];
  set?: string;
  cn?: string;
}

type Identifier = { name: string } | { set: string; collector_number: string };

/** Máximo de búsquedas aproximadas (una petición por carta) para no eternizar mazos muy rotos. */
const MAX_FUZZY = 40;

/**
 * Nombres con los que probar una carta, del más al menos probable:
 * la cara frontal, las demás caras y los nombres alternativos (con sus caras).
 * Scryfall acepta cualquier cara suelta («Fire», «Stomp») pero no «Fire // Ice» completo.
 */
export function nameCandidates(l: CardLookup): string[] {
  const out: string[] = [];
  for (const full of [l.name, ...(l.alts ?? [])]) {
    for (const face of full.split(" // ")) {
      const f = face.trim();
      if (f && !out.some((x) => cardKey(x) === cardKey(f))) out.push(f);
    }
  }
  return out;
}

/**
 * Busca las cartas en Scryfall. Devuelve un mapa indexado por cardKey(nombre en la lista).
 * Va en cascada para encontrar también cartas de doble cara, partidas y Universes Beyond / Secret Lair
 * con nombre alternativo («Godzilla, Doom Inevitable» → Yidaro, Wandering Monster):
 *   1. Edición + número de coleccionista, si la lista los trae (la impresión exacta).
 *   2. Por nombre, con la cara frontal.
 *   3. Por nombre, con las otras caras y los nombres alternativos.
 *   4. Búsqueda aproximada (/cards/named?fuzzy), que entiende nombres alternativos y erratas leves.
 */
export async function fetchCards(
  items: Array<string | CardLookup>,
  onProgress?: (done: number, total: number) => void,
  fetchImpl: typeof fetch = fetch,
): Promise<FetchResult> {
  const lookups: CardLookup[] = items.map((x) => (typeof x === "string" ? { name: x } : x));
  const cache = typeof localStorage === "undefined" ? {} : readCache();
  const now = Date.now();
  const cards = new Map<string, CardData>();
  let pending: CardLookup[] = [];

  for (const l of lookups) {
    const hit = cache[cardKey(l.name)];
    if (hit && now - hit.at < CACHE_TTL_MS) cards.set(cardKey(l.name), hit.card);
    else pending.push(l);
  }
  const total = pending.length;
  const found = (l: CardLookup, sc: ScryfallCard) => {
    const card = normalizeCard(sc);
    cards.set(cardKey(l.name), card);
    cache[cardKey(l.name)] = { at: now, card };
  };
  const progress = () => onProgress?.(total - pending.length, total);

  const collection = async (ids: Identifier[]): Promise<ScryfallCard[]> => {
    const all: ScryfallCard[] = [];
    for (let i = 0; i < ids.length; i += BATCH) {
      if (i > 0) await sleep(100);
      const res = await fetchImpl(`${API}/cards/collection`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ identifiers: ids.slice(i, i + BATCH) }),
      });
      if (!res.ok) throw new Error(`Scryfall respondió ${res.status}`);
      all.push(...((await res.json()) as { data: ScryfallCard[] }).data);
    }
    return all;
  };

  // 1. Impresión exacta.
  const withPrint = pending.filter((l) => l.set && l.cn);
  if (withPrint.length) {
    const res = await collection(withPrint.map((l) => ({ set: l.set!, collector_number: l.cn! })));
    const byPrint = new Map(res.map((c) => [`${c.set}/${c.collector_number}`.toLowerCase(), c]));
    pending = pending.filter((l) => {
      const sc = l.set && l.cn ? byPrint.get(`${l.set}/${l.cn}`.toLowerCase()) : undefined;
      if (sc) found(l, sc);
      return !sc;
    });
    progress();
  }

  // 2 y 3. Por nombre: primero la cara frontal de todas; luego, para las que falten, el resto de candidatos.
  for (const round of [0, 1]) {
    if (!pending.length) break;
    if (withPrint.length || round > 0) await sleep(100);
    const asks: Array<{ l: CardLookup; name: string }> = pending.flatMap((l) => {
      const cands = nameCandidates(l);
      return (round === 0 ? cands.slice(0, 1) : cands.slice(1)).map((name) => ({ l, name }));
    });
    if (!asks.length) continue;
    const res = await collection(asks.map((a) => ({ name: a.name })));
    // Scryfall no garantiza el orden: se empareja por nombre (completo y de cada cara).
    const byName = new Map<string, ScryfallCard>();
    for (const c of res) {
      byName.set(cardKey(c.name), c);
      c.card_faces?.forEach((f) => byName.set(cardKey(f.name), c));
    }
    pending = pending.filter((l) => {
      const hit = asks.find((a) => a.l === l && byName.has(cardKey(a.name)));
      if (hit) found(l, byName.get(cardKey(hit.name))!);
      return !hit;
    });
    progress();
  }

  // 4. Búsqueda aproximada, carta a carta.
  const fuzzyOnes = pending.slice(0, MAX_FUZZY);
  for (const l of fuzzyOnes) {
    for (const name of [l.name, ...(l.alts ?? [])]) {
      await sleep(100);
      const res = await fetchImpl(`${API}/cards/named?fuzzy=${encodeURIComponent(name)}`, { headers: { Accept: "application/json" } });
      if (res.ok) {
        found(l, (await res.json()) as ScryfallCard);
        pending = pending.filter((x) => x !== l);
        break;
      }
    }
    progress();
  }

  if (total && typeof localStorage !== "undefined") writeCache(cache);
  return { cards, notFound: pending.map((l) => l.name) };
}

/** Autocompletado de nombres (para el buscador de comandante). */
export async function autocomplete(q: string): Promise<string[]> {
  if (q.trim().length < 2) return [];
  const res = await fetch(`${API}/cards/autocomplete?q=${encodeURIComponent(q)}`);
  if (!res.ok) return [];
  const body = (await res.json()) as { data: string[] };
  return body.data;
}
