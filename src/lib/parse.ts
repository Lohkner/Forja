import type { ParsedEntry, ParsedList } from "./types";

const SECTION_RE =
  /^(commanders?|comandantes?|deck|mazo|mainboard|main|sideboard|maybeboard|considering|companion|compañero|creatures?|criaturas?|instants?|instantáneos?|sorcer(y|ies)|conjuros?|artifacts?|artefactos?|enchantments?|encantamientos?|lands?|tierras?|planeswalkers?|battles?|batallas?|other|otros?)(\s*\(\d+\))?$/i;

const IGNORED_SECTIONS = /^(sideboard|maybeboard|considering)/i;
const COMMANDER_SECTIONS = /^(commanders?|comandantes?)/i;

/**
 * Interpreta una lista de texto plano exportada de Moxfield, Archidekt, MTGGoldfish,
 * Deckstats, TappedOut o escrita a mano.
 *
 * Formatos admitidos por línea:
 *   1 Sol Ring
 *   1x Sol Ring
 *   1 Sol Ring (CMM) 410
 *   1 Sol Ring (CMM) 410 *F*
 *   1 Krenko, Mob Boss *CMDR*
 *   Sol Ring             (sin cantidad = 1)
 */
export function parseDeckList(text: string): ParsedList {
  const byKey = new Map<string, ParsedEntry>();
  const skipped: string[] = [];
  let section = "";

  for (const raw of text.split(/\r?\n/)) {
    let line = raw.trim();
    if (!line || line.startsWith("//") || line.startsWith("#")) continue;

    const header = line.replace(/[:\s]+$/, "");
    if (SECTION_RE.test(header)) {
      section = header.toLowerCase();
      continue;
    }
    if (IGNORED_SECTIONS.test(section)) continue;

    const isCommander =
      /\*cmdr\*|\[commander\]|\{commander\}/i.test(line) || COMMANDER_SECTIONS.test(section);

    // Quitar marcadores: *F*, *CMDR*, [Categoría], ^etiqueta^
    line = line
      .replace(/\*[^*]*\*/g, "")
      .replace(/\[[^\]]*\]/g, "")
      .replace(/\^[^^]*\^/g, "")
      .trim();

    let qty = 1;
    let name = line;
    const m = line.match(/^(\d+)\s*x?\s+(.+)$/i);
    if (m) {
      qty = parseInt(m[1], 10);
      name = m[2];
    }

    const card = cleanCardName(name);
    if (!card.name || qty <= 0) {
      skipped.push(raw);
      continue;
    }

    const key = cardKey(card.name);
    const prev = byKey.get(key);
    if (prev) {
      prev.qty += qty;
      prev.isCommander ||= isCommander;
    } else {
      const entry: ParsedEntry = { name: card.name, qty, isCommander };
      if (card.alts.length) entry.alts = card.alts;
      if (card.set) entry.set = card.set;
      if (card.cn) entry.cn = card.cn;
      byKey.set(key, entry);
    }
  }

  return { entries: [...byKey.values()], skipped };
}

const SET_CODE = /^[A-Za-z0-9]{2,6}$/;

/**
 * Separa de un nombre de la lista lo que no es el nombre de la carta:
 *   "Sol Ring (CMM) 410"                                  → edición cmm, número 410
 *   "Fire/Ice", "Fire / Ice"                              → "Fire // Ice" (Scryfall usa doble barra)
 *   "Godzilla, Doom Inevitable (Yidaro, Wandering Monster)" → nombre + alternativo (Universes Beyond, Secret Lair)
 *   "Lightning Bolt # comentario"                         → sin el comentario
 */
export function cleanCardName(raw: string): { name: string; alts: string[]; set?: string; cn?: string } {
  let name = raw.replace(/\s+#.*$/, "").trim();
  let set: string | undefined;
  let cn: string | undefined;

  const setM = name.match(/\s+\(([A-Za-z0-9]{2,6})\)(?:\s+([\w★-]+))?\s*$/);
  if (setM) {
    set = setM[1].toLowerCase();
    cn = setM[2];
    name = name.slice(0, setM.index).trim();
  }

  const alts: string[] = [];
  const altM = name.match(/^(.+?)\s*\(([^()]{3,})\)$/);
  if (altM && !SET_CODE.test(altM[2].trim())) {
    name = altM[1].trim();
    alts.push(altM[2].trim());
  }

  // Una sola barra entre caras → doble barra. No toca las que ya son dobles.
  name = name.replace(/\s*(?<!\/)\/(?!\/)\s*/g, " // ").replace(/\s*\/\/\s*/g, " // ");
  return { name, alts, set, cn };
}

export function cardKey(name: string): string {
  return name
    .split(" // ")[0]
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

export function listToText(entries: ParsedEntry[]): string {
  return entries
    .map((e) => {
      const alt = e.alts?.length ? ` (${e.alts[0]})` : "";
      const print = e.set ? ` (${e.set.toUpperCase()})${e.cn ? ` ${e.cn}` : ""}` : "";
      return `${e.qty} ${e.name}${alt}${print}${e.isCommander ? " *CMDR*" : ""}`;
    })
    .join("\n");
}
