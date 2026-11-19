import type { Check, Level } from "../lib/analyze";

const DOT: Record<Level, string> = { ok: "bg-ok", warn: "bg-warn", bad: "bg-bad", info: "bg-info" };

export default function HealthList({ checks }: { checks: Check[] }) {
  return (
    <ul className="divide-y divide-line">
      {checks.map((c, i) => (
        <li key={i} className="flex gap-3 py-3">
          <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${DOT[c.level]}`} />
          <div>
            <p className="font-semibold">{c.title}</p>
            <p className="text-sm text-ink-2">{c.detail}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
