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

    // Quitar "(SET) 123" o "(SET)" al final, y "#..." de comentarios.
    name = name
      .replace(/\s+\([A-Za-z0-9]{2,6}\)(\s+[\w★\-]+)?\s*$/, "")
      .replace(/\s+#.*$/, "")
      .trim();

    if (!name || qty <= 0) {
      skipped.push(raw);
      continue;
    }

    const key = cardKey(name);
    const prev = byKey.get(key);
    if (prev) {
      prev.qty += qty;
      prev.isCommander ||= isCommander;
    } else {
      byKey.set(key, { name, qty, isCommander });
    }
  }

  return { entries: [...byKey.values()], skipped };
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
  return entries.map((e) => `${e.qty} ${e.name}${e.isCommander ? " *CMDR*" : ""}`).join("\n");
}
