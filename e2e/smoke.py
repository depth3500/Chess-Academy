"""Browser smoke test (Python Playwright). Build first, then from the project folder:
    npm run build && pip install playwright pillow && playwright install chromium && python3 e2e/smoke.py dist
Checks legal-move dots on every board theme (click and grab), pickup and premoves while the bot moves, practice refusing drops on the
opponent's turn, the Explore catalog, theme and accent switching, and console errors. Screenshots are written to the current folder."""
import subprocess, sys, time
from playwright.sync_api import sync_playwright
srv = subprocess.Popen(['python3', '-m', 'http.server', '4174', '--directory', (sys.argv[1] if len(sys.argv) > 1 else 'dist')], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
B = 'http://localhost:4174/'
res = []
def ok(n, c, x=''):
    res.append(bool(c)); print(('PASS ' if c else 'FAIL ') + n, x)
def nav(pg, name): pg.locator('.top nav').get_by_role('button', name=name, exact=True).click()
def bg(pg, sq): return pg.evaluate('(s) => { const el = document.querySelector(`[data-square="${s}"]`); return [el, ...el.querySelectorAll("*")].map(e => getComputedStyle(e).backgroundImage).join(" "); }', sq)
try:
    with sync_playwright() as p:
        b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1280, 'height': 900}); errs = []
        pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None); pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(B); pg.wait_for_selector('h1'); pg.screenshot(path='e2e-dash.png')
        # legal-move dots on every board theme, by click and by drag start
        shots = []
        for theme in ['green', 'brown', 'blue']:
            nav(pg, 'Settings'); pg.locator('select').nth(2).select_option(theme)
            nav(pg, 'Play'); pg.get_by_label('Opening mode').select_option('engine'); pg.get_by_role('button', name='Start game').click()
            pg.wait_for_selector('[data-square="g1"]'); pg.click('[data-square="g1"]')
            ok(f'{theme}: dots after click', 'radial-gradient' in bg(pg, 'f3') and 'radial-gradient' in bg(pg, 'h3'))
            pg.screenshot(path=f'e2e-dots_{theme}.png', clip=pg.locator('.board').bounding_box()); shots.append(f'e2e-dots_{theme}.png')
            pg.click('[data-square="g1"]')
            r = pg.locator('[data-square="e2"]').bounding_box(); pg.mouse.move(r['x'] + r['width'] / 2, r['y'] + r['height'] / 2); pg.mouse.down()
            time.sleep(.2); ok(f'{theme}: dots as soon as a piece is grabbed', 'radial-gradient' in bg(pg, 'e3') and 'radial-gradient' in bg(pg, 'e4')); pg.mouse.up()
        try:
            from PIL import Image
        except ImportError:
            Image = None
        if Image:
            ims = [Image.open(s) for s in shots]; w = sum(i.width for i in ims) + 20; m = Image.new('RGB', (w, ims[0].height), 'white'); x = 0
            for i in ims: m.paste(i, (x, 0)); x += i.width + 10
            m.resize((w // 2, ims[0].height // 2)).save('e2e-dots_all.png')


        # premove in Play (bot moving), plus pickup during the bot's turn
        nav(pg, 'Settings'); pg.locator('select').nth(2).select_option('green')
        nav(pg, 'Play'); pg.get_by_label('Opening mode').select_option('engine'); pg.get_by_label('Difficulty').select_option('Beginner')
        pg.get_by_role('button', name='Start game').click(); pg.wait_for_selector('[data-square="e2"]')
        pg.click('[data-square="e2"]'); pg.click('[data-square="e4"]')
        pg.click('[data-square="d2"]'); ok('pickup while the bot is thinking shows moves', 'radial-gradient' in bg(pg, 'd3'))
        pg.click('[data-square="d4"]'); ok('premove queued (cancel button)', pg.get_by_role('button', name='Cancel premove').count() == 1)
        try: pg.wait_for_function("/2\\.\\s*d4/.test(document.querySelector('.tree').innerText)", timeout=8000); pm = True
        except Exception: pm = False
        ok('premove played after the bot answered', pm, pg.inner_text('.tree'))

        # practice: pick up while the opponent moves, but the drop is refused
        nav(pg, 'My openings'); pg.get_by_role('button', name='New opening').click(); pg.get_by_label('Opening name').first.fill('T2')
        pg.locator('textarea').fill('1. e4 e5 2. Nf3 Nc6'); pg.get_by_role('button', name='Create opening').click(); pg.wait_for_selector('.tree .mv')
        pg.get_by_role('button', name='Practice', exact=True).click(); pg.wait_for_selector('[data-square="e2"]')
        pg.click('[data-square="e2"]'); pg.click('[data-square="e4"]'); pg.click('[data-square="g1"]')
        ok('practice: can pick up during opponent move', 'radial-gradient' in bg(pg, 'f3'))
        pg.click('[data-square="f3"]')
        ok('practice: placing a piece on the opponent turn is refused', pg.locator('[data-square="f3"] [data-piece]').count() == 0)

        # catalog
        nav(pg, 'Explore'); pg.wait_for_selector('.oc')
        ok('explore: 24 cards first page', pg.locator('.oc').count() == 24, str(pg.locator('.oc').count()))
        pg.get_by_label('Search the catalog').fill('italian'); pg.wait_for_selector('.oc')
        card = pg.locator('.oc', has_text='Italian Game').first
        meta = card.locator('.meta').inner_text(); card.get_by_role('button', name='Add to repertoire').click()
        ok('explore: add to repertoire', card.get_by_role('button', name='In your repertoire').count() == 1, meta)
        pg.screenshot(path='e2e-explore.png')
        nav(pg, 'Settings'); pg.locator('select').nth(0).select_option('aurora'); pg.locator('select').nth(1).select_option('cyan'); nav(pg, 'Explore'); time.sleep(.6)
        ok('aurora theme + cyan accent applied', pg.evaluate("document.documentElement.dataset.theme + document.documentElement.dataset.accent") == 'auroracyan')
        pg.screenshot(path='e2e-aurora.png')
        real = [e for e in errs if 'favicon' not in e]; ok('no console errors', not real, '; '.join(real)[:200]); b.close()
finally:
    srv.terminate()
print(sum(res), '/', len(res))
