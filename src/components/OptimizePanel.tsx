import { useMemo, useState } from "react";
import type { Analysis } from "../lib/analyze";
import { optimizeDeck, type Change, type ChangeCategory } from "../lib/optimize";

const CATEGORY: Record<ChangeCategory, { label: string; cls: string }> = {
  legal: { label: "Legalidad", cls: "bg-bad/15 text-bad" },
  ramp: { label: "Ramp", cls: "bg-ok/15 text-ok" },
  draw: { label: "Robo", cls: "bg-info/15 text-info" },
  removal: { label: "Removal", cls: "bg-warn/15 text-warn" },
  wipe: { label: "Barrido", cls: "bg-warn/15 text-warn" },
  land: { label: "Tierras", cls: "bg-brand/15 text-brand" },
  size: { label: "Tamaño", cls: "bg-raise text-ink-2" },
};

const scryfall = (name: string) => `https://scryfall.com/search?q=${encodeURIComponent(`!"${name}"`)}`;

function CardName({ name }: { name: string }) {
  return (
    <a href={scryfall(name)} target="_blank" rel="noreferrer" className="font-semibold underline decoration-line-2 underline-offset-2 hover:decoration-brand">
      {name}
    </a>
  );
}

export function changesToText(changes: Change[]): string {
  return changes
    .map((c) => [c.out && `- ${c.out.name}`, c.in && `+ ${c.in.name}`].filter(Boolean).join("  →  "))
    .join("\n");
}

export default function OptimizePanel({ analysis, onApply }: { analysis: Analysis; onApply: (changes: Change[]) => void }) {
  const plan = useMemo(() => optimizeDeck(analysis), [analysis]);
  const [off, setOff] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);
  const chosen = plan.changes.filter((c) => !off.has(c.id));

  const toggle = (id: string) =>
    setOff((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(changesToText(chosen));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* sin portapapeles: no pasa nada */
    }
  };

  return (
    <div className="panel">
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {plan.metrics.map((m) => {
          const changed = m.after !== m.before;
          return (
            <div key={m.label} className="rounded-xl bg-raise p-3">
              <p className="text-xs tracking-wider text-ink-3 uppercase">{m.label}</p>
              <p className="mt-1 text-lg font-bold tabular-nums">
                {m.before}
                {changed && <span className="text-ok"> → {m.after}</span>}
              </p>
              <p className="text-xs text-ink-3">objetivo {m.target}</p>
            </div>
          );
        })}
      </div>

      {plan.changes.length > 0 && (
        <>
          <p className="mt-5 text-sm text-ink-2">
            {plan.changes.length} cambio(s) por orden de prioridad. Desmarca los que no quieras y aplícalos: se crea una copia del mazo, el original no se toca.
          </p>
          <ol className="mt-3 divide-y divide-line">
            {plan.changes.map((c, i) => {
              const active = !off.has(c.id);
              return (
                <li key={c.id} className={`flex gap-3 py-3 ${active ? "" : "opacity-45"}`}>
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 shrink-0 accent-[var(--color-cta)]"
                    checked={active}
                    onChange={() => toggle(c.id)}
                    aria-label={`Incluir cambio ${i + 1}`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-sm text-ink-3 tabular-nums">{i + 1}.</span>
                      <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-bold tracking-wide uppercase ${CATEGORY[c.category].cls}`}>
                        {CATEGORY[c.category].label}
                      </span>
                      {c.out && (
                        <span>
                          <span className="text-bad">Saca</span> <CardName name={c.out.name} />
                        </span>
                      )}
                      {c.out && c.in && <span className="text-ink-3">→</span>}
                      {c.in && (
                        <span>
                          <span className="text-ok">Mete</span> <CardName name={c.in.name} />
                        </span>
                      )}
                    </div>
                    <ul className="mt-1 space-y-0.5 text-sm text-ink-2">
                      {c.out && <li>{c.out.reason}</li>}
                      {c.in && c.in.reason !== c.out?.reason && <li>{c.in.reason}</li>}
                    </ul>
                  </div>
                </li>
              );
            })}
          </ol>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <button className="btn-cta" disabled={!chosen.length} onClick={() => onApply(chosen)}>
              Aplicar {chosen.length} cambio(s) en una copia
            </button>
            <button className="btn" disabled={!chosen.length} onClick={copy}>
              {copied ? "¡Copiado!" : "Copiar lista de cambios"}
            </button>
          </div>
        </>
      )}

      {plan.notes.length > 0 && (
        <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-ink-3">
          {plan.notes.map((n) => <li key={n}>{n}</li>)}
        </ul>
      )}
    </div>
  );
}
