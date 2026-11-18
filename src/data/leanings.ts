// Editorial estimates of how each opening feels, from -100 to +100:
//   pt: positional (-) to tactical (+)    da: defensive (-) to aggressive (+)    eb: easy (-) to bookworm (+)
// "eb" is computed from how many lines there are to learn; pt and da are hand-set for well-known openings and
// guessed from the name for the rest. They are opinions, not engine measurements.
export type Leaning = { pt: number; da: number; eb: number };

const SET: Record<string, [number, number]> = {
  'Italian Game': [25, 20], 'Ruy Lopez': [-40, 0], 'Sicilian Defense': [55, 35], 'French Defense': [-35, -25], 'Caro-Kann Defense': [-50, -35],
  'Scandinavian Defense': [10, 0], 'Pirc Defense': [30, 5], 'Alekhine Defense': [20, 10], 'Modern Defense': [15, -5], 'Philidor Defense': [-30, -40],
  "Petrov's Defense": [-35, -45], 'Scotch Game': [40, 40], 'Vienna Game': [30, 30], 'Four Knights Game': [-20, -10], "King's Gambit Accepted": [75, 85],
  "King's Gambit Declined": [60, 70], 'Danish Gambit': [80, 90], "Bishop's Opening": [10, 15], 'English Opening': [-40, 10], 'Réti Opening': [-55, -5],
  'Catalan Opening': [-60, 5], "King's Indian Attack": [-25, 0], "Queen's Gambit Declined": [-55, -25], "Queen's Gambit Accepted": [-30, -15],
  'Slav Defense': [-55, -30], 'Semi-Slav Defense': [35, 5], 'Nimzo-Indian Defense': [-35, -10], "Queen's Indian Defense": [-60, -35],
  "King's Indian Defense": [45, 50], 'Grünfeld Defense': [40, 30], 'Benoni Defense': [45, 40], 'Dutch Defense': [35, 45], 'Budapest Gambit': [60, 65],
  'Englund Gambit': [80, 85], 'Blackmar-Diemer Gambit Accepted': [85, 95], 'Latvian Gambit': [85, 90], 'Center Game': [55, 70], "Queen's Pawn Game": [-35, -5],
  'Bird Opening': [35, 40], 'Zukertort Opening': [-30, -5], 'Indian Defense': [-10, -15], 'Old Indian Defense': [-30, -30], 'Nimzo-Larsen Attack': [-45, 5],
  'Torre Attack': [-35, 5], 'Hungarian Opening': [-30, -10], 'Polish Opening': [10, 10], 'Grob Opening': [40, 55], 'Owen Defense': [-10, -20],
};

const clamp = (n: number) => Math.max(-90, Math.min(90, Math.round(n)));

export function leaning(name: string, side: 'w' | 'b', lines: number): Leaning {
  let [pt, da] = SET[name] ?? [0, side === 'b' ? -15 : 5];
  if (!SET[name]) {
    if (/Gambit/.test(name)) { pt += 50; da += 50; }
    if (/Attack/.test(name)) { pt += 25; da += 25; }
  }
  return { pt: clamp(pt), da: clamp(da), eb: clamp((Math.log2(Math.max(1, lines)) - 3.5) * 28) };
}

/** One short sentence such as "Leans tactical and aggressive, a lot of theory". */
export function describe(l: Leaning) {
  const a = [l.pt >= 20 ? 'tactical' : l.pt <= -20 ? 'positional' : '', l.da >= 20 ? 'aggressive' : l.da <= -20 ? 'defensive' : ''].filter(Boolean);
  const e = l.eb >= 30 ? 'lots of theory to learn' : l.eb <= -30 ? 'easy to pick up' : 'a moderate amount of theory';
  return `${a.length ? 'Leans ' + a.join(' and ') : 'Balanced in style'}, ${e}.`;
}
