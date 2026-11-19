import { describe, expect, it } from "vitest";
import { cardKey } from "./parse";
import { fetchCards, nameCandidates, type ScryfallCard } from "./scryfall";

const sc = (name: string, extra: Partial<ScryfallCard> = {}): ScryfallCard => ({
  name, cmc: 1, type_line: "Instant", color_identity: [], legalities: { commander: "legal" }, ...extra,
});

/** Scryfall simulado con su comportamiento real (comprobado el 2026-11-18). */
const DB: ScryfallCard[] = [
  sc("Fire // Ice", { card_faces: [{ name: "Fire" }, { name: "Ice" }] }),
  sc("Valakut Awakening // Valakut Stoneforge", { card_faces: [{ name: "Valakut Awakening" }, { name: "Valakut Stoneforge" }] }),
  sc("Yidaro, Wandering Monster", { set: "iko", collector_number: "364" }),
  sc("Greymond, Avacyn's Stalwart"),
  sc("Sol Ring", { set: "cmm", collector_number: "410" }),
];
const FLAVOR: Record<string, string> = { "godzilla, doom inevitable": "Yidaro, Wandering Monster", "rick, steadfast leader": "Greymond, Avacyn's Stalwart" };

function fakeScryfall() {
  const calls: string[] = [];
  const impl = (async (url: string, init?: RequestInit) => {
    const u = String(url);
    if (u.endsWith("/cards/collection")) {
      const ids = JSON.parse(String(init?.body)).identifiers as Array<{ name?: string; set?: string; collector_number?: string }>;
      calls.push(`collection:${ids.map((i) => i.name ?? `${i.set}/${i.collector_number}`).join("|")}`);
      const data = ids.flatMap((i) => {
        // Por nombre: solo el nombre de una cara o el de una carta de una cara; nunca «A // B» ni nombres alternativos.
        if (i.name) return DB.filter((c) => (c.card_faces ? c.card_faces.some((f) => f.name === i.name) : c.name === i.name));
        return DB.filter((c) => c.set === i.set && c.collector_number === i.collector_number);
      });
      return new Response(JSON.stringify({ data }), { status: 200 });
    }
    const fuzzy = new URL(u).searchParams.get("fuzzy") ?? "";
    calls.push(`fuzzy:${fuzzy}`);
    const real = FLAVOR[fuzzy.toLowerCase()] ?? fuzzy;
    const hit = DB.find((c) => c.name.toLowerCase() === real.toLowerCase());
    return hit ? new Response(JSON.stringify(hit), { status: 200 }) : new Response("{}", { status: 404 });
  }) as typeof fetch;
  return { impl, calls };
}

describe("nameCandidates", () => {
  it("prueba la cara frontal, las demás caras y los alternativos", () => {
    expect(nameCandidates({ name: "Godzilla, Doom Inevitable // Yidaro", alts: ["Yidaro, Wandering Monster"] })).toEqual([
      "Godzilla, Doom Inevitable", "Yidaro", "Yidaro, Wandering Monster",
    ]);
  });
});

describe("fetchCards", () => {
  it("encuentra dobles, partidas, impresiones exactas y nombres alternativos", async () => {
    const { impl, calls } = fakeScryfall();
    const { cards, notFound } = await fetchCards(
      [
        { name: "Fire // Ice" },
        { name: "Valakut Awakening // Valakut Stoneforge" },
        { name: "Godzilla, Doom Inevitable", set: "iko", cn: "364" },
        { name: "Rick, Steadfast Leader" },
        { name: "Sol Ring" },
        { name: "Carta Inventada" },
      ],
      undefined,
      impl,
    );
    expect(cards.get(cardKey("Fire // Ice"))?.name).toBe("Fire // Ice");
    expect(cards.get(cardKey("Valakut Awakening // Valakut Stoneforge"))?.name).toBe("Valakut Awakening // Valakut Stoneforge");
    expect(cards.get(cardKey("Godzilla, Doom Inevitable"))?.name).toBe("Yidaro, Wandering Monster");
    expect(cards.get(cardKey("Rick, Steadfast Leader"))?.name).toBe("Greymond, Avacyn's Stalwart");
    expect(cards.get(cardKey("Sol Ring"))?.name).toBe("Sol Ring");
    expect(notFound).toEqual(["Carta Inventada"]);
    // La impresión exacta va primero y la búsqueda aproximada solo para las que faltan.
    expect(calls[0]).toBe("collection:iko/364");
    expect(calls.filter((c) => c.startsWith("fuzzy:"))).toEqual(["fuzzy:Rick, Steadfast Leader", "fuzzy:Carta Inventada"]);
  });

  it("usa el nombre alternativo si el principal no existe", async () => {
    const { impl } = fakeScryfall();
    const { cards, notFound } = await fetchCards([{ name: "Nombre Raro", alts: ["Yidaro, Wandering Monster"] }], undefined, impl);
    expect(notFound).toEqual([]);
    expect(cards.get(cardKey("Nombre Raro"))?.name).toBe("Yidaro, Wandering Monster");
  });
});
