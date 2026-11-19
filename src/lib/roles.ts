import type { CardData, Role } from "./types";

/**
 * Clasificación heurística de funciones a partir del texto Oracle de Scryfall.
 * Es deliberadamente simple: acierta en la mayoría de cartas típicas de Commander y
 * se puede corregir carta a carta con OVERRIDES. Mejorarla es una tarea abierta (ver CLAUDE.md).
 */

export const ROLE_LABEL: Record<Role, string> = {
  ramp: "Ramp",
  fastmana: "Maná rápido",
  draw: "Robo",
  removal: "Removal",
  wipe: "Barrido",
  tutor: "Tutor",
  protection: "Protección",
  wincon: "Remate",
  extraturn: "Turno extra",
  mld: "Destr. masiva de tierras",
  recursion: "Recursión",
};

/** Maná rápido según la definición habitual de los brackets de Commander. */
const FAST_MANA = new Set(
  [
    "Sol Ring", "Mana Crypt", "Mana Vault", "Grim Monolith", "Chrome Mox", "Mox Diamond", "Mox Opal",
    "Mox Amber", "Lotus Petal", "Jeweled Lotus", "Mana Geyser", "Dark Ritual", "Cabal Ritual",
    "Simian Spirit Guide", "Elvish Spirit Guide", "Ancient Tomb", "Gemstone Caverns", "Lion's Eye Diamond",
    "Rite of Flame", "Pyretic Ritual", "Desperate Ritual", "Culling the Weak", "Mox Tantalite",
  ].map((s) => s.toLowerCase()),
);

/** Correcciones manuales: nombre en minúsculas → funciones. */
export const OVERRIDES: Record<string, Role[]> = {
  "sol ring": ["ramp", "fastmana"],
  "skullclamp": ["draw"],
  "rhystic study": ["draw"],
  "mystic remora": ["draw"],
  "smothering tithe": ["ramp"],
  "cyclonic rift": ["removal", "wipe"],
  "thassa's oracle": ["wincon"],
  "laboratory maniac": ["wincon"],
  "jace, wielder of mysteries": ["wincon", "draw"],
  "craterhoof behemoth": ["wincon"],
  "insurrection": ["wincon"],
};

const RX = {
  addMana: /\{t\}[^.]*:\s*add\b|\badd (one mana|\{[wubrgc]\}|two mana|three mana|x mana|an amount of)/i,
  landRamp:
    /search your library for (up to )?(a|an|one|two|three|x)? ?(basic )?(land|forest|plains|island|swamp|mountain)[^.]*(onto the battlefield|put (it|them) onto)/i,
  extraLand: /you may play (an|two) additional lands?/i,
  treasure: /create (a|one|two|three|x|that many) treasure/i,
  draw: /\bdraws? (a|one|two|three|four|x|that many|cards?|an additional|seven)\b(?![^.]*\bthen discard (a|two) cards?\b(?! for))/i,
  impulse: /exile the top (card|two cards|three cards|x cards)[^.]*\. (until|you may play|you may cast)/i,
  removal:
    /(destroy|exile) (target|up to one target|another target|up to two target)(?! card from)|deals? (\d+|x) damage to (any target|target creature|target planeswalker|any other target)|return target (nonland )?(creature|permanent|artifact|enchantment)[^.]* to its owner'?s hand|counter target (spell|activated|noncreature)|target (player|opponent) sacrifices|fights? (target|up to one target)/i,
  wipe:
    /(destroy|exile) all (creatures|nonland permanents|permanents|artifacts|enchantments|other creatures|nonland)|deals? (\d+|x) damage to each (creature|other creature|opponent and each creature)|all (other )?creatures get -|each (player|opponent) sacrifices (all|a creature)|return all (nonland )?(permanents|creatures)/i,
  tutor: /search your library for (a|an|up to (one|two|three)) (?!(basic )?(land|forest|plains|island|swamp|mountain))[^.]*card/i,
  protection:
    /(gains?|have|has) (hexproof|indestructible|shroud|protection from)|counter target spell that targets|phase out/i,
  extraturn: /takes? an extra turn/i,
  mld: /destroy all lands|each player sacrifices (all|half the) lands|destroy all nonbasic lands/i,
  recursion: /return (target|up to one target|another target|all|each)[^.]* (card|cards) from (your|a) graveyard/i,
  wincon:
    /you win the game|each opponent loses (\d+|x|half)|each opponent loses the game|deals? (\d+|x) damage to each opponent|creatures you control get \+\d+\/\+\d+ and gain (trample|double strike)|infinite/i,
};

export function classifyRoles(card: CardData): Role[] {
  const name = card.name.toLowerCase();
  if (OVERRIDES[name]) return OVERRIDES[name];

  const isLand = card.types.includes("Land");
  const t = card.oracleText;
  const roles = new Set<Role>();

  if (FAST_MANA.has(name)) roles.add("fastmana");
  if (!isLand) {
    if (RX.addMana.test(t) || RX.landRamp.test(t) || RX.extraLand.test(t) || RX.treasure.test(t)) roles.add("ramp");
    if (RX.draw.test(t) || RX.impulse.test(t)) roles.add("draw");
    if (RX.wipe.test(t)) roles.add("wipe");
    else if (RX.removal.test(t)) roles.add("removal");
    if (RX.tutor.test(t)) roles.add("tutor");
    if (RX.protection.test(t)) roles.add("protection");
    if (RX.recursion.test(t)) roles.add("recursion");
    if (RX.wincon.test(t)) roles.add("wincon");
  } else if (RX.landRamp.test(t)) {
    // Tierras que buscan tierras (Myriad Landscape, etc.).
    roles.add("ramp");
  }
  if (RX.extraturn.test(t)) roles.add("extraturn");
  if (RX.mld.test(t)) roles.add("mld");
  if (roles.has("fastmana")) roles.add("ramp");

  return [...roles];
}
