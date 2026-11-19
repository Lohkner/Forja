import { describe, expect, it } from "vitest";
import { cardKey, parseDeckList } from "./parse";

describe("parseDeckList", () => {
  it("lee cantidades, ediciones y marcadores", () => {
    const { entries } = parseDeckList(`1 Krenko, Mob Boss *CMDR*
1x Sol Ring (CMM) 410 *F*
Lightning Bolt
30 Mountain`);
    expect(entries).toEqual([
      { name: "Krenko, Mob Boss", qty: 1, isCommander: true },
      { name: "Sol Ring", qty: 1, isCommander: false },
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
