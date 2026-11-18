"""Browser smoke test (Python Playwright). Build first, then from the project folder:
    npm run build && pip install playwright && playwright install chromium && python3 e2e/smoke.py dist
Covers: dashboard, opening hub with named lines and progress, Learn/Practice on a chosen line, Explore filters and favorites, the daily puzzle,
sound packs, piece sets, legal-move dots on every board theme, pickup and premoves while the bot moves, and console errors."""
import subprocess, sys, time, json, datetime
from playwright.sync_api import sync_playwright
srv = subprocess.Popen(['python3', '-m', 'http.server', '4176', '--directory', (sys.argv[1] if len(sys.argv) > 1 else 'dist')], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
B = 'http://localhost:4176/'; res = []
def ok(n, c, x=''): res.append(bool(c)); print(('PASS ' if c else 'FAIL ') + n, str(x)[:150])
def nav(pg, n): pg.locator('.top nav').get_by_role('button', name=n, exact=True).click()
def sq(pg, s): return pg.locator(f'[data-square="{s}"]')
try:
    with sync_playwright() as p:
        b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1280, 'height': 900}); errs = []; sounds = []
        pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None); pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('response', lambda r: sounds.append((r.url, r.status)) if '/sounds/' in r.url else None)
        pg.goto(B); pg.wait_for_selector('h1'); time.sleep(.5)
        ok('dashboard: puzzle card and hero', pg.locator('.pzcard').count() == 1 and pg.locator('.hero2').count() == 1)
        pg.screenshot(path='e2e-dash.png')

        # --- checklist: Italian Game lines ---
        nav(pg, 'My openings'); pg.wait_for_selector('.card')
        seed = pg.locator('.card', has_text='Italian Game').first; seed.get_by_role('button', name='Open').click(); pg.wait_for_selector('.lines li')
        ok('seed Italian Game hub lists its lines', True, pg.locator('.progress strong').inner_text())
        pg.get_by_role('button', name='Start learning').click(); pg.wait_for_selector('select')
        ok('seed Italian Game: Learn offers every line', pg.locator('select option').count() == 2, pg.locator('select option').count())
        nav(pg, 'Explore'); pg.wait_for_selector('.oc'); pg.get_by_label('Search the catalog').fill('italian game'); pg.wait_for_selector('.oc')
        pg.locator('.oc', has_text='Italian Game').first.get_by_role('button', name='Open').click(); pg.wait_for_selector('.lines li')
        txt = pg.inner_text('.progress strong'); ok('catalog Italian Game: 114 named lines, progress bar', '0 of 114 lines learned' in txt, txt)
        names = pg.locator('.lines li .lname strong').all_inner_texts(); ok('lines have real names (not Line N)', names and not names[0].startswith('Line '), names[:3])
        pg.locator('.lines li').nth(4).get_by_role('button', name='Learn').click(); pg.wait_for_selector('select')
        ok('Learn opens the chosen line, all 114 selectable', pg.locator('select').first.input_value() == '4' and pg.locator('select option').count() == 114, pg.locator('select option').count())
        pg.locator('select').first.select_option('50'); time.sleep(.3)
        ok('switching line in Learn works', pg.locator('select').first.input_value() == '50')
        pg.get_by_role('button', name='Back to opening').click(); pg.wait_for_selector('.lines li')
        pg.locator('.lines li').nth(2).get_by_role('button', name='Practice').click(); pg.wait_for_selector('[data-square="e2"]')
        ok('Practice a chosen line opens', 'Line:' in pg.inner_text('.panel'), pg.inner_text('.panel')[:60].replace('\n', ' | '))

        # --- explore filters + favorites ---
        nav(pg, 'Explore'); pg.wait_for_selector('.oc'); n0 = int(pg.locator('p.muted', has_text='openings').first.inner_text().split()[0])
        pg.get_by_role('button', name='Tactical', exact=True).click(); time.sleep(.3)
        n1 = int(pg.locator('p.muted', has_text='opening').first.inner_text().split()[0]); ok('style filter narrows the list', 0 < n1 < n0, f'{n0} -> {n1}')
        pg.get_by_role('button', name='Clear filters').click(); pg.get_by_label('Search the catalog').fill('king\'s indian defense'); pg.wait_for_selector('.oc')
        pg.locator('.oc').first.locator('.star').click(); time.sleep(.3)
        nav(pg, 'My openings'); pg.wait_for_selector('.card'); pg.get_by_role('button', name='★ Favorites').click(); time.sleep(.3)
        ok('favorited opening shows in My openings favorites', pg.locator('.card', has_text="King's Indian Defense").count() >= 1 and pg.locator('.card').count() == 1, pg.locator('.card').count())
        pg.screenshot(path='e2e-lib.png')
        pg.locator('.card').first.get_by_role('button', name='Open').click(); pg.wait_for_selector('.lean'); pg.screenshot(path='e2e-hub.png')
        ok('hub shows the three style scales', pg.locator('.lean .lrow').count() == 3)

        # --- daily puzzle ---
        nav(pg, 'Puzzles'); pg.wait_for_selector('[data-square="e2"]')
        pzs = json.load(open('src/data/puzzles.json')); today = datetime.date.today(); day = today.toordinal() - datetime.date(1970, 1, 1).toordinal(); z = pzs[day % len(pzs)]
        user = z['sol'][0::2]; opp = z['sol'][1::2]; mv = subprocess.run(['node', '-e', "const {Chess}=require('chess.js');const [f,...s]=process.argv.slice(1);const c=new Chess(f);console.log(s.map(x=>{const m=c.move(x);return m.from+m.to}).join(' '))", z['fen']] + z['sol'], capture_output=True, text=True).stdout.split()
        for i in range(0, len(mv), 2):
            sq(pg, mv[i][:2]).click(); sq(pg, mv[i][2:]).click(); time.sleep(1.1)
        try: pg.wait_for_selector('text=Well done', timeout=4000); solved = True
        except Exception: solved = False
        ok(f'daily puzzle solves ({len(pzs)} puzzles, ~{z["r"]})', solved, pg.inner_text('.panel')[:80].replace('\n', ' | '))
        pg.screenshot(path='e2e-puzzle.png')
        nav(pg, 'Dashboard'); pg.wait_for_selector('.pzcard'); ok('dashboard shows solved today', 'Solved' in pg.inner_text('.pzcard'))

        # --- piece sets and sound packs ---
        nav(pg, 'Settings'); pg.get_by_role('button', name='Merida').click(); pg.locator('select').nth(3).select_option('piano'); pg.wait_for_timeout(2500)  # (not time.sleep: Playwright only delivers response events while it is waiting)
        ok('sound pack files load (200)', any('piano/Move.mp3' in u and s == 200 for u, s in sounds), len(sounds))
        pg.locator('select').nth(3).select_option('sfx'); pg.wait_for_timeout(1000)
        ok('lichess sfx files load (200)', any('sfx/Move.mp3' in u and s == 200 for u, s in sounds))
        nav(pg, 'Play'); pg.get_by_label('Opening mode').select_option('engine'); pg.get_by_role('button', name='Start game').click(); pg.wait_for_selector('[data-square="e2"]')
        ok('board uses the selected piece set', pg.locator('[data-square="e2"] img[src*="pieces/merida"]').count() == 1)
        sq(pg, 'e2').click(); sq(pg, 'e4').click(); time.sleep(.2); pg.screenshot(path='e2e-play.png')

        # --- legal-move dots on every board theme, pickup and premoves while the bot moves ---
        def bg(s): return pg.evaluate('(s) => { const el = document.querySelector(`[data-square="${s}"]`); return [el, ...el.querySelectorAll("*")].map(e => getComputedStyle(e).backgroundImage).join(" "); }', s)
        for theme in ['green', 'brown', 'blue']:
            nav(pg, 'Settings'); pg.locator('select').nth(2).select_option(theme)
            nav(pg, 'Play'); pg.get_by_label('Opening mode').select_option('engine'); pg.get_by_role('button', name='Start game').click(); pg.wait_for_selector('[data-square="g1"]')
            sq(pg, 'g1').click(); ok(f'{theme}: dots after click', 'radial-gradient' in bg('f3') and 'radial-gradient' in bg('h3'))
            r = sq(pg, 'e2').bounding_box(); pg.mouse.move(r['x'] + r['width'] / 2, r['y'] + r['height'] / 2); pg.mouse.down(); time.sleep(.2)
            ok(f'{theme}: dots as soon as a piece is grabbed', 'radial-gradient' in bg('e3') and 'radial-gradient' in bg('e4')); pg.mouse.up()
        nav(pg, 'Settings'); pg.locator('select').nth(2).select_option('green')
        nav(pg, 'Play'); pg.get_by_label('Opening mode').select_option('engine'); pg.get_by_label('Difficulty').select_option('Beginner'); pg.get_by_role('button', name='Start game').click(); pg.wait_for_selector('[data-square="e2"]')
        sq(pg, 'e2').click(); sq(pg, 'e4').click(); sq(pg, 'd2').click(); ok('pickup while the bot is thinking shows moves', 'radial-gradient' in bg('d3'))
        sq(pg, 'd4').click(); ok('premove queued', pg.get_by_role('button', name='Cancel premove').count() == 1)
        try: pg.wait_for_function("/2\\.\\s*d4/.test(document.querySelector('.tree').innerText)", timeout=8000); pm = True
        except Exception: pm = False
        ok('premove played after the bot answered', pm, pg.inner_text('.tree'))
        real = [e for e in errs if 'favicon' not in e]; ok('no console errors', not real, '; '.join(real)[:200]); b.close()
finally: srv.terminate()
print(sum(res), '/', len(res))
