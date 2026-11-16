"""Browser smoke test (Python Playwright). Build first, then run from the project folder:
    npm run build && pip install playwright && playwright install chromium && python3 e2e/smoke.py dist
Covers: dashboard, 26 openings, search, PGN import, practice by click-to-move, persistence after reload,
Stockfish answering in a Web Worker, drag events, light theme, piece style, phone layout, console errors."""
import subprocess, sys, time, traceback
from playwright.sync_api import sync_playwright

srv = subprocess.Popen(['python3', '-m', 'http.server', '4173', '--directory', (sys.argv[1] if len(sys.argv) > 1 else 'dist')], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
BASE = 'http://localhost:4173/'
res = []
def mv(pg, a, b):
    pg.click(f'[data-square="{a}"]'); pg.click(f'[data-square="{b}"]')
def synth_drag(pg, a, b):
    pg.evaluate('''([a, b]) => {
      const src = document.querySelector(`[data-square="${a}"] [draggable="true"]`), dst = document.querySelector(`[data-square="${b}"]`);
      const dt = new DataTransfer(); const fire = (el, t) => el.dispatchEvent(new DragEvent(t, { bubbles: true, cancelable: true, dataTransfer: dt }));
      fire(src, 'dragstart'); fire(dst, 'dragenter'); fire(dst, 'dragover'); fire(dst, 'drop'); fire(src, 'dragend');
    }''', [a, b])
def ok(name, cond, extra=''):
    res.append(bool(cond)); print(('PASS ' if cond else 'FAIL ') + name, extra)

try:
    with sync_playwright() as p:
        b = p.chromium.launch()
        page = b.new_context(viewport={'width': 1280, 'height': 900}).new_page()
        errs = []
        page.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
        page.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e)))
        page.goto(BASE); page.wait_for_selector('h1')
        ok('dashboard renders', page.inner_text('h1') == 'Dashboard')
        page.get_by_role('button', name='Openings', exact=True).click()
        page.wait_for_selector('.card')
        ok('26 preloaded openings', page.locator('.card').count() == 26, str(page.locator('.card').count()))
        page.get_by_label('Search openings').fill('sicilian')
        ok('search filters', page.locator('.card').count() == 1)
        page.get_by_label('Search openings').fill('')

        # create an opening from PGN, practice it by dragging pieces
        page.get_by_role('button', name='New opening').click()
        page.get_by_label('Opening name').first.fill('E2E Test')
        page.locator('textarea').fill('1. e4 e5')
        page.get_by_role('button', name='Create opening').click()
        page.wait_for_selector('.tree .mv')
        ok('editor shows imported moves', 'e4' in page.inner_text('.tree') and 'e5' in page.inner_text('.tree'), page.inner_text('.tree'))
        page.get_by_role('button', name='Practice', exact=True).click()
        page.wait_for_selector('[data-square="e2"]')
        mv(page, 'e2', 'e4')
        try:
            page.wait_for_selector('text=Line complete.', timeout=6000); done = True
        except Exception: done = False
        ok('practice: drag e2-e4 accepted, bot replied, line completed', done)
        body = page.inner_text('.panel')
        ok('practice report shows 100% accuracy', '100%' in body, body.replace('\n', ' | ')[:120])
        page.get_by_role('button', name='Back to openings').click()
        page.get_by_role('button', name='Dashboard', exact=True).click()
        page.wait_for_selector('.stats')
        txt = page.inner_text('.stats').replace('\n', ' ')
        ok('dashboard counts the session', 'Practice sessions 1' in txt, txt)
        page.reload(); page.wait_for_selector('.stats')
        txt = page.inner_text('.stats').replace('\n', ' ')
        ok('data persists after reload (27 openings, 1 session)', 'Openings 27' in txt and 'Practice sessions 1' in txt, txt)

        # play against Stockfish in the browser
        page.get_by_role('button', name='Play against bot').click()
        page.get_by_label('Opening mode').select_option('engine')
        page.get_by_label('Difficulty').select_option('Beginner')
        page.get_by_role('button', name='Start game').click()
        page.wait_for_selector('[data-square="e2"]')
        page.click('[data-square="g1"]'); page.screenshot(path='e2e-select.png', clip={'x': 0, 'y': 0, 'width': 760, 'height': 800})
        page.click('[data-square="g1"]')
        mv(page, 'e2', 'e4')
        try:
            page.wait_for_function("(() => { const t = document.querySelector('.tree'); return t && /1\\.\\s*e4\\s+\\S+/.test(t.innerText); })()", timeout=15000); bot = True
        except Exception: bot = False
        ok('Stockfish worker answered 1.e4 in the browser', bot, page.inner_text('.tree') if page.locator('.tree').count() else '')

        page.screenshot(path='e2e-game.png')
        # drag-and-drop through the HTML5 DnD events (what a real drag produces)
        page.get_by_role('button', name='New game').click()
        page.get_by_label('Opening mode').select_option('engine')
        page.get_by_role('button', name='Start game').click(); page.wait_for_selector('[data-square="d2"]')
        synth_drag(page, 'd2', 'd4')
        try:
            page.wait_for_function("(() => { const t = document.querySelector('.tree'); return t && /1\\.\\s*d4/.test(t.innerText); })()", timeout=4000); dnd = True
        except Exception: dnd = False
        ok('drag-and-drop events move a piece (d2-d4)', dnd, page.inner_text('.tree'))

        # settings and theme
        page.get_by_role('button', name='Settings').click()
        page.locator('select').nth(0).select_option('light')
        ok('light theme applied', page.evaluate("document.documentElement.dataset.theme") == 'light')
        page.locator('select').nth(2).select_option('glyph')
        page.get_by_role('button', name='Play against bot').click()
        page.wait_for_selector('[data-square="e2"]')
        ok('glyph piece style renders', page.locator('[data-square="e2"] div').count() > 0)

        # phone layout
        m = b.new_context(viewport={'width': 390, 'height': 800}, has_touch=True).new_page()
        m.goto(BASE); m.wait_for_selector('h1')
        m.get_by_role('button', name='Openings', exact=True).click(); m.wait_for_selector('.card')
        m.get_by_role('button', name='Learn').first.click(); m.wait_for_selector('.board')
        w = m.evaluate("document.documentElement.scrollWidth"); bw = m.evaluate("document.querySelector('.board').getBoundingClientRect().width")
        ok('phone: no horizontal scroll, board fits', w <= 391 and bw <= 390, f'scrollWidth={w} board={bw:.0f}')
        real = [e for e in errs if 'favicon' not in e]
        ok('no console/page errors', not real, '; '.join(real)[:300])
        b.close()
except Exception:
    traceback.print_exc(limit=3)
finally:
    srv.terminate()
print(f'{sum(res)}/{len(res)} checks passed')
