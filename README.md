# Chess Academy

A free, local-first chess opening trainer. No backend, no accounts, no paid APIs. Data is saved in your browser (IndexedDB).

## Run locally
```bash
npm install
npm run dev      # http://localhost:5173
npm test         # chess, PGN, FEN, spaced-repetition and import logic (22 tests)
python3 e2e/smoke.py dist   # optional browser smoke test, see the file header
npm run build    # static bundle in dist/
```

## Deploy to GitHub Pages
`vite.config.ts` uses `base: './'`, so `dist/` works under any repo path. Upload `dist/` to the `gh-pages` branch
(or use the "Deploy static content to Pages" GitHub Action with `npm ci && npm run build` and path `dist`).

## Status (built in the phases from the project brief)
- [x] Phase 1: board with legal moves (castling, en passant, auto-queen), preloaded repertoire (26 openings, several with multiple variations),
      create/rename/duplicate/delete openings, variation tree, SAN entry, PGN paste/file import, JSON backup export, IndexedDB persistence
- [x] Phase 2 (partial): practice mode (position-based move checking, hints, accuracy report, missed positions, sessions stored)
- [x] Phase 2: learning mode. Study a line move by move with explanations generated from the real position (purpose, squares reached, attacks,
      development), your own per-move notes (written in the editor), and a quiz with a progressive hint ladder (idea, then piece, then the move).
      Explanations are generic by design; authored per-opening commentary, common mistakes and "why does Black play..." questions are still to come.
- [x] Phase 3: Stockfish 19 (lite, single-threaded WASM, bundled in `public/stockfish`, works offline and on GitHub Pages), five real difficulty levels
      (Skill Level + depth + time), full games, undo/flip/resign/draw offer, captured pieces, strict/flexible/random/engine-only opening modes,
      post-game opening report (where you left the line, repertoire move, continuation, engine verdict)
- [x] Custom start positions: any opening can start from a FEN (editor, library form, PGN with a FEN header); engine-only games can start from any FEN
- [x] Phase 4 (part): spaced repetition (SM-2 style, one card per move you play, five mastery levels, adjustable schedule on the Statistics page),
      dashboard (all numbers computed from your stored sessions), statistics with date ranges
- [x] Phase 4 (rest): settings (light/dark theme, board colours, coordinates, interface scale, sound and volume, default side/hints/engine level/thinking time),
      export/import of repertoires, full backup and restore, reset of training progress
- [x] Phase 5 (part): synthesized sound effects (move, capture, check, castle, promotion, illegal move, game end), light theme, scalable UI
- [x] Review mode: "Review" on the dashboard starts practice where the opponent steers toward the moves that are due
- [x] PGN import keeps variations, {comments} (as move notes) and multiple games; board arrows (draw your own with right-click drag; lessons can show the next move);
      two piece styles; touch-friendly layout for phones and tablets
- [ ] Still open: more piece sets, animations beyond the board's built-in piece sliding, bundled per-opening commentary (import it via PGN comments for now)

Notes: moves can be made by dragging or by clicking a piece and then a highlighted square (legal moves are shown). Under-promotion: type the move (e.g. `e8=N`) in the editor.

Stockfish.js is GPLv3 (see `public/stockfish/COPYING.txt`).
