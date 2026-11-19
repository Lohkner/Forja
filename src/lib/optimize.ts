import { recommendedLands, type Analysis } from "./analyze";
import { cardKey, listToText, parseDeckList } from "./parse";
import { BASIC_FOR, fitsIdentity, STAPLES, type StapleRole } from "./staples";
import type { Color, DeckCard, Role } from "./types";

/**
 * Optimizador por reglas (sin IA): convierte el análisis en una lista concreta de cambios
 * «saca X → mete Y» que se puede aplicar al momento. Funciona en el navegador, también en
 * la versión estática de GitHub Pages.
 *
 * Orden de prioridad:
 *   1. Legalidad: copias repetidas, cartas fuera de color y prohibidas.
 *   2. Funciones por debajo del mínimo (ramp, robo, removal, barridos) con cartas de STAPLES.
 *   3. Número de tierras según CMC medio y ramp.
 *   4. Hueco para todo lo anterior: se cortan las cartas sin función detectada, de mayor coste primero.
 */

export type ChangeCategory = "legal" | "ramp" | "draw" | "removal" | "wipe" | "land" | "size";

export interface CardMove {
  name: string;
  reason: string;
}

export interface Change {
  id: string;
  category: ChangeCategory;
  out?: CardMove;
  in?: CardMove;
}

export interface Metric {
  label: string;
  before: number;
  after: number;
  target: string;
}

export interface OptimizationPlan {
  changes: Change[];
  metrics: Metric[];
  notes: string[];
}

/** Mínimo y máximo recomendados por función (igual que en los chequeos de salud). */
export const ROLE_TARGETS = {
  ramp: [10, 12],
  draw: [10, 12],
  removal: [8, 10],
  wipe: [2, 4],
} as const satisfies Record<string, readonly [number, number]>;
type TargetRole = keyof typeof ROLE_TARGETS;
const TARGET_ROLES = Object.keys(ROLE_TARGETS) as TargetRole[];

/** Tope de cartas a meter por función en una sola pasada, para no desfigurar el mazo. */
const MAX_ADDS: Record<TargetRole, number> = { ramp: 5, draw: 5, removal: 4, wipe: 2 };

const ROLE_ES: Record<TargetRole, string> = { ramp: "ramp", draw: "robo", removal: "removal", wipe: "barridos" };

/** Funciones que hacen que una carta no sea «relleno». */
const USEFUL_ROLES: Role[] = ["ramp", "draw", "removal", "wipe", "tutor", "protection", "wincon", "recursion"];

const isLand = (c: DeckCard) => c.types.includes("Land");
const isBasicLand = (c: DeckCard) => /Basic/.test(c.typeLine);

export function optimizeDeck(a: Analysis): OptimizationPlan {
  const notes: string[] = [];
  const identity: Color[] = a.colorIdentity.length
    ? a.colorIdentity
    : (["W", "U", "B", "R", "G"] as Color[]).filter((col) => a.cards.some((c) => c.colorIdentity.includes(col)));

  // Copias que quitamos de cada carta (cardKey → cantidad), para no contarlas dos veces.
  const removed = new Map<string, number>();
  const remaining = (c: DeckCard) => c.qty - (removed.get(cardKey(c.name)) ?? 0);
  const outs: Array<CardMove & { category: ChangeCategory }> = [];
  const takeOut = (c: DeckCard, n: number, reason: string, category: ChangeCategory) => {
    for (let i = 0; i < n && remaining(c) > 0; i++) {
      removed.set(cardKey(c.name), (removed.get(cardKey(c.name)) ?? 0) + 1);
      outs.push({ name: c.name, reason, category });
    }
  };

  // ── 1. Legalidad ───────────────────────────────────────────────────
  for (const c of a.duplicates) takeOut(c, c.qty - 1, "Commander es singleton: sobra una copia.", "legal");
  for (const c of a.offColor) if (!c.isCommander) takeOut(c, c.qty, "Está fuera de la identidad de color de tu comandante.", "legal");
  for (const c of a.illegal) if (!c.isCommander) takeOut(c, c.qty, "Está prohibida en Commander.", "legal");

  // Recuento tras las salidas obligatorias.
  const count = (pred: (c: DeckCard) => boolean) => a.cards.filter(pred).reduce((s, c) => s + remaining(c), 0);
  const roleNow = (r: Role) => count((c) => c.roles.includes(r));

  // ── 2. Funciones por debajo del mínimo ─────────────────────────────
  const inDeck = new Set(a.cards.map((c) => cardKey(c.name)));
  const picked = new Set<string>();
  const adds: Array<CardMove & { category: ChangeCategory; role: StapleRole }> = [];
  const pickStaples = (role: StapleRole, n: number, reason: string, category: ChangeCategory) => {
    // Agrupa por identidad (B, G, BG, incolora…) y va alternando entre grupos, para que un mazo
    // de varios colores reciba cartas de todos ellos y no solo del primero de la lista.
    const groups = new Map<string, string[]>();
    for (const s of STAPLES) {
      if (s.role !== role || !fitsIdentity(s.ci, identity)) continue;
      if (s.multicolorOnly && identity.length < 2) continue;
      const k = cardKey(s.name);
      if (inDeck.has(k) || picked.has(k)) continue;
      groups.set(s.ci, [...(groups.get(s.ci) ?? []), s.name]);
    }
    // Salvo en ramp (Sol Ring, Arcane Signet…), las incoloras son peores: solo entran si se acaban las de color.
    const fallback = role === "ramp" ? [] : (groups.get("") ?? []);
    if (role !== "ramp") groups.delete("");
    const take = (name: string) => {
      picked.add(cardKey(name));
      adds.push({ name, reason, category, role });
      n--;
    };
    const queues = [...groups.values()];
    while (n > 0 && queues.some((q) => q.length)) {
      for (const q of queues) {
        const name = q.shift();
        if (name && n > 0) take(name);
      }
    }
    for (const name of fallback) if (n > 0) take(name);
  };

  const deficits = TARGET_ROLES.map((r) => ({ r, need: Math.min(MAX_ADDS[r], ROLE_TARGETS[r][0] - roleNow(r)) }))
    .filter((d) => d.need > 0)
    .sort((x, y) => y.need / ROLE_TARGETS[y.r][0] - x.need / ROLE_TARGETS[x.r][0]);
  for (const { r, need } of deficits) {
    const have = roleNow(r);
    pickStaples(r, need, `Tienes ${have} de ${ROLE_ES[r]}; se recomiendan ${ROLE_TARGETS[r][0]}–${ROLE_TARGETS[r][1]}.`, r);
  }
  const addedRole = (r: StapleRole) => adds.filter((x) => x.role === r).length;

  // ── 3. Tierras ─────────────────────────────────────────────────────
  const landsNow = count(isLand);
  const [lo, hi] = recommendedLands(a.avgCmc, roleNow("ramp") + addedRole("ramp"));
  if (landsNow < lo) {
    const need = lo - landsNow;
    const reason = `Tienes ${landsNow} tierras; con CMC medio ${a.avgCmc.toFixed(2)} se recomiendan ${lo}–${hi}.`;
    pickStaples("land", need, reason, "land");
    for (let i = addedRole("land"); i < need; i++) adds.push({ name: BASIC_FOR[neediestColor(a, identity)], reason, category: "land", role: "land" });
  } else if (landsNow > hi) {
    const basics = a.cards.filter((c) => isBasicLand(c) && !c.isCommander).sort((x, y) => remaining(y) - remaining(x));
    const reason = `Tienes ${landsNow} tierras; con CMC medio ${a.avgCmc.toFixed(2)} bastan ${lo}–${hi}.`;
    let extra = landsNow - hi;
    for (const b of basics) {
      const n = Math.min(extra, remaining(b) - 1);
      takeOut(b, n, reason, "land");
      extra -= Math.max(0, n);
      if (extra <= 0) break;
    }
    if (extra > 0) notes.push(`Te sobran ${extra} tierras más, pero no son básicas: revisa cuáles aportan menos.`);
  }

  // ── 4. Hueco para lo que entra ─────────────────────────────────────
  const totalAfterOuts = a.total - outs.length;
  const room = 100 - totalAfterOuts; // > 0: faltan cartas; < 0: sobran
  const cutsNeeded = adds.length - room;

  if (cutsNeeded > 0) {
    const roleTotal = (r: TargetRole) => roleNow(r) + addedRole(r);
    const cuts = cutCandidates(a, remaining, roleTotal).slice(0, cutsNeeded);
    for (const { card, reason } of cuts) takeOut(card, 1, reason, "size");
    if (cuts.length < cutsNeeded) {
      // No hay relleno suficiente: entra solo lo que cabe, por orden de prioridad.
      const drop = cutsNeeded - cuts.length;
      adds.splice(adds.length - drop, drop);
      notes.push(`No encontré más cartas claramente prescindibles: he dejado fuera ${drop} sugerencia(s). Revisa tú qué cortar.`);
    }
  } else if (cutsNeeded < 0) {
    // Al mazo le faltan cartas incluso tras lo anterior: completa con tierras y luego robo/removal.
    let missing = -cutsNeeded;
    const fillReason = `Al mazo le faltan cartas para llegar a 100.`;
    const landsTarget = hi - (landsNow + addedRole("land"));
    for (let i = 0; i < Math.min(missing, Math.max(0, landsTarget)); i++)
      adds.push({ name: BASIC_FOR[neediestColor(a, identity)], reason: fillReason, category: "size", role: "land" });
    missing = 100 - (totalAfterOuts + adds.length);
    for (const r of ["draw", "removal", "ramp"] as const) {
      if (missing <= 0) break;
      const before = adds.length;
      pickStaples(r, missing, fillReason, "size");
      missing -= adds.length - before;
    }
    if (missing > 0) notes.push(`Aún faltan ${missing} cartas para llegar a 100.`);
  }

  // ── Emparejar salidas y entradas en cambios ────────────────────────
  const changes: Change[] = [];
  const n = Math.max(outs.length, adds.length);
  for (let i = 0; i < n; i++) {
    const o = outs[i];
    const add = adds[i];
    changes.push({
      id: `c${i}`,
      // Si la salida es obligatoria (legalidad), el cambio es de legalidad aunque traiga una entrada.
      category: o?.category === "legal" ? "legal" : (add?.category ?? o.category),
      out: o && { name: o.name, reason: o.reason },
      in: add && { name: add.name, reason: add.reason },
    });
  }

  // ── Métricas antes/después ────────────────────────────────────────
  const metrics: Metric[] = [
    { label: "Cartas", before: a.total, after: a.total - outs.length + adds.length, target: "100" },
    { label: "Tierras", before: a.lands, after: count(isLand) + addedRole("land"), target: `${lo}–${hi}` },
    ...TARGET_ROLES.map((r) => ({
      label: ROLE_ES[r][0].toUpperCase() + ROLE_ES[r].slice(1),
      before: a.roles[r],
      after: roleNow(r) + addedRole(r),
      target: `${ROLE_TARGETS[r][0]}–${ROLE_TARGETS[r][1]}`,
    })),
  ];

  if (!changes.length) notes.push("Tu mazo ya cumple todos los mínimos: no hay cambios urgentes. Afina según tu plan de juego.");
  if (a.avgCmc > 3.6) notes.push(`El CMC medio (${a.avgCmc.toFixed(2)}) es alto: considera cambiar alguna carta de 6+ por otra más barata con la misma función.`);
  if (changes.some((c) => c.out && c.category === "size"))
    notes.push("Los cortes se eligen entre cartas sin función detectada; si alguna es clave para tu estrategia (sinergia, tribu, combo), desmárcala.");
  return { changes, metrics, notes };
}

/** Mecánicas que, si aparecen en el comandante, hacen valiosas a las cartas que también las usan. */
const THEMES: Record<string, RegExp> = {
  sacrificio: /\bsacrific/i,
  fichas: /\bcreates? [^.]*\btokens?\b/i,
  contadores: /\+1\/\+1 counters?/i,
  cementerio: /\bgraveyards?\b/i,
  artefactos: /\bartifacts?\b/i,
  encantamientos: /\benchantments?\b/i,
  hechizos: /\b(instant or sorcery|noncreature spell)/i,
  vidas: /\bgains? \d* ?life\b|\blifelink\b/i,
  tierras: /\blandfall\b|\bland (card )?enters\b/i,
  ataque: /\bwhenever [^.]* attacks?\b|\bcombat damage to a player\b/i,
};

const pct = (c: DeckCard) => c.priceEur ?? c.priceUsd ?? 0;

interface CutCandidate {
  card: DeckCard;
  reason: string;
}

/**
 * Cartas que se pueden cortar para hacer hueco, de más a menos prescindible:
 *   1. Las que solo aportan funciones que ya van sobradas (p. ej. el ramp 13.º), la de mayor coste primero.
 *   2. Las que no tienen ninguna función de apoyo, empezando por las que menos encajan con el comandante
 *      (mecánicas o tipo de criatura en común) y, a igualdad, por las más caras de lanzar.
 */
function cutCandidates(a: Analysis, remaining: (c: DeckCard) => number, roleTotal: (r: TargetRole) => number): CutCandidate[] {
  const eligible = a.cards.filter((c) => !c.isCommander && !isLand(c) && !c.gameChanger && remaining(c) > 0);
  const out: CutCandidate[] = [];

  // 1. Excedentes de función.
  const surplus = new Map(TARGET_ROLES.map((r) => [r, Math.max(0, roleTotal(r) - ROLE_TARGETS[r][1])]));
  // Una carta es excedente si todas sus funciones útiles siguen sobrando (se recalcula al ir cortando).
  const usefulRoles = (c: DeckCard) => c.roles.filter((r) => USEFUL_ROLES.includes(r));
  const inSurplus = (r: Role) => (surplus.get(r as TargetRole) ?? 0) > 0;
  const bySurplusOrder = [...eligible].sort((x, y) => y.cmc - x.cmc || pct(x) - pct(y));
  for (const c of bySurplusOrder) {
    const useful = usefulRoles(c);
    if (!useful.length || !useful.every(inSurplus)) continue;
    const r = useful[0] as TargetRole;
    out.push({ card: c, reason: `Te sobra ${ROLE_ES[r]} (${roleTotal(r)}, máximo recomendado ${ROLE_TARGETS[r][1]}); esta es de las más caras de lanzar.` });
    useful.forEach((x) => surplus.set(x as TargetRole, (surplus.get(x as TargetRole) ?? 0) - 1));
  }

  // 2. Sin función, ordenadas por sinergia con el comandante.
  const cmdrText = a.commanders.map((c) => c.oracleText).join("\n");
  const themes = Object.entries(THEMES).filter(([, rx]) => rx.test(cmdrText));
  const subtypes = new Set(a.commanders.flatMap((c) => (c.typeLine.split("—")[1] ?? "").trim().split(/\s+/).filter(Boolean)));
  const synergy = (c: DeckCard) =>
    themes.filter(([, rx]) => rx.test(c.oracleText)).length +
    ((c.typeLine.split("—")[1] ?? "").split(/\s+/).some((t) => subtypes.has(t)) ? 1 : 0);

  const filler = eligible
    .filter((c) => !c.roles.some((r) => USEFUL_ROLES.includes(r)))
    .map((c) => ({ c, s: synergy(c) }))
    .sort((x, y) => x.s - y.s || y.c.cmc - x.c.cmc || pct(x.c) - pct(y.c));
  for (const { c, s } of filler) {
    const base = c.cmc >= 5 ? `Coste ${c.cmc} sin función de apoyo detectada (ramp, robo, removal…)` : "No cumple ninguna función de apoyo detectada (ramp, robo, removal…)";
    out.push({ card: c, reason: s > 0 ? `${base}, aunque comparte mecánica con tu comandante: revísala.` : `${base} ni comparte mecánicas con tu comandante.` });
  }
  return out;
}

/** Color con más demanda de símbolos por cada fuente de tierra que lo produce. */
function neediestColor(a: Analysis, identity: Color[]): Color {
  const cols = identity.length ? identity : (["G"] as Color[]);
  return cols.reduce((best, c) => (a.pipDemand[c] / (a.landSources[c] + 1) > a.pipDemand[best] / (a.landSources[best] + 1) ? c : best), cols[0]);
}

/** Aplica los cambios elegidos a la lista de texto y devuelve la lista nueva. */
export function applyChanges(list: string, changes: Change[]): string {
  const { entries } = parseDeckList(list);
  const byKey = new Map(entries.map((e) => [cardKey(e.name), e]));
  for (const ch of changes) {
    if (ch.out) {
      const e = byKey.get(cardKey(ch.out.name));
      if (e) e.qty -= 1;
    }
    if (ch.in) {
      const k = cardKey(ch.in.name);
      const e = byKey.get(k);
      if (e) e.qty += 1;
      else {
        const added = { name: ch.in.name, qty: 1, isCommander: false };
        byKey.set(k, added);
        entries.push(added);
      }
    }
  }
  return listToText(entries.filter((e) => e.qty > 0));
}
