// Valida src/lib/staples.ts contra Scryfall: nombre exacto, identidad de color, legal en Commander y que no sea Game Changer.
// Uso: node scripts/validate-staples.mjs src/lib/staples.ts
import fs from "node:fs";
const src = fs.readFileSync(process.argv[2], "utf8");
// Extrae (role, ci, [names]) de las llamadas r("role", "ci", [...])
const re = /r\("(\w+)", "(\w*)", \[([^\]]*)\]/g; const staples = [];
for (const m of src.matchAll(re)) for (const n of m[3].matchAll(/"([^"]+)"/g)) staples.push({ role: m[1], ci: m[2], name: n[1] });
const dup = staples.map(s=>s.name).filter((n,i,a)=>a.indexOf(n)!==i); if (dup.length) console.log("DUPLICADAS:", dup);
const order = "WUBRG"; const norm = (s) => [...s].sort((a,b)=>order.indexOf(a)-order.indexOf(b)).join("");
let bad = 0;
for (let i = 0; i < staples.length; i += 75) {
  const batch = staples.slice(i, i + 75);
  const res = await fetch("https://api.scryfall.com/cards/collection", { method: "POST", headers: { "Content-Type": "application/json", "User-Agent": "ForjaDeMazos/0.1", Accept: "application/json" }, body: JSON.stringify({ identifiers: batch.map(s => ({ name: s.name })) }) });
  const j = await res.json();
  for (const nf of j.not_found ?? []) { console.log("NO EXISTE:", nf.name); bad++; }
  for (const c of j.data) {
    const s = batch.find(x => x.name.toLowerCase() === c.name.toLowerCase());
    if (!s) { console.log("NOMBRE DISTINTO:", c.name); bad++; continue; }
    if (norm(c.color_identity.join("")) !== norm(s.ci)) { console.log(`IDENTIDAD: ${s.name} es ${c.color_identity.join("")||"incolora"}, puse "${s.ci}"`); bad++; }
    if (c.game_changer) { console.log("GAME CHANGER:", s.name); bad++; }
    if (c.legalities?.commander !== "legal") { console.log("NO LEGAL:", s.name); bad++; }
  }
  await new Promise(r => setTimeout(r, 150));
}
console.log(`${staples.length} cartas revisadas, ${bad} problemas`);
