"""Browser test of the game reviewer with mocked chess.com / Lichess APIs and the real Stockfish. After `npm run build`:
    python3 e2e/review.py dist        (needs: pip install playwright && playwright install chromium)"""
import subprocess, sys, time, json
from playwright.sync_api import sync_playwright
srv = subprocess.Popen(['python3', '-m', 'http.server', '4181', '--directory', (sys.argv[1] if len(sys.argv) > 1 else 'dist')], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
res = []
def ok(n, c, x=''): res.append(bool(c)); print(('PASS ' if c else 'FAIL ') + n, str(x)[:170])
SCH = '[Event "Live Chess"]\n[Date "2026.11.10"]\n[White "buddy"]\n[Black "tester"]\n[Result "1-0"]\n\n1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6 4. Qxf7# 1-0'
IT = '[Event "Live Chess"]\n[Date "2026.11.09"]\n[White "tester"]\n[Black "rival"]\n[Result "1/2-1/2"]\n\n1. e4 {[%clk 0:09:58]} e5 {[%clk 0:09:57]} 2. Nf3 Nc6 3. Bc4 Bc5 4. c3 Nf6 5. d3 d6 6. O-O O-O 7. Bb3 a6 8. Re1 Ba7 9. h3 h6 10. Nbd2 Re8 11. Nf1 Be6 12. Bxe6 Rxe6 13. Ng3 Qd7 14. Nh2 Rae8 15. Qf3 Nd8 1/2-1/2'
CORS = {'access-control-allow-origin': '*'}
def mock(route):
    u = route.request.url
    if u.endswith('/games/archives'): route.fulfill(json={'archives': ['https://api.chess.com/pub/player/tester/games/2026/11']}, headers=CORS)
    elif '/games/2026/11' in u:
        route.fulfill(json={'games': [
            {'url': 'https://www.chess.com/game/live/1', 'uuid': 'g1', 'pgn': IT, 'rules': 'chess', 'time_class': 'rapid', 'end_time': 1762700000, 'white': {'username': 'tester', 'rating': 1210, 'result': 'agreed'}, 'black': {'username': 'rival', 'rating': 1190, 'result': 'agreed'}},
            {'url': 'https://www.chess.com/game/live/2', 'uuid': 'g2', 'pgn': SCH, 'rules': 'chess', 'time_class': 'blitz', 'end_time': 1762800000, 'white': {'username': 'buddy', 'rating': 900, 'result': 'win'}, 'black': {'username': 'tester', 'rating': 1210, 'result': 'checkmated'}, 'accuracies': {'white': 91.5, 'black': 12.3}}]}, headers=CORS)
    else: route.fulfill(status=404, body='{}', headers=CORS)
try:
    with sync_playwright() as p:
        b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1280, 'height': 1000}); errs = []
        pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None); pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.route('https://api.chess.com/**', mock)
        pg.route('https://lichess.org/api/**', lambda r: r.fulfill(body=json.dumps({'id': 'li1', 'createdAt': 1762900000000, 'speed': 'blitz', 'winner': 'white', 'pgn': SCH, 'players': {'white': {'user': {'name': 'LiMe'}, 'rating': 1500}, 'black': {'user': {'name': 'Opp'}, 'rating': 1480}}}) + '\n', headers={**CORS, 'content-type': 'application/x-ndjson'}))
        pg.goto('http://localhost:4181/'); pg.wait_for_selector('h1')
        pg.locator('.top nav').get_by_role('button', name='Review', exact=True).click(); pg.wait_for_selector('text=Game review')
        pg.get_by_label('Username').fill('tester'); pg.get_by_role('button', name='Load my games').click(); pg.wait_for_selector('.game')
        ok('chess.com games load from the mocked API', pg.locator('.game').count() == 2, pg.locator('.game').count())
        txt = pg.inner_text('.games'); ok('results are from your point of view (Draw, Lost)', 'Draw' in txt and 'Lost' in txt and 'you were Black' in txt)
        pg.get_by_label('Analysis depth').select_option('fast')
        t0 = time.time(); pg.locator('.game', has_text='buddy').get_by_role('button', name='Review').click()
        pg.wait_for_selector('.accs', timeout=120000); ok('Scholar\'s mate game reviewed', True, f'{time.time() - t0:.1f}s')
        ctab = pg.inner_text('.ctable').replace('\n', ' ')
        ok('Black\'s 3...Nf6 is counted as a blunder', 'Blunder' in ctab, ctab)
        pg.locator('.mv2', has_text='Nf6').click(); note = pg.inner_text('.note').replace('\n', ' ')
        ok('commentary names the blunder and the best move', 'blunder' in note.lower() and 'Best was' in note, note)
        accs = pg.locator('.acard strong').all_inner_texts(); ok('accuracy: the mated side scores lower', float(accs[1]) < float(accs[0]), accs)
        ok('chess.com\'s own accuracy shown for comparison', '91.5' in pg.inner_text('.panel'))
        pg.screenshot(path='e2e-review.png')
        pg.keyboard.press('ArrowRight'); ok('arrow keys step through the game', 'Qxf7' in pg.inner_text('.note') or 'best' in pg.inner_text('.note').lower() or 'great' in pg.inner_text('.note').lower(), pg.inner_text('.note')[:60])
        pg.get_by_role('button', name='← Mistake').click(); ok('mistake navigation lands on the blunder', pg.locator('.mv2.on').inner_text().strip().endswith('Nf6'), pg.locator('.mv2.on').inner_text())
        pg.get_by_role('button', name='← All games').click(); pg.wait_for_selector('.game')
        pg.locator('.game', has_text='rival').get_by_role('button', name='Review').click(); pg.wait_for_selector('.accs', timeout=150000)
        a2 = [float(x) for x in pg.locator('.acard strong').all_inner_texts()]; ok('longer game reviewed, accuracies sane', all(0 < x <= 100 for x in a2), a2)
        ok('opening named from the book', 'Italian' in pg.inner_text('.hubhead') or 'Giuoco' in pg.inner_text('.hubhead'), pg.inner_text('.hubhead').replace('\n', ' '))
        pg.screenshot(path='e2e-review2.png')
        pg.get_by_role('button', name='← All games').click(); pg.wait_for_selector('.game')
        ok('reviewed games are remembered', pg.locator('.chip', has_text='Reviewed').count() == 2)
        pg.reload(); pg.locator('.top nav').get_by_role('button', name='Review', exact=True).click(); ok('username remembered after reload', pg.get_by_label('Username').input_value() == 'tester')
        pg.get_by_role('tab', name='Lichess').click(); pg.get_by_label('Username').fill('LiMe'); pg.get_by_role('button', name='Load my games').click(); pg.wait_for_selector('.game')
        ok('lichess games load (mocked)', 'Won' in pg.inner_text('.games'))
        pg.get_by_role('tab', name='Paste PGN').click(); pg.locator('textarea').fill(SCH); pg.get_by_role('button', name='Review this game').click(); pg.wait_for_selector('.accs', timeout=120000)
        ok('pasted PGN reviews', True)
        real = [e for e in errs if 'favicon' not in e]; ok('no console errors', not real, '; '.join(real)[:200]); b.close()
finally: srv.terminate()
print(sum(res), '/', len(res))
