import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { HAS_SERVER, importFromUrl } from "../lib/api";
import { EXAMPLE_LIST } from "../lib/example";
import { deleteDeck, listDecks, newDeckId, saveDeck } from "../lib/storage";

type Mode = "url" | "list";

export default function HomePage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("list");
  const [url, setUrl] = useState("");
  const [list, setList] = useState("");
  const [commander, setCommander] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [decks, setDecks] = useState(listDecks);

  const createAndOpen = (name: string, text: string, cmdr?: string) => {
    const now = Date.now();
    const deck = { id: newDeckId(), name, list: text, commanderHint: cmdr || undefined, createdAt: now, updatedAt: now };
    saveDeck(deck);
    navigate(`/mazo/${deck.id}`);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (mode === "list") {
      if (!list.trim()) return setError("Pega una lista primero.");
      return createAndOpen(commander.trim() || "Mi mazo", list, commander.trim());
    }
    if (!url.trim()) return setError("Pega el enlace de tu mazo.");
    setBusy(true);
    try {
      const imported = await importFromUrl(url.trim());
      createAndOpen(imported.name, imported.list, imported.commanders[0]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <section className="pt-10 md:pt-24">
        <p className="eyebrow">Commander · EDH <span className="font-semibold text-ink-3">· gratis y en español</span></p>
        <h1 className="display mt-3 text-[42px] md:text-[clamp(46px,5.6vw,84px)]">Tu mazo,<br />carta a carta.</h1>
        <p className="mt-5 max-w-[46ch] text-[17px] leading-relaxed text-ink-2">
          Analiza curva, base de maná, ramp, robo, removal y bracket, y recibe sugerencias de cortes y añadidos con IA.
        </p>

        <form onSubmit={submit} className="mt-8 max-w-3xl rounded-[20px] border border-line-2 bg-surface/85 p-3">
          <div className="flex rounded-xl bg-raise p-1 text-sm font-semibold text-ink-2" role="tablist">
            {((HAS_SERVER ? ["list", "url"] : ["list"]) as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                onClick={() => setMode(m)}
                className={`h-9 flex-1 rounded-lg px-3 ${mode === m ? "bg-surface text-ink shadow" : ""}`}
              >
                {m === "list" ? "Lista" : "Enlace"}
              </button>
            ))}
          </div>

          {mode === "url" ? (
            <>
              <input
                className="field mt-3"
                type="url"
                placeholder="https://archidekt.com/decks/…"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
              <p className="mt-2 text-xs text-ink-3">
                Moxfield no permite importar por enlace: exporta la lista en texto y pégala en «Lista».
              </p>
            </>
          ) : (
            <>
              <input
                className="field mt-3"
                placeholder="Comandante (opcional)"
                value={commander}
                onChange={(e) => setCommander(e.target.value)}
              />
              <textarea
                className="field mt-2 min-h-56 font-mono text-sm"
                spellCheck={false}
                placeholder={"1 Krenko, Mob Boss *CMDR*\n1 Sol Ring\n1x Lightning Bolt (2X2) 117\n30 Mountain"}
                value={list}
                onChange={(e) => setList(e.target.value)}
              />
            </>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            <button className="btn-cta flex-1 sm:flex-none" disabled={busy}>
              {busy ? "Importando…" : "Importar y analizar"}
            </button>
            {mode === "list" && (
              <button type="button" className="btn" onClick={() => { setList(EXAMPLE_LIST); setCommander(""); }}>
                Cargar ejemplo
              </button>
            )}
          </div>
          {error && <p className="mt-3 text-sm text-bad">{error}</p>}
          <p className="mt-3 text-xs text-ink-3">
            En Moxfield: <i>More → Export → Copy plain text</i>. En Archidekt: <i>Export → Text</i>. Se ignoran ediciones, números de coleccionista y marcadores como *F*.
          </p>
        </form>
      </section>

      {decks.length > 0 && (
        <section>
          <h2 className="h2">Tus mazos en este navegador</h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {decks.map((d) => (
              <li key={d.id} className="panel flex items-center gap-3 p-4">
                <Link to={`/mazo/${d.id}`} className="flex-1 font-semibold hover:text-brand">{d.name}</Link>
                <span className="text-xs text-ink-3">{new Date(d.updatedAt).toLocaleDateString("es")}</span>
                <button
                  className="text-xs text-ink-3 hover:text-bad"
                  onClick={() => { deleteDeck(d.id); setDecks(listDecks()); }}
                  aria-label={`Borrar ${d.name}`}
                >
                  Borrar
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
