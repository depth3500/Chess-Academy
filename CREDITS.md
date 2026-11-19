# Credits and licences

This project bundles third-party assets from the lichess.org source repository (https://github.com/lichess-org/lila, see its COPYING.md).
Because some of them are licensed AGPL-3.0-or-later, this repository is distributed under the **GNU Affero General Public License v3** (see `LICENSE`).
The full source of this site is the public repository it is built from.

## Piece sets (`public/pieces/`)
| Set | Author | Licence |
| --- | --- | --- |
| cburnett | Colin M.L. Burnett | GPLv2+ |
| merida | Armando Hernandez Marroquin | GPLv2+ |
| chessnut | Alexis Luengas | Apache 2.0 |
| fantasy, spatial, celtic | Maurizio Monge | MIT |
| rhosgfx | RhosGFX | CC0 1.0 |
| pixel | therealqtpi | AGPLv3+ |
| firi | James Faure | CC BY 4.0 |
| papercut | Nikolay Anzarov | CC BY 4.0 |
| mpchess | Maxime Chupin | GPLv3+ |

## Sound packs (`public/sounds/`)
sfx, piano, nes and futuristic: Enigmahack, AGPLv3+ (via lichess.org). The default "Wooden" sounds are synthesized in the browser and need no files.
The lichess "standard" sound set is **not** included: lichess lists it as non-free.

## Other data
- Opening names and move lines (`src/data/catalog.json`): lichess-org/chess-openings, CC0.
- Stockfish 19 (`public/stockfish/`): GPLv3, see `public/stockfish/COPYING.txt`.
- Font: Plus Jakarta Sans (SIL Open Font License) via Fontsource.
- Puzzles (`src/data/puzzles.json`) are generated with Stockfish by `scripts/gen-puzzles.mjs`; their ratings are engine-derived estimates.
- Game review: win-chance and accuracy formulas are the open formulas published by lichess.org; the engine is Stockfish. Game data is fetched from the public chess.com and lichess.org APIs.
