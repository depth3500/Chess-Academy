# Chess Academy

A free, local-first chess opening trainer. No backend, no accounts, no paid APIs. Data is saved in your browser (IndexedDB).

## Run locally
```bash
npm install
npm run dev      # http://localhost:5173
npm test         # chess, PGN, FEN, spaced-repetition and import logic (42 tests)
python3 e2e/smoke.py dist   # optional browser smoke test, see the file header
npm run build    # static bundle in dist/
```

## Deploy to GitHub Pages
1. Create an empty repository on GitHub (public repositories get Pages for free).
2. Push this folder to its `main` branch.
3. In the repository, open **Settings > Pages** and set **Source** to **GitHub Actions**.
4. The workflow in `.github/workflows/deploy.yml` tests, builds and publishes on every push to `main`.
   Your site appears at `https://<your-username>.github.io/<repository-name>/` (see the **Actions** tab for progress).

`vite.config.ts` uses `base: './'`, so the build works under any repository name. Your openings and progress are stored in the browser (IndexedDB),
so the deployed site starts with its own empty data, separate from `localhost`. Use Settings > Export backup / Restore backup to move data between them.

## Online accounts (optional, free)
Without this the app works exactly as before and keeps data in the browser. With it, you sign in and your openings and progress follow you to every device.
1. Create a free project at supabase.com.
2. Dashboard > SQL Editor > New query: paste `supabase/schema.sql` and run it (creates one table with row level security, so users only see their own data).
3. Authentication > Providers > Email: keep it enabled. Turn off "Confirm email" if you want sign-up to work instantly.
4. Authentication > URL Configuration: set Site URL to your GitHub Pages address.
5. Project Settings > API: copy the Project URL and the `anon public` key (it is meant to be public).
6. GitHub repo > Settings > Secrets and variables > Actions > **Variables** tab: add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, then re-run the deploy workflow.
   For local development copy `.env.example` to `.env.local` and fill in the same two values.

How sync works: openings and the review schedule use "newest edit wins"; sessions, lessons and per-move progress are merged so nothing is lost when two devices both practised;
"Reset training progress" also resets your other devices. Signing in as a different account on the same browser clears the previous account's local data first.

## More puzzles
`src/data/puzzles.json` has 310 puzzles generated with Stockfish. To add more (the daily puzzle is `day number mod puzzle count`):
```bash
MIN_SOLVE=3 node scripts/gen-puzzles.mjs more.jsonl 123 30      # 30 minutes of hunting for harder puzzles (seed 123)
node scripts/build-puzzles.mjs old.jsonl more.jsonl              # merges, estimates ratings, writes src/data/puzzles.json
```
Ratings are engine-based estimates (search depth needed, quiet moves, mate length, piece count), not rated-player statistics.

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
- [x] Redesign: Plus Jakarta Sans (bundled, works offline), hover/press/focus states and page transitions, Midnight / Charcoal / Aurora (animated) / Light themes with five accent colours
- [x] Explore page: 149 opening families and 3,800+ lines from the open lichess database, each with a position preview, description, line count and one-click "Add to repertoire"
- [x] Board: legal-move dots the moment a piece is grabbed (readable on every board theme), pick pieces up on the opponent's turn, premoves in Play, snappier animation, richer synthesized sounds
- [x] Optional online accounts with cloud sync (Supabase), see above
- [x] Opening hub: every opening shows its named lines (e.g. "Giuoco Pianissimo, Dubois Variation"), a "5 of 26 lines learned" progress bar, search and status filters, and Learn / Practice per line.
      A line counts as learned once every move you play in it was answered correctly twice (Learn quiz and Practice both count).
- [x] Style scales for every opening: positional-tactical, defensive-aggressive, easy-bookworm (hand-set for ~50 well-known openings, estimated for the rest; "bookworm" comes from how many lines there are)
- [x] Explore: star favorites, open any opening to try it (stars keep it in My openings), filter by side, first move, style and favorites, sort by style or size
- [x] Daily puzzle (a new puzzle every day from a stored set of Stockfish-generated puzzles with estimated ratings), plus random puzzles by difficulty
- [x] Piece sets (11 from lichess) and sound packs (Lichess SFX, Piano, NES, Futuristic, or synthesized wood). Licences: see CREDITS.md. The project is now AGPL-3.0.
- [ ] Still open: editing the shared catalog from the website, more piece sets, animations beyond the board's built-in piece sliding, bundled per-opening commentary (import it via PGN comments for now)

Notes: moves can be made by dragging or by clicking a piece and then a highlighted square (legal moves are shown). Under-promotion: type the move (e.g. `e8=N`) in the editor.

Opening catalog (Explore page): generated by `scripts/build-catalog.mjs` from the lichess-org/chess-openings database (CC0, 149 families, 3,800+ lines).
Stockfish.js is GPLv3 (see `public/stockfish/COPYING.txt`).
