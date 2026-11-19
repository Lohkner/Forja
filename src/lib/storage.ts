import type { Deck } from "./types";

/**
 * Mazos guardados en el navegador, con id "local-xxxxxxxx" (igual que hace el sitio de
 * referencia en /mazo/local-…). Cuando haya cuentas de usuario, los mazos pasarán al
 * servidor y estos se podrán migrar.
 */
const KEY = "forja-decks-v1";

function readAll(): Record<string, Deck> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}");
  } catch {
    return {};
  }
}
function writeAll(all: Record<string, Deck>) {
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* sin almacenamiento: el mazo vive solo en esta sesión */
  }
}

export function newDeckId(): string {
  return "local-" + Math.random().toString(36).slice(2, 12);
}

export function saveDeck(deck: Deck): void {
  const all = readAll();
  all[deck.id] = { ...deck, updatedAt: Date.now() };
  writeAll(all);
}

export function getDeck(id: string): Deck | undefined {
  return readAll()[id];
}

export function listDecks(): Deck[] {
  return Object.values(readAll()).sort((a, b) => b.updatedAt - a.updatedAt);
}

export function deleteDeck(id: string): void {
  const all = readAll();
  delete all[id];
  writeAll(all);
}
