import { describe, expect, it } from "vitest";
import { analyzeDeck, healthChecks } from "./analyze";
import { estimateBracket } from "./bracket";
import { cardKey } from "./parse";
import { classifyRoles } from "./roles";
import type { CardData } from "./types";

const card = (p: Partial<CardData> & { name: string }): CardData => ({
  cmc: 0, manaCost: "", typeLine: "", types: [], oracleText: "", colorIdentity: [], producedMana: [],
  gameChanger: false, legalCommander: true, ...p,
});

describe("classifyRoles", () => {
  it.each([
    ["Arcane Signet", "{T}: Add one mana of any color in your commander's color identity.", ["Artifact"], "ramp"],
    ["Cultivate", "Search your library for up to two basic land cards, reveal those cards, put one onto the battlefield tapped and the other into your hand.", ["Sorcery"], "ramp"],
    ["Harmonize", "Draw three cards.", ["Sorcery"], "draw"],
    ["Swords to Plowshares", "Exile target creature. Its controller gains life equal to its power.", ["Instant"], "removal"],
    ["Blasphemous Act", "This spell costs {1} less to cast for each creature on the battlefield.\nBlasphemous Act deals 13 damage to each creature.", ["Sorcery"], "wipe"],
    ["Demonic Tutor", "Search your library for a card, put that card into your hand, then shuffle.", ["Sorcery"], "tutor"],
    ["Time Warp", "Target player takes an extra turn after this one.", ["Sorcery"], "extraturn"],
    ["Armageddon", "Destroy all lands.", ["Sorcery"], "mld"],
    ["Living Death", "Each player exiles all creature cards from their graveyard, then sacrifices all creatures they control, then puts all cards they exiled this way onto the battlefield.", ["Sorcery"], "recursion"],
  ])("%s → %s", (name, oracleText, types, role) => {
    expect(classifyRoles(card({ name, oracleText, types }))).toContain(role);
  });

  it("no cuenta las tierras básicas como ramp", () => {
    expect(classifyRoles(card({ name: "Mountain", types: ["Land"], oracleText: "({T}: Add {R}.)" }))).toEqual([]);
  });
});

describe("analyzeDeck", () => {
  const data = new Map<string, CardData>([
    [cardKey("Krenko, Mob Boss"), card({ name: "Krenko, Mob Boss", cmc: 4, manaCost: "{2}{R}{R}", typeLine: "Legendary Creature — Goblin Warrior", types: ["Creature"], colorIdentity: ["R"] })],
    [cardKey("Sol Ring"), card({ name: "Sol Ring", cmc: 1, manaCost: "{1}", types: ["Artifact"], oracleText: "{T}: Add {C}{C}.", producedMana: ["C"], gameChanger: true })],
    [cardKey("Counterspell"), card({ name: "Counterspell", cmc: 2, manaCost: "{U}{U}", types: ["Instant"], oracleText: "Counter target spell.", colorIdentity: ["U"] })],
    [cardKey("Mountain"), card({ name: "Mountain", typeLine: "Basic Land — Mountain", types: ["Land"], producedMana: ["R"] })],
  ]);
  const a = analyzeDeck(
    [
      { name: "Krenko, Mob Boss", qty: 1, isCommander: false },
      { name: "Sol Ring", qty: 2, isCommander: false },
      { name: "Counterspell", qty: 1, isCommander: false },
      { name: "Mountain", qty: 30, isCommander: false },
    ],
    data,
    ["Carta Inventada"],
  );

  it("detecta el comandante, el color y los totales", () => {
    expect(a.commanders.map((c) => c.name)).toEqual(["Krenko, Mob Boss"]);
    expect(a.colorIdentity).toEqual(["R"]);
    expect(a.total).toBe(35);
    expect(a.lands).toBe(30);
    expect(a.landSources.R).toBe(30);
    expect(a.pipDemand.R).toBe(2);
  });

  it("marca copias, colores fuera de identidad y cartas no encontradas", () => {
    expect(a.duplicates.map((c) => c.name)).toEqual(["Sol Ring"]);
    expect(a.offColor.map((c) => c.name)).toEqual(["Counterspell"]);
    const titles = healthChecks(a).map((c) => c.title);
    expect(titles).toContain("Cartas no encontradas");
  });

  it("estima bracket 3 con un Game Changer", () => {
    expect(estimateBracket(a).bracket).toBe(3);
  });
});
