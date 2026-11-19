import type { ManaColor } from "../lib/types";

export const COLOR_NAME: Record<ManaColor, string> = { W: "Blanco", U: "Azul", B: "Negro", R: "Rojo", G: "Verde", C: "Incoloro" };
export const COLOR_VAR: Record<ManaColor, string> = {
  W: "var(--color-mana-w)", U: "var(--color-mana-u)", B: "var(--color-mana-b)",
  R: "var(--color-mana-r)", G: "var(--color-mana-g)", C: "var(--color-mana-c)",
};

export function ManaPips({ colors }: { colors: ManaColor[] }) {
  const list = colors.length ? colors : (["C"] as ManaColor[]);
  return (
    <span className="inline-flex gap-1">
      {list.map((c) => (
        <span
          key={c}
          title={COLOR_NAME[c]}
          className="grid h-6 w-6 place-items-center rounded-full border border-black/30 text-[11px] font-bold text-black"
          style={{ background: COLOR_VAR[c] }}
        >
          {c}
        </span>
      ))}
    </span>
  );
}

export function CurveChart({ curve }: { curve: number[] }) {
  const W = 480, H = 210, pad = 28, bw = (W - pad * 2) / curve.length;
  const max = Math.max(1, ...curve);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Curva de maná">
      {curve.map((v, i) => {
        const h = ((H - pad * 2) * v) / max;
        const x = pad + i * bw + 6;
        const y = H - pad - h;
        const w = bw - 12;
        return (
          <g key={i}>
            <rect x={x} y={y} width={w} height={h} rx={6} fill="var(--color-cta-2)" />
            {v > 0 && <text x={x + w / 2} y={y - 7} textAnchor="middle" fontSize={13} fill="var(--color-ink)">{v}</text>}
            <text x={x + w / 2} y={H - pad + 18} textAnchor="middle" fontSize={12} fill="var(--color-ink-3)">
              {i === curve.length - 1 ? `${i}+` : i}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export interface BarRow {
  key: string;
  label: string;
  value: number;
  color?: string;
}

export function Bars({ rows }: { rows: BarRow[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (!rows.length) return <p className="text-sm text-ink-3">Sin datos</p>;
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.key} className="grid grid-cols-[110px_1fr_40px] items-center gap-2 text-sm">
          <span>{r.label}</span>
          <span className="h-3 overflow-hidden rounded-full bg-raise">
            <span className="block h-full rounded-full" style={{ width: `${(r.value / max) * 100}%`, background: r.color ?? "var(--color-brand)" }} />
          </span>
          <span className="text-right text-ink-3 tabular-nums">{Math.round(r.value * 10) / 10}</span>
        </div>
      ))}
    </div>
  );
}
