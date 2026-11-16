import { Opening, allLines, isLegal, validFen } from './tree';

export function download(name: string, data: unknown) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  a.download = name;
  a.click();
}

/** Guards imports: right shape, and every stored line is legal chess. */
export function validOpening(o: unknown): o is Opening {
  try {
    const x = o as Opening;
    return typeof x?.id === 'string' && typeof x.name === 'string' && typeof x.eco === 'string' && (x.side === 'w' || x.side === 'b') && Array.isArray(x.tree) && (x.fen === undefined || (typeof x.fen === 'string' && validFen(x.fen))) && allLines(x.tree).every(l => isLegal(l, x.fen));
  } catch { return false; }
}
