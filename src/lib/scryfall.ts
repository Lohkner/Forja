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

/** Busca las cartas por nombre. Devuelve un mapa indexado por cardKey(nombre pedido). */
export async function fetchCards(
  names: string[],
  onProgress?: (done: number, total: number) => void,
  fetchImpl: typeof fetch = fetch,
): Promise<FetchResult> {
  const cache = typeof localStorage === "undefined" ? {} : readCache();
  const now = Date.now();
  const cards = new Map<string, CardData>();
  const missing: string[] = [];

  for (const n of names) {
    const hit = cache[cardKey(n)];
    if (hit && now - hit.at < CACHE_TTL_MS) cards.set(cardKey(n), hit.card);
    else missing.push(n);
  }

  const notFound: string[] = [];
  for (let i = 0; i < missing.length; i += BATCH) {
    const chunk = missing.slice(i, i + BATCH);
    const res = await fetchImpl(`${API}/cards/collection`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ identifiers: chunk.map((name) => ({ name: name.split(" // ")[0] })) }),
    });
    if (!res.ok) throw new Error(`Scryfall respondió ${res.status}`);
    const body = (await res.json()) as { data: ScryfallCard[]; not_found?: { name: string }[] };

    // Scryfall no garantiza el orden: se empareja por nombre (incluida la cara frontal).
    const byName = new Map<string, ScryfallCard>();
    for (const c of body.data) {
      byName.set(cardKey(c.name), c);
      c.card_faces?.forEach((f) => byName.set(cardKey(f.name), c));
    }
    for (const n of chunk) {
      const sc = byName.get(cardKey(n));
      if (sc) {
        const card = normalizeCard(sc);
        cards.set(cardKey(n), card);
        cache[cardKey(n)] = { at: now, card };
      } else notFound.push(n);
    }
    onProgress?.(Math.min(i + BATCH, missing.length), missing.length);
    if (i + BATCH < missing.length) await sleep(100);
  }

  if (missing.length && typeof localStorage !== "undefined") writeCache(cache);
  return { cards, notFound };
}

/** Autocompletado de nombres (para el buscador de comandante). */
export async function autocomplete(q: string): Promise<string[]> {
  if (q.trim().length < 2) return [];
  const res = await fetch(`${API}/cards/autocomplete?q=${encodeURIComponent(q)}`);
  if (!res.ok) return [];
  const body = (await res.json()) as { data: string[] };
  return body.data;
}
