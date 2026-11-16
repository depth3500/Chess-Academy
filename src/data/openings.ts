import { Opening, addLine, isLegal } from '../lib/tree';

// [name, ECO, side, lines separated by "|"]. Illegal lines are skipped at load time (and caught by tests).
export const SEED: [string, string, 'w' | 'b', string][] = [
  ['Italian Game', 'C50', 'w', 'e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3 d6 O-O O-O|e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5 d5 exd5 Na5 Bb5+ c6 dxc6 bxc6 Be2 h6'],
  ['Ruy Lopez', 'C60', 'w', 'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 d6 c3 O-O|e4 e5 Nf3 Nc6 Bb5 Nf6 O-O Nxe4 d4 Nd6 Bxc6 dxc6 dxe5 Nf5'],
  ["Queen's Gambit", 'D20', 'w', 'd4 d5 c4 dxc4 Nf3 Nf6 e3 e6 Bxc4 c5 O-O a6|d4 d5 c4 e6 Nc3 Nf6 Bg5 Be7 e3 O-O Nf3 Nbd7'],
  ['English Opening', 'A20', 'w', 'c4 e5 Nc3 Nf6 Nf3 Nc6 g3 d5 cxd5 Nxd5 Bg2 Nb6 O-O Be7'],
  ['London System', 'D02', 'w', 'd4 d5 Bf4 Nf6 e3 e6 Nf3 Bd6 Bg3 O-O Nbd2 c5 c3 Nc6'],
  ['Scotch Game', 'C45', 'w', 'e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Nf6 Nxc6 bxc6 e5 Qe7 Qe2 Nd5 c4 Ba6'],
  ["King's Indian Attack", 'A07', 'w', 'Nf3 d5 g3 Nf6 Bg2 c5 O-O Nc6 d3 e5 Nbd2 Be7 e4 O-O'],
  ['Smith-Morra Gambit', 'B21', 'w', 'e4 c5 d4 cxd4 c3 dxc3 Nxc3 Nc6 Nf3 d6 Bc4 e6 O-O Nf6 Qe2 Be7 Rd1 e5'],
  ["King's Gambit", 'C33', 'w', 'e4 e5 f4 exf4 Nf3 g5 h4 g4 Ne5 Nf6 Bc4 d5 exd5 Bd6 d4 Nh5'],
  ['Danish Gambit', 'C21', 'w', 'e4 e5 d4 exd4 c3 dxc3 Bc4 cxb2 Bxb2 d5 Bxd5 Nf6'],
  ['Sicilian Defense', 'B90', 'b', 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Be3 e5 Nb3 Be6 f3 Be7 Qd2 O-O O-O-O|e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 g6 Be3 Bg7 f3 O-O Qd2 Nc6'],
  ['Caro-Kann Defense', 'B12', 'b', 'e4 c6 d4 d5 Nc3 dxe4 Nxe4 Bf5 Ng3 Bg6 h4 h6 Nf3 Nd7 h5 Bh7 Bd3 Bxd3 Qxd3 e6'],
  ['Scandinavian Defense', 'B01', 'b', 'e4 d5 exd5 Qxd5 Nc3 Qa5 d4 Nf6 Nf3 c6 Bc4 Bf5'],
  ['French Defense', 'C11', 'b', 'e4 e6 d4 d5 Nc3 Nf6 Bg5 Be7 e5 Nfd7 Bxe7 Qxe7 f4 O-O'],
  ['Pirc Defense', 'B07', 'b', 'e4 d6 d4 Nf6 Nc3 g6 Nf3 Bg7 Be2 O-O O-O c6'],
  ['Alekhine Defense', 'B04', 'b', 'e4 Nf6 e5 Nd5 d4 d6 Nf3 Bg4 Be2 e6 O-O Be7 c4 Nb6'],
  ["King's Indian Defense", 'E97', 'b', 'd4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Nf3 O-O Be2 e5 O-O Nc6 d5 Ne7'],
  ['Slav Defense', 'D17', 'b', 'd4 d5 c4 c6 Nf3 Nf6 Nc3 dxc4 a4 Bf5 e3 e6 Bxc4 Bb4 O-O Nbd7 Qe2 Bg6'],
  ['Semi-Slav Defense', 'D43', 'b', 'd4 d5 c4 c6 Nf3 Nf6 Nc3 e6 Bg5 h6 Bh4 dxc4 e4 g5 Bg3 b5'],
  ["Queen's Gambit Declined", 'D37', 'b', 'd4 d5 c4 e6 Nc3 Nf6 Bg5 Be7 e3 O-O Nf3 h6 Bh4 b6'],
  ['Nimzo-Indian Defense', 'E32', 'b', 'd4 Nf6 c4 e6 Nc3 Bb4 Qc2 O-O a3 Bxc3+ Qxc3 b6 Bg5 Bb7'],
  ['Dutch Defense', 'A87', 'b', 'd4 f5 g3 Nf6 Bg2 e6 Nf3 Be7 O-O O-O c4 d6'],
  ['Grünfeld Defense', 'D85', 'b', 'd4 Nf6 c4 g6 Nc3 d5 cxd5 Nxd5 e4 Nxc3 bxc3 Bg7 Nf3 c5 Rb1 O-O'],
  ['Englund Gambit', 'A40', 'b', 'd4 e5 dxe5 Nc6 Nf3 Qe7 Bf4 Qb4+ Bd2 Qxb2 Bc3 Bb4'],
  ['Stafford Gambit', 'C42', 'b', 'e4 e5 Nf3 Nf6 Nxe5 Nc6 Nxc6 dxc6 d3 Bc5 Be2 h5'],
  ['Budapest Gambit', 'A52', 'b', 'd4 Nf6 c4 e5 dxe5 Ng4 Bf4 Nc6 Nf3 Bb4+ Nbd2 Qe7 a3 Ngxe5'],
];

export function seedOpenings(): Opening[] {
  return SEED.map(([name, eco, side, m]) => {
    const o: Opening = { id: name.toLowerCase().replace(/\W+/g, '-') + '-' + side, name, eco, side, tree: [] };
    m.split('|').forEach(l => { const s = l.split(' '); if (isLegal(s)) addLine(o.tree, s); });
    return o;
  });
}
