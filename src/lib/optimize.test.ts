import { describe, expect, it } from "vitest";
import { analyzeDeck } from "./analyze";
import { applyChanges, optimizeDeck } from "./optimize";
import { cardKey, parseDeckList } from "./parse";
import { STAPLES } from "./staples";
import type { CardData } from "./types";

const card = (p: Partial<CardData> & { name: string }): CardData => ({
  cmc: 0, manaCost: "", typeLine: "", types: [], oracleText: "", colorIdentity: [], producedMana: [],
  gameChanger: false, legalCommander: true, ...p,
});

/** Construye datos y lista a partir de [cantidad, carta]. */
function build(rows: Array<[number, CardData, boolean?]>) {
  const data = new Map(rows.map(([, c]) => [cardKey(c.name), c]));
  const list = rows.map(([q, c, cmdr]) => `${q} ${c.name}${cmdr ? " *CMDR*" : ""}`).join("\n");
  const analyze = (text: string) => analyzeDeck(parseDeckList(text).entries, data, []);
  return { list, analyze, data };
}

const krenko = card({ name: "Krenko, Mob Boss", cmc: 4, manaCost: "{2}{R}{R}", typeLine: "Legendary Creature — Goblin", types: ["Creature"], colorIdentity: ["R"] });
const mountain = card({ name: "Mountain", typeLine: "Basic Land — Mountain", types: ["Land"], producedMana: ["R"] });
const goblin = (i: number, cmc: number) =>
  card({ name: `Goblin Filler ${i}`, cmc, manaCost: `{${cmc - 1}}{R}`, typeLine: "Creature — Goblin", types: ["Creature"], colorIdentity: ["R"] });

describe("optimizeDeck", () => {
  // 1 comandante + 30 tierras + 2 copias de un goblin + 1 carta azul + 66 de relleno = 100
  const filler = Array.from({ length: 66 }, (_, i) => goblin(i, 2 + (i % 6)));
  const dupe = goblin(999, 3);
  const blue = card({ name: "Counterspell", cmc: 2, manaCost: "{U}{U}", types: ["Instant"], oracleText: "Counter target spell.", colorIdentity: ["U"] });
  const { list, analyze, data } = build([[1, krenko, true], [30, mountain], [2, dupe], [1, blue], ...filler.map((c) => [1, c] as [number, CardData])]);
  const a = analyze(list);
  const plan = optimizeDeck(a);

  it("parte de un mazo de 100", () => expect(a.total).toBe(100));

  it("quita primero la copia repetida y la carta fuera de color", () => {
    const outs = plan.changes.map((c) => c.out?.name);
    expect(outs).toContain(dupe.name);
    expect(outs).toContain("Counterspell");
    expect(plan.changes[0].category).toBe("legal");
  });

  it("solo sugiere cartas de la identidad del comandante y que no están en el mazo", () => {
    const ins = plan.changes.flatMap((c) => (c.in ? [c.in.name] : []));
    expect(ins.length).toBeGreaterThan(0);
    for (const name of ins) {
      if (name === "Mountain") continue;
      const s = STAPLES.find((x) => x.name === name);
      expect(s, name).toBeDefined();
      expect([...s!.ci].every((c) => c === "R"), `${name} (${s!.ci})`).toBe(true);
    }
    expect(new Set(ins.filter((n) => n !== "Mountain")).size).toBe(ins.filter((n) => n !== "Mountain").length);
  });

  it("mete ramp, robo, removal, barridos y tierras", () => {
    const roles = new Set(plan.changes.flatMap((c) => (c.in ? [STAPLES.find((s) => s.name === c.in!.name)?.role ?? "land"] : [])));
    for (const r of ["ramp", "draw", "removal", "wipe", "land"]) expect(roles, r).toContain(r);
  });

  it("mantiene el mazo en 100 cartas y lo deja más cerca de los mínimos", () => {
    expect(plan.metrics.find((m) => m.label === "Cartas")?.after).toBe(100);
    for (const m of plan.metrics.filter((m) => m.label !== "Cartas")) expect(m.after, m.label).toBeGreaterThanOrEqual(m.before);
  });

  it("nunca corta el comandante ni tierras para hacer hueco", () => {
    for (const c of plan.changes.filter((x) => x.category !== "legal" && x.out)) {
      expect(c.out!.name).not.toBe(krenko.name);
      expect(c.out!.name.startsWith("Goblin Filler")).toBe(true);
    }
  });

  it("applyChanges produce una lista de 100 cartas válida", () => {
    const next = applyChanges(list, plan.changes);
    const parsed = parseDeckList(next).entries;
    expect(parsed.reduce((s, e) => s + e.qty, 0)).toBe(100);
    expect(parsed.find((e) => e.name === dupe.name)?.qty).toBe(1);
    expect(parsed.some((e) => e.name === "Counterspell")).toBe(false);
    expect(parsed.find((e) => e.isCommander)?.name).toBe(krenko.name);
    // Las cartas nuevas no tienen datos en el mapa de prueba, pero la lista es consistente.
    expect(data.has(cardKey(krenko.name))).toBe(true);
  });

  it("aplicar solo algunos cambios deja el resto igual", () => {
    const one = plan.changes.filter((c) => c.out && c.in).slice(0, 1);
    const next = parseDeckList(applyChanges(list, one)).entries;
    expect(next.reduce((s, e) => s + e.qty, 0)).toBe(100);
    expect(next.some((e) => e.name === one[0].in!.name)).toBe(true);
  });
});

describe("optimizeDeck con un mazo que ya cumple", () => {
  const ramp = Array.from({ length: 11 }, (_, i) => card({ name: `Rock ${i}`, cmc: 2, types: ["Artifact"], oracleText: "{T}: Add {R}.", producedMana: ["R"] }));
  const draw = Array.from({ length: 11 }, (_, i) => card({ name: `Draw ${i}`, cmc: 3, types: ["Sorcery"], oracleText: "Draw three cards.", colorIdentity: ["R"] }));
  const kill = Array.from({ length: 9 }, (_, i) => card({ name: `Bolt ${i}`, cmc: 1, types: ["Instant"], oracleText: "Bolt deals 3 damage to any target.", colorIdentity: ["R"] }));
  const wipe = Array.from({ length: 3 }, (_, i) => card({ name: `Sweep ${i}`, cmc: 4, types: ["Sorcery"], oracleText: "Sweep deals 5 damage to each creature.", colorIdentity: ["R"] }));
  const rest = Array.from({ length: 30 }, (_, i) => goblin(i, 3));
  const rows: Array<[number, CardData, boolean?]> = [[1, krenko, true], [35, mountain], ...[...ramp, ...draw, ...kill, ...wipe, ...rest].map((c) => [1, c] as [number, CardData])];
  const { list, analyze } = build(rows);
  const a = analyze(list);

  it("no propone cambios", () => {
    expect(a.total).toBe(100);
    const plan = optimizeDeck(a);
    expect(plan.changes).toEqual([]);
    expect(plan.notes.join(" ")).toMatch(/ya cumple/);
  });
});

describe("optimizeDeck en un mazo de dos colores con sinergias", () => {
  // Comandante negro-verde de sacrificio, 15 de ramp (sobran 3), poco robo y removal.
  const baba = card({
    name: "Test Witch", cmc: 4, manaCost: "{2}{B}{G}", typeLine: "Legendary Creature — Human Warlock", types: ["Creature"], colorIdentity: ["B", "G"],
    oracleText: "{T}, Sacrifice up to three permanents: each opponent loses 3 life.",
  });
  const swamp = card({ name: "Swamp", typeLine: "Basic Land — Swamp", types: ["Land"], producedMana: ["B"] });
  const forest = card({ name: "Forest", typeLine: "Basic Land — Forest", types: ["Land"], producedMana: ["G"] });
  const ramp = Array.from({ length: 15 }, (_, i) => card({ name: `Elf ${i}`, cmc: 1 + (i % 4), types: ["Creature"], oracleText: "{T}: Add {G}.", producedMana: ["G"], colorIdentity: ["G"] }));
  const sac = Array.from({ length: 20 }, (_, i) => card({ name: `Altar ${i}`, cmc: 6, types: ["Artifact"], oracleText: "Sacrifice a creature: Scry 1.", colorIdentity: [] }));
  const vanilla = Array.from({ length: 28 }, (_, i) => card({ name: `Bear ${i}`, cmc: 2, typeLine: "Creature — Bear", types: ["Creature"], colorIdentity: ["G"] }));
  const rows: Array<[number, CardData, boolean?]> = [[1, baba, true], [18, swamp], [18, forest], ...[...ramp, ...sac, ...vanilla].map((c) => [1, c] as [number, CardData])];
  const { list, analyze } = build(rows);
  const a = analyze(list);
  const plan = optimizeDeck(a);
  const ins = plan.changes.flatMap((c) => (c.in ? [c.in.name] : []));
  const outs = plan.changes.flatMap((c) => (c.out ? [c.out.name] : []));

  it("sugiere cartas de los dos colores y bicolores, no solo del primero", () => {
    const cis = new Set(ins.map((n) => STAPLES.find((s) => s.name === n)?.ci));
    expect(cis).toContain("B");
    expect(cis).toContain("G");
    expect(cis).toContain("BG");
  });

  it("corta primero el ramp que sobra, de mayor coste", () => {
    expect(outs.slice(0, 3).every((n) => n.startsWith("Elf"))).toBe(true);
    expect(outs.filter((n) => n.startsWith("Elf")).length).toBe(3);
  });

  it("protege las cartas que comparten mecánica con el comandante", () => {
    // Las «Altar» cuestan 6 pero son de sacrificio: se cortan antes los osos sin sinergia.
    expect(outs.some((n) => n.startsWith("Bear"))).toBe(true);
    expect(outs.some((n) => n.startsWith("Altar"))).toBe(false);
  });
});

describe("optimizeDeck en un mazo tribal", () => {
  // Krenko con 20 Goblins, Coat of Arms (tribal genérica, coste 5) y 20 osos sin sinergia; falta robo.
  const krenkoReal = card({
    ...krenko,
    oracleText: "{T}: Create X 1/1 red Goblin creature tokens, where X is the number of Goblins you control.",
  });
  const coat = card({
    name: "Coat of Arms", cmc: 5, manaCost: "{5}", typeLine: "Artifact", types: ["Artifact"],
    oracleText: "Each creature gets +1/+1 for each other creature on the battlefield that shares at least one creature type with it.",
  });
  const warcry = card({ name: "Goblin Warchief Test", cmc: 3, typeLine: "Enchantment", types: ["Enchantment"], colorIdentity: ["R"], oracleText: "Goblins you control have haste." });
  const goblins = Array.from({ length: 20 }, (_, i) => goblin(i, 2 + (i % 3)));
  const bears = Array.from({ length: 20 }, (_, i) => card({ name: `Bear ${i}`, cmc: 2, typeLine: "Creature — Bear", types: ["Creature"], colorIdentity: ["R"] }));
  const fill = [
    ...Array.from({ length: 11 }, (_, i) => card({ name: `Rock ${i}`, cmc: 2, types: ["Artifact"], oracleText: "{T}: Add {R}.", producedMana: ["R"] })),
    ...Array.from({ length: 9 }, (_, i) => card({ name: `Bolt ${i}`, cmc: 1, types: ["Instant"], oracleText: "Bolt deals 3 damage to any target.", colorIdentity: ["R"] })),
    ...Array.from({ length: 2 }, (_, i) => card({ name: `Sweep ${i}`, cmc: 4, types: ["Sorcery"], oracleText: "Sweep deals 5 damage to each creature.", colorIdentity: ["R"] })),
  ];
  const rows: Array<[number, CardData, boolean?]> = [[1, krenkoReal, true], [35, mountain], [1, coat], [1, warcry], ...[...goblins, ...bears].map((c) => [1, c] as [number, CardData]), ...fill.map((c) => [1, c] as [number, CardData])];
  const { list, analyze } = build(rows);
  const a = analyze(list);
  const plan = optimizeDeck(a);
  const outs = plan.changes.flatMap((c) => (c.out ? [c.out.name] : []));

  it("detecta la tribu Goblin", async () => {
    const { detectTribes } = await import("./optimize");
    expect(detectTribes(a)).toEqual(["Goblin"]);
  });

  it("no corta Coat of Arms, ni cartas que nombran la tribu, ni Goblins antes que los osos", () => {
    expect(a.total).toBe(100);
    expect(outs.length).toBeGreaterThan(0);
    expect(outs).not.toContain("Coat of Arms");
    expect(outs).not.toContain(warcry.name);
    expect(outs.every((n) => n.startsWith("Bear")), outs.join(", ")).toBe(true);
  });
});
