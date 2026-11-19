import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import AiPanel from "../components/AiPanel";
import OptimizePanel from "../components/OptimizePanel";
import CardList from "../components/CardList";
import { Bars, COLOR_NAME, COLOR_VAR, CurveChart, ManaPips } from "../components/Charts";
import HealthList from "../components/HealthList";
import { analyzeDeck, COLORS, healthChecks, type Analysis } from "../lib/analyze";
import { estimateBracket } from "../lib/bracket";
import { parseDeckList } from "../lib/parse";
import { fetchCards } from "../lib/scryfall";
import { applyChanges, type Change } from "../lib/optimize";
import { getDeck, newDeckId, saveDeck } from "../lib/storage";
import type { Deck, ManaColor } from "../lib/types";

const TYPE_ES: Record<string, string> = {
  Creature: "Criatura", Instant: "Instantáneo", Sorcery: "Conjuro", Artifact: "Artefacto",
  Enchantment: "Encantamiento", Planeswalker: "Planeswalker", Battle: "Batalla", Land: "Tierra", Other: "Otra",
};

export default function DeckPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [deck, setDeck] = useState<Deck | undefined>(() => getDeck(id));
  // Al navegar a otro mazo (p. ej. la copia optimizada) el componente se reutiliza: recarga el mazo.
  useEffect(() => {
    if (deck?.id !== id) {
      const next = getDeck(id);
      setDeck(next);
      setDraft(next?.list ?? "");
      setEditing(false);
    }
  }, [id, deck?.id]);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(deck?.list ?? "");

  useEffect(() => {
    if (!deck) return;
    let cancelled = false;
    (async () => {
      setError("");
      setProgress("Buscando cartas en Scryfall…");
      try {
        const parsed = parseDeckList(deck.list);
        const { cards, notFound } = await fetchCards(
          parsed.entries,
          (done, total) => !cancelled && setProgress(`Buscando cartas en Scryfall… ${done}/${total}`),
        );
        if (cancelled) return;
        setAnalysis(analyzeDeck(parsed.entries, cards, notFound, deck.commanderHint));
        setProgress("");
      } catch (err) {
        if (!cancelled) {
          setProgress("");
          setError(`No pude analizar el mazo: ${(err as Error).message}`);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [deck]);

  const bracket = useMemo(() => (analysis ? estimateBracket(analysis) : null), [analysis]);
  const checks = useMemo(() => (analysis ? healthChecks(analysis) : []), [analysis]);

  if (!deck) {
    return (
      <div className="py-24 text-center">
        <h1 className="display text-4xl">No encuentro este mazo</h1>
        <p className="mt-4 text-ink-2">Los mazos «local-…» se guardan solo en el navegador donde se crearon.</p>
        <Link to="/" className="btn-cta mt-8">Analizar otro mazo</Link>
      </div>
    );
  }

  const saveEdit = () => {
    const next = { ...deck, list: draft, updatedAt: Date.now() };
    saveDeck(next);
    setDeck(next);
    setEditing(false);
  };

  /** Guarda los cambios en una copia nueva del mazo (el original no se toca) y la abre. */
  const applyPlan = (changes: Change[]) => {
    const now = Date.now();
    const copy: Deck = {
      ...deck,
      id: newDeckId(),
      name: `${deck.name.replace(/ \(optimizado\)$/, "")} (optimizado)`,
      list: applyChanges(deck.list, changes),
      createdAt: now,
      updatedAt: now,
    };
    saveDeck(copy);
    setAnalysis(null);
    navigate(`/mazo/${copy.id}`);
    window.scrollTo({ top: 0 });
  };

  const a = analysis;
  const shownColors: ManaColor[] = a ? (a.colorIdentity.length ? a.colorIdentity : COLORS.filter((c) => a.pipDemand[c] > 0)) : [];

  return (
    <div className="pt-8">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1">
          <p className="eyebrow">Mi mazo</p>
          <h1 className="display mt-2 text-4xl md:text-5xl">{a?.commanders.map((c) => c.name).join(" + ") || deck.name}</h1>
        </div>
        {a && <ManaPips colors={a.colorIdentity} />}
        <button className="btn" onClick={() => { setDraft(deck.list); setEditing((v) => !v); }}>
          {editing ? "Cancelar" : "Editar lista"}
        </button>
      </div>

      {editing && (
        <div className="panel mt-4">
          <textarea className="field min-h-72 font-mono text-sm" spellCheck={false} value={draft} onChange={(e) => setDraft(e.target.value)} />
          <button className="btn-cta mt-3" onClick={saveEdit}>Guardar y volver a analizar</button>
        </div>
      )}

      {progress && <p className="mt-6 animate-pulse text-ink-2">{progress}</p>}
      {error && <p className="mt-6 text-bad">{error}</p>}

      {a && bracket && (
        <>
          <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
            {[
              ["Cartas", a.total],
              ["CMC medio", a.avgCmc.toFixed(2)],
              ["Tierras", a.lands],
              ["Ramp", a.roles.ramp],
              ["Robo", a.roles.draw],
              ["Removal", a.roles.removal],
              ["Barridos", a.roles.wipe],
              ["Precio", a.priceEur ? `${a.priceEur.toFixed(0)} €` : a.priceUsd ? `$${a.priceUsd.toFixed(0)}` : "—"],
            ].map(([k, v]) => (
              <div key={k} className="panel p-3">
                <p className="text-2xl font-bold tabular-nums">{v}</p>
                <p className="text-xs tracking-wider text-ink-3 uppercase">{k}</p>
              </div>
            ))}
          </div>

          <h2 className="h2">Curva y composición</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="panel">
              <h3 className="mb-3 text-xs font-bold tracking-widest text-ink-3 uppercase">Curva de maná (sin tierras ni comandante)</h3>
              <CurveChart curve={a.curve} />
            </div>
            <div className="panel">
              <h3 className="mb-3 text-xs font-bold tracking-widest text-ink-3 uppercase">Tipos de carta</h3>
              <Bars rows={Object.entries(a.types).sort((x, y) => y[1] - x[1]).map(([k, v]) => ({ key: k, label: TYPE_ES[k] ?? k, value: v }))} />
            </div>
          </div>

          <h2 className="h2">Base de maná</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="panel">
              <h3 className="mb-3 text-xs font-bold tracking-widest text-ink-3 uppercase">Símbolos de color en los costes</h3>
              <Bars rows={shownColors.map((c) => ({ key: c, label: COLOR_NAME[c], value: a.pipDemand[c as keyof typeof a.pipDemand] ?? 0, color: COLOR_VAR[c] }))} />
            </div>
            <div className="panel">
              <h3 className="mb-3 text-xs font-bold tracking-widest text-ink-3 uppercase">Tierras que producen cada color</h3>
              <Bars rows={[...shownColors, "C" as const].map((c) => ({ key: c, label: COLOR_NAME[c], value: a.landSources[c], color: COLOR_VAR[c] }))} />
              <p className="mt-3 text-xs text-ink-3">Además: {a.rocks} fuentes de maná que no son tierras (rocas, criaturas de maná…).</p>
            </div>
          </div>

          <h2 className="h2">Salud del mazo</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="panel"><HealthList checks={checks} /></div>
            <div className="panel">
              <h3 className="mb-3 text-xs font-bold tracking-widest text-ink-3 uppercase">Bracket estimado</h3>
              <div className="flex items-center gap-4">
                <span className="display text-7xl text-brand">{bracket.bracket}</span>
                <div>
                  <p className="text-lg font-bold">{bracket.label}</p>
                  <p className="text-sm text-ink-3">Orientativo: el bracket real también depende de la intención del mazo.</p>
                </div>
              </div>
              <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-ink-2">
                {bracket.reasons.map((r) => <li key={r}>{r}</li>)}
              </ul>
              {a.gameChangers.length > 0 && (
                <p className="mt-3 text-sm">Game Changers: {a.gameChangers.map((c) => c.name).join(", ")}</p>
              )}
            </div>
          </div>

          <h2 className="h2">Cómo mejorarlo ya</h2>
          <OptimizePanel key={deck.id} analysis={a} onApply={applyPlan} />

          <h2 className="h2">Optimización con IA</h2>
          <AiPanel analysis={a} bracket={bracket} />

          <h2 className="h2">Lista clasificada</h2>
          <div className="panel"><CardList cards={a.cards} roleCounts={a.roles} /></div>
        </>
      )}
    </div>
  );
}
