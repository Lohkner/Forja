// Servidor de Forja de Mazos.
// - /api/status    → si la IA está configurada
// - /api/import    → trae una lista desde Archidekt o Moxfield (el navegador no puede por CORS)
// - /api/optimize  → informe de optimización con Claude, en streaming de texto
// En producción (npm start, o NODE_ENV=production) también sirve la web compilada de dist/.
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";
import { importDeck } from "./importers.mjs";
import { buildOptimizePrompt, SYSTEM_PROMPT } from "./prompts.mjs";

const PORT = Number(process.env.PORT ?? 8787);
const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5-5";
const anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null;

const app = express();
// Detrás del proxy del hosting (Render, Railway, Fly…) req.ip debe salir de X-Forwarded-For.
app.set("trust proxy", Number(process.env.TRUST_PROXY ?? 1));
app.disable("x-powered-by");
app.use(express.json({ limit: "200kb" }));

app.get("/api/status", (_req, res) => {
  res.json({ ai: !!anthropic, model: anthropic ? MODEL : null });
});

app.post("/api/import", async (req, res) => {
  if (rateLimited(req.ip, 30, "import")) return res.status(429).json({ error: "Demasiadas importaciones. Espera unos minutos." });
  try {
    const url = String(req.body?.url ?? "").trim();
    if (!url) return res.status(400).json({ error: "Falta el enlace del mazo." });
    res.json(await importDeck(url));
  } catch (err) {
    res.status(err.status ?? 502).json({ error: err.message ?? "No se pudo importar el mazo." });
  }
});

// Límite sencillo por IP para que nadie gaste la API key: 10 informes cada 10 minutos.
const WINDOW_MS = 10 * 60_000;
const hits = new Map();
function rateLimited(ip, max = 10, bucket = "ai") {
  const key = `${bucket}:${ip}`;
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(key, recent);
  return recent.length > max;
}
// Limpia IPs antiguas para que el mapa no crezca sin fin en un servidor que lleva días encendido.
setInterval(() => {
  const now = Date.now();
  for (const [k, ts] of hits) if (ts.every((t) => now - t >= WINDOW_MS)) hits.delete(k);
}, WINDOW_MS).unref();

app.post("/api/optimize", async (req, res) => {
  if (!anthropic) return res.status(503).json({ error: "La IA no está configurada: falta ANTHROPIC_API_KEY en .env" });
  if (rateLimited(req.ip)) return res.status(429).json({ error: "Demasiadas solicitudes. Espera unos minutos." });

  const { commander, colorIdentity, stats, goal, list } = req.body ?? {};
  if (!list || typeof list !== "string") return res.status(400).json({ error: "Falta la lista del mazo." });

  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache");
  try {
    const stream = anthropic.messages.stream({
      model: MODEL,
      max_tokens: 2500,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildOptimizePrompt({ commander, colorIdentity, stats, goal, list }) }],
    });
    stream.on("text", (t) => res.write(t));
    await stream.finalMessage();
    res.end();
  } catch (err) {
    console.error("optimize:", err);
    if (!res.headersSent) res.status(502).json({ error: "Falló la llamada a Claude." });
    else res.end("\n\n_(Se cortó la respuesta. Inténtalo de nuevo.)_");
  }
});

const PRODUCTION = process.env.NODE_ENV === "production" || process.argv.includes("--production");
if (PRODUCTION) {
  const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../dist");
  app.use(express.static(dist));
  // SPA: cualquier ruta que no sea /api devuelve index.html.
  app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(path.join(dist, "index.html")));
}

app.listen(PORT, () => {
  console.log(`API en http://localhost:${PORT} · IA ${anthropic ? `activa (${MODEL})` : "desactivada (sin ANTHROPIC_API_KEY)"}`);
});
