/** Cliente del servidor propio (server/index.mjs). */

/** false en la versión estática (GitHub Pages): sin servidor no hay importación por enlace ni IA. */
export const HAS_SERVER = import.meta.env.VITE_STATIC !== "1";

export interface ImportedDeck {
  name: string;
  source: string;
  list: string;
  commanders: string[];
}

export async function importFromUrl(url: string): Promise<ImportedDeck> {
  const res = await fetch("/api/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `Error ${res.status} al importar`);
  return body as ImportedDeck;
}

export interface OptimizeRequest {
  commander: string;
  colorIdentity: string;
  stats: string;
  goal: string;
  list: string;
}

/** Pide la optimización con IA y va entregando el texto según llega (streaming). */
export async function optimizeDeck(req: OptimizeRequest, onText: (full: string) => void, signal?: AbortSignal): Promise<string> {
  const res = await fetch("/api/optimize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
    signal,
  });
  if (!res.ok || !res.body) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Error ${res.status} en la optimización`);
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    text += dec.decode(value, { stream: true });
    onText(text);
  }
  return text;
}

export async function apiStatus(): Promise<{ ai: boolean }> {
  if (!HAS_SERVER) return { ai: false };
  try {
    const res = await fetch("/api/status");
    return res.ok ? await res.json() : { ai: false };
  } catch {
    return { ai: false };
  }
}
