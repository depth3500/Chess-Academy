// Builds src/data/catalog.json from the lichess-org/chess-openings TSV files (CC0).
// Usage: node scripts/build-catalog.mjs <folder with a.tsv ... e.tsv>
import { Chess } from 'chess.js';
import fs from 'node:fs';

const dir = process.argv[2] ?? '.';
const BLACK = /Defen[cs]e|Indian|Dutch|Pirc|Benoni|Benko|Grünfeld|Nimzo|Slav|Scandinavian|Alekhine|Modern|Philidor|Petrov|Petroff|Caro-Kann|French|Sicilian|Budapest|Englund|Albin|Owen|Hippopotamus|Czech|Elephant|Latvian|Rat|St\. George|Polish|Bird.s Defen|Old Indian|Queen's Pawn Game: (Chigorin|Anglo)|Accelerated|Torre Attack: (Classical|Fianchetto)|Colle.*Zukertort Variation: Black/i;
const fams = new Map();
for (const f of 'abcde') {
  for (const row of fs.readFileSync(`${dir}/${f}.tsv`, 'utf8').split('\n').slice(1)) {
    const [eco, name, pgn] = row.split('\t');
    if (!name || !pgn) continue;
    const sans = pgn.replace(/\d+\.+/g, ' ').split(/\s+/).filter(Boolean);
    try { const c = new Chess(); sans.forEach(s => c.move(s)); } catch { continue; }
    const [fam, ...rest] = name.split(':');
    const e = fams.get(fam.trim()) ?? { n: fam.trim(), e: eco, s: /Attack|Opening/.test(fam) ? 'w' : BLACK.test(fam) || /Accepted|Declined/.test(fam) ? 'b' : 'w', l: [] };
    e.l.push([rest.join(':').trim(), sans.join(' ')]);
    fams.set(e.n, e);
  }
}
const out = [...fams.values()].map(f => {
  // number of distinct lines = leaves of the merged move tree
  const seen = new Set(f.l.map(x => x[1]));
  const leaves = [...seen].filter(a => ![...seen].some(b => b !== a && b.startsWith(a + ' '))).length;
  f.l.sort((a, b) => a[1].split(' ').length - b[1].split(' ').length);
  return { ...f, c: leaves };
}).sort((a, b) => b.c - a.c);
fs.writeFileSync(new URL('../src/data/catalog.json', import.meta.url), JSON.stringify(out));
console.log(out.length, 'families,', out.reduce((a, f) => a + f.l.length, 0), 'lines');
