import { cardKey } from "./parse";
import { classifyRoles } from "./roles";
import type { CardData, Color, DeckCard, ManaColor, ParsedEntry, Role } from "./types";

export const COLORS: Color[] = ["W", "U", "B", "R", "G"];

/** Cartas que permiten más de una copia en Commander. */
const MULTI_OK =
  /^(relentless rats|shadowborn apostle|persistent petitioners|rat colony|dragon's approach|seven dwarves|templar knight|slime against humanity|hare apparent|nazg[uû]l|tempest hawk|cid, timeless artificer)$/i;

const BASIC_NAMES = new Set(["plains", "island", "swamp", "mountain", "forest", "wastes"]);
const isBasic = (c: { name: string; typeLine: string }) =>
  /Basic/.test(c.typeLine) || BASIC_NAMES.has(c.name.toLowerCase().replace(/^snow-covered /, ""));

export interface Analysis {
  cards: DeckCard[];
  commanders: DeckCard[];
  colorIdentity: Color[];
  total: number;
  lands: number;
  nonlandCount: number;
  avgCmc: number;
  curve: number[]; // índices 0..7 (7 = 7+)
  types: Record<string, number>;
  roles: Record<Role, number>;
  pipDemand: Record<Color, number>;
  landSources: Record<ManaColor, number>;
  rocks: number;
  duplicates: DeckCard[];
  offColor: DeckCard[];
  illegal: DeckCard[];
  notFound: string[];
  gameChangers: DeckCard[];
  priceEur: number;
  priceUsd: number;
}

export function primaryType(c: { types: string[] }): string {
  if (c.types.includes("Land")) return "Land";
  if (c.types.includes("Creature")) return "Creature";
  return c.types[0] ?? "Other";
}

export function analyzeDeck(
  entries: ParsedEntry[],
  data: Map<string, CardData>,
  notFound: string[],
  commanderName?: string,
): Analysis {
  const cards: DeckCard[] = [];
  for (const e of entries) {
    const d = data.get(cardKey(e.name));
    if (!d) continue;
    cards.push({ ...d, qty: e.qty, isCommander: e.isCommander, roles: classifyRoles(d) });
  }

  // Comandante: el indicado por el usuario, los marcados en la lista o la primera criatura legendaria.
  if (commanderName) {
    const k = cardKey(commanderName);
    cards.forEach((c) => (c.isCommander = cardKey(c.name) === k));
  }
  let commanders = cards.filter((c) => c.isCommander);
  if (!commanders.length) {
    const first = cards.find((c) => /Legendary/.test(c.typeLine) && (c.types.includes("Creature") || /can be your commander/i.test(c.oracleText)));
    if (first) {
      first.isCommander = true;
      commanders = [first];
    }
  }

  const ci = new Set<Color>(commanders.flatMap((c) => c.colorIdentity));
  const isLand = (c: DeckCard) => c.types.includes("Land");
  const sum = (xs: DeckCard[]) => xs.reduce((s, c) => s + c.qty, 0);

  const nonland = cards.filter((c) => !isLand(c));
  const total = sum(cards) + notFound.length;
  const lands = sum(cards.filter(isLand));
  const nonlandCount = sum(nonland);
  const avgCmc = nonlandCount ? nonland.reduce((s, c) => s + c.cmc * c.qty, 0) / nonlandCount : 0;

  const curve = Array(8).fill(0) as number[];
  nonland.filter((c) => !c.isCommander).forEach((c) => (curve[Math.min(7, Math.floor(c.cmc))] += c.qty));

  const types: Record<string, number> = {};
  cards.forEach((c) => (types[primaryType(c)] = (types[primaryType(c)] ?? 0) + c.qty));

  const roles = {} as Record<Role, number>;
  (["ramp", "fastmana", "draw", "removal", "wipe", "tutor", "protection", "wincon", "extraturn", "mld", "recursion"] as Role[]).forEach(
    (r) => (roles[r] = sum(cards.filter((c) => c.roles.includes(r)))),
  );

  const pipDemand: Record<Color, number> = { W: 0, U: 0, B: 0, R: 0, G: 0 };
  for (const c of nonland) {
    for (const sym of c.manaCost.match(/\{[^}]+\}/g) ?? []) {
      const inner = sym.slice(1, -1);
      const hits = COLORS.filter((col) => inner.includes(col));
      hits.forEach((col) => (pipDemand[col] += c.qty / hits.length));
    }
  }

  const landSources: Record<ManaColor, number> = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };
  cards.filter(isLand).forEach((c) => c.producedMana.forEach((m) => (landSources[m] += c.qty)));
  const rocks = sum(nonland.filter((c) => c.producedMana.length > 0));

  const duplicates = cards.filter((c) => c.qty > 1 && !isBasic(c) && !MULTI_OK.test(c.name) && !/A deck can have any number/i.test(c.oracleText));
  const offColor = ci.size ? cards.filter((c) => c.colorIdentity.some((x) => !ci.has(x))) : [];
  const illegal = cards.filter((c) => !c.legalCommander);
  const gameChangers = cards.filter((c) => c.gameChanger);
  const priceEur = cards.reduce((s, c) => s + (c.priceEur ?? 0) * c.qty, 0);
  const priceUsd = cards.reduce((s, c) => s + (c.priceUsd ?? 0) * c.qty, 0);

  return {
    cards,
    commanders,
    colorIdentity: COLORS.filter((c) => ci.has(c)),
    total,
    lands,
    nonlandCount,
    avgCmc,
    curve,
    types,
    roles,
    pipDemand,
    landSources,
    rocks,
    duplicates,
    offColor,
    illegal,
    notFound,
    gameChangers,
    priceEur,
    priceUsd,
  };
}

export type Level = "ok" | "warn" | "bad" | "info";
export interface Check {
  level: Level;
  title: string;
  detail: string;
}

/** Rango de tierras recomendado según el CMC medio y el ramp. */
export function recommendedLands(avgCmc: number, ramp: number): [number, number] {
  let lo = avgCmc > 3.4 ? 37 : avgCmc < 2.6 ? 32 : 35;
  if (ramp >= 14) lo -= 1;
  return [lo, lo + 3];
}

export function healthChecks(a: Analysis): Check[] {
  const out: Check[] = [];
  out.push(
    a.total === 100
      ? { level: "ok", title: `Tamaño: ${a.total} cartas`, detail: "Exactamente 100, comandante incluido." }
      : { level: "bad", title: `Tamaño: ${a.total} cartas`, detail: `Commander exige 100 cartas exactas (te ${a.total > 100 ? `sobran ${a.total - 100}` : `faltan ${100 - a.total}`}).` },
  );

  const [lo, hi] = recommendedLands(a.avgCmc, a.roles.ramp);
  const mid = (lo + hi) / 2;
  out.push({
    level: a.lands >= lo && a.lands <= hi ? "ok" : Math.abs(a.lands - mid) <= 4 ? "warn" : "bad",
    title: `Tierras: ${a.lands}`,
    detail: `Con CMC medio ${a.avgCmc.toFixed(2)} y ${a.roles.ramp} de ramp se recomiendan ${lo}–${hi}.`,
  });

  const target = (role: Role, min: number, max: number, label: string, tip: string) => {
    const v = a.roles[role];
    out.push({
      level: v >= min ? "ok" : v >= min - 3 ? "warn" : "bad",
      title: `${label}: ${v}`,
      detail: v >= min ? `Dentro del rango recomendado (${min}–${max}).` : `Se recomiendan ${min}–${max}. ${tip}`,
    });
  };
  target("ramp", 10, 12, "Ramp", "El ramp acelera tu plan y compensa manos flojas.");
  target("draw", 10, 12, "Robo", "Sin robo te quedas sin recursos a mitad de partida.");
  target("removal", 8, 10, "Removal puntual", "Necesitas respuestas a las amenazas de la mesa.");
  target("wipe", 2, 4, "Barridos", "Sirven para resetear la mesa cuando vas detrás.");

  if (a.duplicates.length)
    out.push({ level: "bad", title: "Copias repetidas", detail: `${a.duplicates.map((c) => `${c.name} ×${c.qty}`).join(", ")}. Commander es singleton.` });
  if (a.offColor.length)
    out.push({ level: "bad", title: "Fuera de la identidad de color", detail: a.offColor.map((c) => c.name).join(", ") });
  if (a.illegal.length)
    out.push({ level: "bad", title: "No legales en Commander", detail: a.illegal.map((c) => c.name).join(", ") });
  if (a.notFound.length)
    out.push({ level: "info", title: "Cartas no encontradas", detail: `${a.notFound.join(", ")}. Revisa la ortografía (nombre en inglés).` });
  if (!a.commanders.length)
    out.push({ level: "warn", title: "Sin comandante", detail: "Marca tu comandante con *CMDR* o escríbelo en el campo Comandante." });
  return out;
}
