import type { Color } from "./types";

/**
 * Cartas de calidad contrastada para cubrir cada función en Commander.
 * - Ordenadas de mejor a peor dentro de cada función: el optimizador coge las primeras que encajen.
 * - Sin Game Changers, para que las sugerencias no suban el bracket del mazo.
 * - `ci` es la identidad de color según Scryfall ("" = incolora). Validado contra Scryfall el 2026-11-18
 *   (nombre exacto, identidad y que no sea Game Changer).
 */
export type StapleRole = "ramp" | "draw" | "removal" | "wipe" | "land";

export interface Staple {
  name: string;
  ci: string;
  role: StapleRole;
  /** Solo útil si el mazo tiene 2+ colores (fijación de maná). */
  multicolorOnly?: boolean;
}

const r = (role: StapleRole, ci: string, names: string[], multicolorOnly = false): Staple[] =>
  names.map((name) => ({ name, ci, role, multicolorOnly }));

export const STAPLES: Staple[] = [
  // ── Ramp ────────────────────────────────────────────────────────────
  ...r("ramp", "", ["Sol Ring", "Arcane Signet"]),
  ...r("ramp", "G", ["Nature's Lore", "Three Visits", "Rampant Growth", "Farseek", "Birds of Paradise", "Llanowar Elves", "Cultivate", "Kodama's Reach", "Skyshroud Claim"]),
  ...r("ramp", "W", ["Land Tax", "Knight of the White Orchid", "Archaeomancer's Map"]),
  ...r("ramp", "WU", ["Talisman of Progress", "Azorius Signet"]),
  ...r("ramp", "UB", ["Talisman of Dominance", "Dimir Signet"]),
  ...r("ramp", "BR", ["Talisman of Indulgence", "Rakdos Signet"]),
  ...r("ramp", "RG", ["Talisman of Impulse", "Gruul Signet"]),
  ...r("ramp", "GW", ["Talisman of Unity", "Selesnya Signet"]),
  ...r("ramp", "WB", ["Talisman of Hierarchy", "Orzhov Signet"]),
  ...r("ramp", "UR", ["Talisman of Creativity", "Izzet Signet"]),
  ...r("ramp", "BG", ["Talisman of Resilience", "Golgari Signet"]),
  ...r("ramp", "RW", ["Talisman of Conviction", "Boros Signet"]),
  ...r("ramp", "GU", ["Talisman of Curiosity", "Simic Signet"]),
  ...r("ramp", "", ["Fellwar Stone", "Mind Stone", "Thought Vessel", "Commander's Sphere", "Wayfarer's Bauble"]),

  // ── Robo ────────────────────────────────────────────────────────────
  ...r("draw", "U", ["Fact or Fiction", "Chart a Course", "Mulldrifter", "Pull from Tomorrow"]),
  ...r("draw", "B", ["Night's Whisper", "Phyrexian Arena", "Read the Bones", "Sign in Blood", "Black Market Connections"]),
  ...r("draw", "G", ["Guardian Project", "Return of the Wildspeaker", "Harmonize", "Beast Whisperer"]),
  ...r("draw", "R", ["Valakut Exploration", "Light Up the Stage", "Big Score", "Outpost Siege"]),
  ...r("draw", "W", ["Esper Sentinel", "Mentor of the Meek", "Welcoming Vampire", "Tocasia's Welcome"]),
  ...r("draw", "", ["Mind's Eye", "Endless Atlas"]),

  // ── Removal puntual ─────────────────────────────────────────────────
  ...r("removal", "W", ["Swords to Plowshares", "Path to Exile", "Generous Gift", "Get Lost"]),
  ...r("removal", "B", ["Infernal Grasp", "Go for the Throat", "Feed the Swarm", "Deadly Rollick"]),
  ...r("removal", "G", ["Beast Within", "Nature's Claim", "Krosan Grip"]),
  ...r("removal", "R", ["Chaos Warp", "Abrade", "Lightning Bolt"]),
  ...r("removal", "U", ["Pongify", "Rapid Hybridization", "Counterspell", "Reality Shift"]),
  ...r("removal", "WB", ["Anguished Unmaking", "Vindicate", "Despark", "Mortify"]),
  ...r("removal", "BG", ["Assassin's Trophy", "Abrupt Decay", "Putrefy"]),
  ...r("removal", "BR", ["Terminate", "Bedevil"]),
  ...r("removal", "UR", ["Prismari Command"]),
  ...r("removal", "", ["Meteor Golem"]),

  // ── Barridos ────────────────────────────────────────────────────────
  ...r("wipe", "W", ["Wrath of God", "Austere Command", "Day of Judgment"]),
  ...r("wipe", "B", ["Damnation", "Crux of Fate", "Deadly Tempest"]),
  ...r("wipe", "R", ["Blasphemous Act", "Vandalblast"]),
  ...r("wipe", "U", ["Aetherize", "Evacuation"]),
  ...r("wipe", "G", ["Ezuri's Predation", "Bane of Progress"]),
  ...r("wipe", "WU", ["Supreme Verdict"]),
  ...r("wipe", "WB", ["Merciless Eviction"]),
  ...r("wipe", "", ["Nevinyrral's Disk", "Oblivion Stone"]),

  // ── Tierras que arreglan colores ────────────────────────────────────
  ...r("land", "", ["Command Tower", "Exotic Orchard", "Path of Ancestry"], true),
  ...r("land", "WU", ["Temple of Enlightenment"], true),
  ...r("land", "UB", ["Temple of Deceit"], true),
  ...r("land", "BR", ["Temple of Malice"], true),
  ...r("land", "RG", ["Temple of Abandon"], true),
  ...r("land", "GW", ["Temple of Plenty"], true),
  ...r("land", "WB", ["Temple of Silence"], true),
  ...r("land", "UR", ["Temple of Epiphany"], true),
  ...r("land", "BG", ["Temple of Malady"], true),
  ...r("land", "RW", ["Temple of Triumph"], true),
  ...r("land", "GU", ["Temple of Mystery"], true),
];

export const BASIC_FOR: Record<Color, string> = { W: "Plains", U: "Island", B: "Swamp", R: "Mountain", G: "Forest" };

/** ¿Cabe la carta en esta identidad de color? */
export function fitsIdentity(ci: string, identity: readonly Color[]): boolean {
  return [...ci].every((c) => identity.includes(c as Color));
}
