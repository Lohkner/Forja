import { describe, expect, it } from "vitest";
import { cardKey, cleanCardName, listToText, parseDeckList } from "./parse";

describe("parseDeckList", () => {
  it("lee cantidades, ediciones y marcadores", () => {
    const { entries } = parseDeckList(`1 Krenko, Mob Boss *CMDR*
1x Sol Ring (CMM) 410 *F*
Lightning Bolt
30 Mountain`);
    expect(entries).toEqual([
      { name: "Krenko, Mob Boss", qty: 1, isCommander: true },
      { name: "Sol Ring", qty: 1, isCommander: false, set: "cmm", cn: "410" },
      { name: "Lightning Bolt", qty: 1, isCommander: false },
      { name: "Mountain", qty: 30, isCommander: false },
    ]);
  });

  it("usa las secciones de Commander e ignora el sideboard", () => {
    const { entries } = parseDeckList(`Commander
1 Atraxa, Praetors' Voice

Deck
1 Sol Ring

Sideboard
1 Swords to Plowshares`);
    expect(entries.map((e) => e.name)).toEqual(["Atraxa, Praetors' Voice", "Sol Ring"]);
    expect(entries[0].isCommander).toBe(true);
  });

  it("suma líneas repetidas", () => {
    const { entries } = parseDeckList("1 Abrade\n1 Abrade");
    expect(entries).toEqual([{ name: "Abrade", qty: 2, isCommander: false }]);
  });

  it("normaliza claves de cartas de doble cara y tildes", () => {
    expect(cardKey("Valakut Awakening // Valakut Stoneforge")).toBe("valakut awakening");
    expect(cardKey("Lim-Dûl's Vault")).toBe("lim-dul's vault");
  });
});

describe("cleanCardName", () => {
  it.each([
    ["Fire/Ice", { name: "Fire // Ice", alts: [] }],
    ["Fire / Ice", { name: "Fire // Ice", alts: [] }],
    ["Fire // Ice (MH2) 290", { name: "Fire // Ice", alts: [], set: "mh2", cn: "290" }],
    ["Valakut Awakening // Valakut Stoneforge", { name: "Valakut Awakening // Valakut Stoneforge", alts: [] }],
    ["Godzilla, Doom Inevitable (Yidaro, Wandering Monster)", { name: "Godzilla, Doom Inevitable", alts: ["Yidaro, Wandering Monster"] }],
    ["Rick, Steadfast Leader (Greymond, Avacyn's Stalwart) (SLD) 1150", { name: "Rick, Steadfast Leader", alts: ["Greymond, Avacyn's Stalwart"], set: "sld", cn: "1150" }],
    ["Sol Ring (PLST) C21-263", { name: "Sol Ring", alts: [], set: "plst", cn: "C21-263" }],
    ["Lightning Bolt # el mejor", { name: "Lightning Bolt", alts: [] }],
  ])("%s", (raw, expected) => {
    expect(cleanCardName(raw)).toEqual(expected);
  });

  it("la lista reescrita conserva nombre alternativo y edición", () => {
    const text = "1 Godzilla, Doom Inevitable (Yidaro, Wandering Monster) (IKO) 364 *CMDR*";
    const { entries } = parseDeckList(text);
    expect(parseDeckList(listToText(entries)).entries).toEqual(entries);
  });
});
