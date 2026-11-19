export type Color = "W" | "U" | "B" | "R" | "G";
export type ManaColor = Color | "C";

export type Role =
  | "ramp"
  | "fastmana"
  | "draw"
  | "removal"
  | "wipe"
  | "tutor"
  | "protection"
  | "wincon"
  | "extraturn"
  | "mld"
  | "recursion";

/** Una línea de la lista tal como la escribió el usuario. */
export interface ParsedEntry {
  name: string;
  qty: number;
  isCommander: boolean;
  /** Otros nombres de la misma carta (p. ej. el original de un Universes Beyond con nombre alternativo). */
  alts?: string[];
  /** Edición y número de coleccionista, si la lista los trae: identifican la impresión exacta. */
  set?: string;
  cn?: string;
}

export interface ParsedList {
  entries: ParsedEntry[];
  /** Líneas que no se pudieron interpretar. */
  skipped: string[];
}

/** Datos de una carta normalizados desde Scryfall. */
export interface CardData {
  name: string;
  cmc: number;
  manaCost: string;
  typeLine: string;
  types: string[];
  oracleText: string;
  colorIdentity: Color[];
  producedMana: ManaColor[];
  gameChanger: boolean;
  legalCommander: boolean;
  image?: string;
  priceEur?: number;
  priceUsd?: number;
  scryfallUri?: string;
}

export interface DeckCard extends CardData {
  /** Nombre tal como aparece en la lista del usuario (puede ser un nombre alternativo o solo una cara). */
  listName: string;
  qty: number;
  isCommander: boolean;
  roles: Role[];
}

export interface Deck {
  id: string;
  name: string;
  list: string;
  commanderHint?: string;
  createdAt: number;
  updatedAt: number;
}
