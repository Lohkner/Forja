// Importadores de listas desde webs de mazos.
// IMPORTANTE: son APIs públicas pero no documentadas oficialmente; pueden cambiar sin aviso.
// Estado (probado 2026-11-18):
// - Archidekt: funciona (api/decks/:id/).
// - Moxfield: su API responde 403 a cualquier petición de servidor (protección anti-bots), exista o no el mazo.
//   No intentamos saltarnos esa protección: pedimos al usuario que pegue el export de texto.

const UA = "ForjaDeMazos/0.1 (+https://github.com/tu-usuario/forja-de-mazos)";
const TIMEOUT_MS = 10_000;

function httpError(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

async function getJson(url, { forbidden } = {}) {
  let res;
  try {
    res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    if (err?.name === "TimeoutError") throw httpError(504, "La web tardó demasiado en responder. Prueba de nuevo.");
    throw httpError(502, "No pude conectar con la web del mazo.");
  }
  if (res.status === 404) throw httpError(404, "No encontré ese mazo. ¿Es público?");
  if (res.status === 401 || res.status === 403) throw httpError(403, forbidden ?? "Ese mazo es privado o la web no permite leerlo.");
  if (!res.ok) throw httpError(502, `La web respondió ${res.status}.`);
  return res.json();
}

/** Archidekt: https://archidekt.com/decks/123456/nombre */
async function fromArchidekt(id) {
  const d = await getJson(`https://archidekt.com/api/decks/${id}/`);
  const cats = d.categories ?? [];
  const excluded = new Set(cats.filter((c) => c.includedInDeck === false).map((c) => c.name));
  // La categoría de comandante se marca con isPremier; el usuario puede renombrarla.
  const premier = new Set(cats.filter((c) => c.isPremier).map((c) => c.name));
  if (premier.size === 0) premier.add("Commander");

  const lines = [];
  const commanders = [];
  for (const c of d.cards ?? []) {
    if (c.deletedAt) continue;
    const cardCats = c.categories ?? [];
    // Archidekt usa la primera categoría como principal: si es Maybeboard/Sideboard, fuera.
    if (cardCats.length > 0 && excluded.has(cardCats[0])) continue;
    const name = c.card?.oracleCard?.name;
    if (!name) continue;
    const isCmdr = cardCats.some((x) => premier.has(x));
    if (isCmdr) commanders.push(name);
    lines.push(`${c.quantity ?? 1} ${name}${isCmdr ? " *CMDR*" : ""}`);
  }
  if (lines.length === 0) throw httpError(422, "Ese mazo de Archidekt está vacío.");
  return { name: d.name ?? "Mazo de Archidekt", source: "archidekt", list: lines.join("\n"), commanders };
}

/** Moxfield: https://moxfield.com/decks/AbCdEf123 */
async function fromMoxfield(id) {
  const d = await getJson(`https://api2.moxfield.com/v3/decks/all/${encodeURIComponent(id)}`, {
    forbidden:
      "Moxfield no deja importar mazos desde otras webs. En Moxfield abre el mazo, usa More → Export → Copy plain text y pega la lista en la pestaña «Lista».",
  });
  const boards = d.boards ?? {};
  const lines = [];
  const commanders = [];
  for (const [board, isCmdr] of [["commanders", true], ["companions", false], ["mainboard", false]]) {
    for (const entry of Object.values(boards[board]?.cards ?? {})) {
      const name = entry.card?.name;
      if (!name) continue;
      if (isCmdr) commanders.push(name);
      lines.push(`${entry.quantity ?? 1} ${name}${isCmdr ? " *CMDR*" : ""}`);
    }
  }
  if (lines.length === 0) throw httpError(422, "Ese mazo de Moxfield está vacío.");
  return { name: d.name ?? "Mazo de Moxfield", source: "moxfield", list: lines.join("\n"), commanders };
}

export async function importDeck(rawUrl) {
  let url;
  try {
    url = new URL(String(rawUrl ?? "").trim());
  } catch {
    throw httpError(400, "Ese enlace no parece válido.");
  }
  const host = url.hostname.replace(/^www\./, "");
  const parts = url.pathname.split("/").filter(Boolean);

  if (host === "archidekt.com" && parts[0] === "decks" && /^\d+$/.test(parts[1] ?? "")) return fromArchidekt(parts[1]);
  if (host === "moxfield.com" && parts[0] === "decks" && parts[1]) return fromMoxfield(parts[1]);

  throw httpError(400, "Por ahora solo se importa por enlace desde Archidekt. Para otras webs, pega la lista en texto.");
}
