import { useEffect, useRef, useState } from "react";
import Markdown from "react-markdown";
import type { Analysis } from "../lib/analyze";
import { apiStatus, optimizeDeck } from "../lib/api";
import type { BracketResult } from "../lib/bracket";

export default function AiPanel({ analysis, bracket }: { analysis: Analysis; bracket: BracketResult }) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [goal, setGoal] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    apiStatus().then((s) => setEnabled(s.ai));
    return () => abort.current?.abort();
  }, []);

  const run = async () => {
    abort.current?.abort();
    abort.current = new AbortController();
    setBusy(true);
    setError("");
    setText("");
    const a = analysis;
    const stats = `${a.total} cartas, ${a.lands} tierras, CMC medio ${a.avgCmc.toFixed(2)}, ramp ${a.roles.ramp}, robo ${a.roles.draw}, removal ${a.roles.removal}, barridos ${a.roles.wipe}, tutores ${a.roles.tutor}, Game Changers ${a.gameChangers.length}, bracket estimado ${bracket.bracket}`;
    try {
      await optimizeDeck(
        {
          commander: a.commanders.map((c) => c.name).join(" + "),
          colorIdentity: a.colorIdentity.join(""),
          stats,
          goal,
          list: a.cards.map((c) => `${c.qty} ${c.name}${c.roles.length ? ` [${c.roles.join(",")}]` : ""}`).join("\n"),
        },
        setText,
        abort.current.signal,
      );
    } catch (err) {
      if ((err as Error).name !== "AbortError") setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel">
      <p className="text-ink-2">Plan de juego, combos, cortes y añadidos, y ajustes de la base de maná según tu comandante y el análisis.</p>
      {enabled === false && (
        <p className="mt-3 rounded-xl border border-warn/40 bg-warn/10 p-3 text-sm">
          La IA no está activa en este servidor. Añade <code>ANTHROPIC_API_KEY</code> a <code>.env</code> y reinicia <code>npm run dev</code>.
        </p>
      )}
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input
          className="field"
          placeholder="Objetivo (opcional): subir a bracket 3, presupuesto bajo, más interacción…"
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
        />
        <button className="btn-cta shrink-0" onClick={run} disabled={busy || enabled === false}>
          {busy ? "Pensando…" : "Optimizar con IA"}
        </button>
      </div>
      {error && <p className="mt-3 text-sm text-bad">{error}</p>}
      {text && (
        <div className="prose-ai mt-5 space-y-2 text-[15px] leading-relaxed [&_h2]:mt-6 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-brand [&_li]:my-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5">
          <Markdown>{text}</Markdown>
        </div>
      )}
    </div>
  );
}
