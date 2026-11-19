import { useMemo, useState } from "react";
import { primaryType } from "../lib/analyze";
import { ROLE_LABEL } from "../lib/roles";
import type { DeckCard, Role } from "../lib/types";

const TYPE_LABEL: Record<string, string> = {
  Creature: "Criaturas", Planeswalker: "Planeswalkers", Battle: "Batallas", Instant: "Instantáneos",
  Sorcery: "Conjuros", Artifact: "Artefactos", Enchantment: "Encantamientos", Land: "Tierras", Other: "Otras",
};
const ORDER = ["Creature", "Planeswalker", "Battle", "Instant", "Sorcery", "Artifact", "Enchantment", "Land", "Other"];

export default function CardList({ cards, roleCounts }: { cards: DeckCard[]; roleCounts: Record<Role, number> }) {
  const [filter, setFilter] = useState<Role | "all">("all");
  const [preview, setPreview] = useState<DeckCard | null>(null);

  const groups = useMemo(() => {
    const g: Record<string, DeckCard[]> = {};
    cards
      .filter((c) => !c.isCommander && (filter === "all" || c.roles.includes(filter)))
      .forEach((c) => (g[primaryType(c)] ??= []).push(c));
    Object.values(g).forEach((l) => l.sort((a, b) => a.cmc - b.cmc || a.name.localeCompare(b.name)));
    return ORDER.filter((t) => g[t]).map((t) => [t, g[t]] as const);
  }, [cards, filter]);

  const filters = (Object.keys(ROLE_LABEL) as Role[]).filter((r) => roleCounts[r] > 0);

  return (
    <div className="relative">
      <div className="mb-4 flex flex-wrap gap-1.5">
        {(["all", ...filters] as const).map((r) => (
          <button
            key={r}
            onClick={() => setFilter(r)}
            className={`btn min-h-8 px-3 text-xs ${filter === r ? "border-brand text-brand" : ""}`}
          >
            {r === "all" ? "Todas" : `${ROLE_LABEL[r]} (${roleCounts[r]})`}
          </button>
        ))}
      </div>

      <div className="gap-6 md:columns-2">
        {groups.map(([type, list]) => (
          <div key={type} className="mb-5 break-inside-avoid">
            <h4 className="mb-1 text-xs font-bold tracking-widest text-brand uppercase">
              {TYPE_LABEL[type]} ({list.reduce((s, c) => s + c.qty, 0)})
            </h4>
            {list.map((c) => (
              <div
                key={c.name}
                className="flex items-center justify-between gap-2 border-b border-dashed border-line py-1.5 text-sm"
                onMouseEnter={() => setPreview(c)}
                onMouseLeave={() => setPreview(null)}
              >
                <a href={c.scryfallUri} target="_blank" rel="noreferrer" className="hover:text-brand">
                  {c.qty > 1 && `${c.qty}× `}{c.name}
                </a>
                <span className="flex flex-wrap justify-end gap-1">
                  {c.gameChanger && <Tag className="border-warn text-warn">GC</Tag>}
                  {c.roles.map((r) => <Tag key={r}>{ROLE_LABEL[r]}</Tag>)}
                  {!c.types.includes("Land") && <Tag>{c.cmc}</Tag>}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>

      {preview?.image && (
        <img
          src={preview.image}
          alt={preview.name}
          className="pointer-events-none fixed right-6 bottom-6 z-50 hidden w-60 rounded-xl shadow-2xl lg:block"
        />
      )}
    </div>
  );
}

function Tag({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <span className={`rounded-full border border-line-2 px-2 text-[11px] whitespace-nowrap text-ink-3 ${className}`}>{children}</span>;
}
