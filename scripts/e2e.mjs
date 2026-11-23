// End-to-end check of the production build (adapted from UC2): access gate, the six views (tabs), typed dates and the
// pasted UPC list.
//
//   npm run test:e2e                          builds a throwaway copy with a one-time password, serves it, runs the checks
//   BASE_URL=https://… E2E_PASSWORD=… node scripts/e2e.mjs   runs the same checks against a deployed URL
//   SCREENSHOTS=/some/folder                  also saves one PNG per view there
//
// No dependencies: drives a local Chrome / Chromium over the DevTools protocol (set CHROME_PATH if needed).
// The local run never reads or writes .env files: it generates a random password and passes only its hash to the build.
import { spawn, spawnSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SALT = 'weis-uc3-demo-gate:v1:'; // must match src/lib/accessGate.ts
const PORT = 4174;
const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean);
const TABS = [
  ['hotbuy', 'Hot Buy Performance'],
  ['other', 'Other Promo Performance'],
  ['post', 'Post-Promo Trend'],
  ['history', 'Promo History'],
  ['shopper', 'Promo Shopper Impact'],
  ['trend', 'Promo Run Trend'],
];
/** Key figures per view: 5–8, except Post-Promo Trend, whose workbook view lists two (Post-Promo Dip %, Repeat Purchase Rate %). */
const TILE_RANGE = { post: [2, 2] };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const children = [];
const work = mkdtempSync(join(tmpdir(), 'uc3-e2e-'));

async function cleanup() {
  for (const c of children) c.kill();
  await sleep(500);
  try {
    rmSync(work, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  } catch {
    /* the OS cleans temp folders */
  }
}

async function waitFor(url, tries = 80) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url);
      if (r.ok) return r;
    } catch {
      /* not up yet */
    }
    await sleep(250);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function main() {
  let base = process.env.BASE_URL?.replace(/\/$/, '');
  let password = process.env.E2E_PASSWORD;
  if (!base) {
    password = randomBytes(12).toString('hex');
    const outDir = join(work, 'dist');
    const hash = createHash('sha256').update(SALT + password).digest('hex');
    const build = spawnSync('npx', ['vite', 'build', '--outDir', outDir, '--emptyOutDir', '--logLevel', 'error'], { stdio: 'inherit', env: { ...process.env, VITE_ACCESS_PASSWORD_HASH: hash } });
    if (build.status !== 0) throw new Error('Build failed');
    children.push(spawn('npx', ['vite', 'preview', '--outDir', outDir, '--port', String(PORT), '--strictPort'], { stdio: 'ignore' }));
    base = `http://localhost:${PORT}`;
    await waitFor(`${base}/`);
  }
  if (!password) throw new Error('Set E2E_PASSWORD when BASE_URL is set.');
  const chromePath = CHROME_CANDIDATES.find((p) => existsSync(p));
  if (!chromePath) throw new Error('Chrome not found: set CHROME_PATH.');
  children.push(spawn(chromePath, ['--headless=new', '--remote-debugging-port=9336', `--user-data-dir=${join(work, 'profile')}`, '--window-size=1440,1000', 'about:blank'], { stdio: 'ignore' }));
  const target = (await (await waitFor('http://127.0.0.1:9336/json')).json()).find((t) => t.type === 'page');
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  let id = 0;
  const pending = new Map();
  const errors = [];
  const debug = [];
  const appOrigin = new URL(base).origin;
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      pending.get(m.id)(m);
      pending.delete(m.id);
    } else if (m.method === 'Runtime.exceptionThrown') errors.push(`${m.params.exceptionDetails.url ?? ''} ${m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text}`);
    else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m.params.args.map((a) => a.value ?? a.description).join(' '));
    // Browser log entries count only when they come from the app's own origin (CSP violations, failed requests).
    else if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error' && (m.params.entry.url ?? '').startsWith(appOrigin)) errors.push(`${m.params.entry.source}: ${m.params.entry.text}`);
    else if (m.method === 'Runtime.exceptionThrown' || m.method === 'Log.entryAdded') debug.push(JSON.stringify(m.params).slice(0, 300));
  });
  const send = (method, params = {}) =>
    new Promise((r) => {
      const i = ++id;
      pending.set(i, r);
      ws.send(JSON.stringify({ id: i, method, params }));
    });
  const evaluate = async (expression) => (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result?.result?.value;
  const until = async (expression, what, ms = 15000) => {
    for (let t = 0; t < ms; t += 200) {
      const v = await evaluate(expression);
      if (v) return v;
      await sleep(200);
    }
    throw new Error(`Timed out: ${what}`);
  };
  const setValue = (selector, value) =>
    evaluate(`(() => {
      const i = document.querySelector(${JSON.stringify(selector)});
      const proto = i instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(i, ${JSON.stringify(value)});
      i.dispatchEvent(new Event('input', { bubbles: true }));
      return 1;
    })()`);
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Log.enable');

  const results = [];
  const check = (name, ok, detail = '') => {
    results.push({ name, ok, detail });
    console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` · ${detail}` : ''}`);
  };

  // 1. Access gate: wrong password refused, right password accepted.
  await send('Page.navigate', { url: `${base}/` });
  await until(`!!document.querySelector('input[type=password]')`, 'password field');
  await setValue('input[type=password]', 'not-the-password');
  await evaluate(`document.querySelector('input[type=password]').form.requestSubmit(), 1`);
  await until(`!!document.querySelector('#password-error')`, 'error for a wrong password');
  check('Access gate refuses a wrong password with a generic message', (await evaluate(`document.querySelector('#password-error').textContent`)) === 'Incorrect password. Please try again.');
  errors.length = 0;
  await setValue('input[type=password]', password);
  await evaluate(`document.querySelector('input[type=password]').form.requestSubmit(), 1`);
  await until(`!!document.querySelector('.app-header')`, 'app after the password gate');
  check('Access gate accepts the configured password', true);
  check('"Illustrative data only" notice is visible', await evaluate(`document.querySelector('.disclaimer').textContent.includes('Illustrative data only')`));

  // 2. Every view renders its heading, 5–8 key figure tiles and no error card.
  for (const [tab, title] of TABS) {
    await send('Page.navigate', { url: `${base}/?tab=${tab}` });
    await until(`document.querySelector('#section-title')?.textContent.includes(${JSON.stringify(title)})`, `${title} heading`, 30000);
    await sleep(400);
    const info = await evaluate(`({ tiles: document.querySelectorAll('.kpi-tile').length, error: !!document.querySelector('.app-error'), pending: document.querySelectorAll('.pending-chip').length, rows: document.querySelectorAll('table.hier tbody tr').length, charts: document.querySelectorAll('.recharts-surface').length })`);
    const termCounts = await evaluate(`(() => { const c = {}; for (const t of document.querySelectorAll('#tab-panel .term, .calc-settings .term')) c[t.dataset.term] = (c[t.dataset.term] ?? 0) + 1; return c; })()`);
    check(`${title}: each glossary term is underlined at most once`, Object.values(termCounts).every((n) => n === 1), JSON.stringify(termCounts));
    const inlineDefs = await evaluate(`[...document.querySelectorAll('#tab-panel button.btn-link')].map((b) => b.textContent.trim()).filter((t) => /Definitions|definition|Criteria and weights|Thresholds|more/.test(t))`);
    check(`${title}: no inline link to the KPI definitions`, inlineDefs.length === 0, JSON.stringify(inlineDefs));
    const [minTiles, maxTiles] = TILE_RANGE[tab] ?? [5, 8];
    check(`${title} renders`, !info.error && info.tiles >= minTiles && info.tiles <= maxTiles && info.pending > 0 && info.rows > 0, `${info.tiles} tiles · ${info.rows} table rows · ${info.charts} charts · ${info.pending} pending marks`);
    // Layout rules 1 and 2: title, then tiles; charts (or panels) before tables; Level 2 sections last; no story / validate on top.
    const layout = await evaluate(`(() => {
      const main = document.querySelector('#section-title').closest('main') ?? document.body;
      const blocks = [...main.querySelectorAll('.section-head, .kpi-row, .chart-card, .shopper-grid, .table-card, .secondary-section')].filter((el) => !el.parentElement.closest('.chart-card, .table-card, .secondary-section'));
      const kind = (el) => el.matches('.section-head') ? 'title' : el.matches('.kpi-row') ? 'tiles' : el.matches('.chart-card, .shopper-grid') ? 'charts' : el.matches('.table-card') ? 'tables' : 'level2';
      const order = blocks.map(kind).filter((k, i, a) => k !== a[i - 1]);
      const rank = { title: 0, tiles: 1, charts: 2, tables: 3, level2: 4 };
      const sorted = order.every((k, i) => i === 0 || rank[k] > rank[order[i - 1]]);
      const head = document.querySelector('.section-head');
      const objective = head.querySelector('.section-objective');
      const bare = head.children.length === 2 && !!objective && objective.textContent.trim().length > 20 && !document.querySelector('.eyebrow, .section-question, .section-pain, .section-validate');
      return { order: order.join(' → '), ok: sorted && order[0] === 'title' && order[1] === 'tiles' && bare };
    })()`);
    check(`${title} follows the layout rules`, layout.ok, layout.order);
    if (process.env.SCREENSHOTS) {
      await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
      const h = await evaluate(`document.documentElement.scrollHeight`);
      const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width: 1440, height: Math.min(h, 4200), scale: 1 } });
      writeFileSync(join(process.env.SCREENSHOTS, `${tab}.png`), Buffer.from(shot.result.data, 'base64'));
    }
  }

  // 3. Typed date range: Date Range mode, type From and To.
  await send('Page.navigate', { url: `${base}/?tab=hotbuy&tm=custom&from=2026-01-01&to=2026-03-31` });
  await until(`document.querySelectorAll('.date-field input[type=text]').length === 2`, 'two typed date fields');
  await setValue('.date-field input[type=text]', '07/01/2026');
  await evaluate(`document.querySelector('.date-field input[type=text]').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })), 1`);
  await until(`location.search.includes('from=2026-07-01')`, 'typed From date applied');
  check('Typed date (mm/dd/yyyy, Enter) updates the range', true, await evaluate(`document.querySelector('.range-hint').textContent`));
  await setValue('.date-field input[type=text]', '13/45/2026');
  await evaluate(`document.querySelector('.date-field input[type=text]').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })), 1`);
  await sleep(300);
  check('An impossible typed date is flagged and ignored', await evaluate(`document.querySelector('.date-field').classList.contains('is-invalid') && location.search.includes('from=2026-07-01')`));

  // 4. Pasted UPC list: one valid UPC, one invalid token.
  await send('Page.navigate', { url: `${base}/?tab=hotbuy&tm=all` });
  await until(`!!document.querySelector('.paste-btn')`, 'Paste UPCs button');
  await evaluate(`document.querySelector('.paste-btn').click(), 1`);
  await until(`!!document.querySelector('.paste-area')`, 'paste dialog');
  const hint = await evaluate(`document.querySelector('.paste-hint').textContent.match(/\\d{12}/)[0]`);
  await setValue('.paste-area', `${hint}\n<script>alert(1)</script>, 12345678901`);
  await evaluate(`[...document.querySelectorAll('.paste-pop button')].find((b) => b.textContent.includes('Apply')).click(), 1`);
  await until(`!!document.querySelector('.pasted-field')`, 'pasted list applied');
  check('Pasted UPC list filters to the valid code and ignores invalid tokens', await evaluate(`document.querySelector('.pasted-field').textContent.includes('1 item') && !document.querySelector('script:not([src])')`), `UPC ${hint}`);

  // 5. Labels added after review: baseline note, SKU-row dash tooltip, buyer-count sum label, funding filter note.
  await send('Page.navigate', { url: `${base}/?tab=hotbuy` });
  await until(`!!document.querySelector('.baseline-note')`, 'baseline note');
  check('Baseline note with Definition pending #4', await evaluate(`(() => { const n = document.querySelector('.baseline-note'); return n.textContent.includes('Proposed default, pending confirmation (#4)') && n.textContent.includes('Baseline includes prior promo weeks in the window') && n.textContent.includes('Definition pending #4'); })()`));
  const pressed = (group) => `[...document.querySelectorAll('[role=group][aria-label="${group}"] button[aria-pressed=true]')].map((b) => b.textContent).join()`;
  check('Hot Buy Performance: 4-week baseline and Subcategory cannibalization by default', (await evaluate(pressed('Baseline window in weeks'))) === '4 wk' && (await evaluate(pressed('Cannibalization level'))) === 'Subcategory');
  // Two-value tile: Net Customer main, Gross secondary, each tagged on its own line, 2 decimals; Gross basis swaps them.
  const salesTile = `(() => { const plain = (el) => { const c = el.cloneNode(true); c.querySelectorAll('.term-pop').forEach((p) => p.remove()); return c.textContent; }; const t = [...document.querySelectorAll('.kpi-tile')].find((x) => x.querySelector('.kpi-label').textContent.startsWith('Promo Sales $')); return [t.querySelector('.kpi-pair-main').getAttribute('aria-label'), t.querySelector('.kpi-pair-sub').getAttribute('aria-label'), plain(t.querySelector('.kpi-pair-main .kpi-tag')), plain(t.querySelector('.kpi-pair-sub .kpi-tag'))].join('|'); })()`;
  const netFirst = await evaluate(salesTile);
  check('Promo Sales $ tile: Net Customer main and Gross secondary, tagged, 2 decimals', /^Net Customer Sales \$\d+\.\d{2}[MK]\|Gross Sales \$\d+\.\d{2}[MK]\|Net Customer\|Gross$/.test(netFirst), netFirst);
  await evaluate(`[...document.querySelectorAll('[role=group][aria-label="Sales basis"] button')].find((b) => b.textContent === 'Gross').click(), 1`);
  await until(`location.search.includes('sb=gross')`, 'Gross sales basis');
  const grossFirst = await evaluate(salesTile);
  check('Promo Sales $ tile: Gross basis puts Gross on top', /^Gross Sales \$\d+\.\d{2}[MK]\|Net Customer Sales/.test(grossFirst), grossFirst);
  await evaluate(`[...document.querySelectorAll('[role=group][aria-label="Sales basis"] button')].find((b) => b.textContent === 'Net Customer').click(), 1`);
  await until(`!location.search.includes('sb=gross')`, 'Net Customer sales basis again');
  // Cannibalization level: "How it works" popover opens with a click and with the keyboard, and closes with Esc.
  await evaluate(`document.querySelector('.howto-btn').click(), 1`);
  await until(`!!document.querySelector('.howto-pop')`, 'How it works popover');
  const howText = await evaluate(`document.querySelector('.howto-pop').textContent`);
  await evaluate(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })), 1`);
  await sleep(150);
  const closedByEsc = await evaluate(`!document.querySelector('.howto-pop') && document.activeElement === document.querySelector('.howto-btn')`);
  await evaluate(`document.querySelector('.howto-btn').focus(), 1`);
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r' });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await sleep(150);
  const openedByKey = await evaluate(`!!document.querySelector('.howto-pop')`);
  await evaluate(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })), 1`);
  check(
    'Cannibalization "How it works" popover opens by click and keyboard, closes with Esc, keeps the level list',
    howText.includes('Which items count as competitors of the promoted price group') && howText.includes('What does not change') && howText.includes('The level is still open (#3)') && howText.includes('Brand-category:') && closedByEsc && openedByKey,
    JSON.stringify({ text: howText.length, closedByEsc, openedByKey }),
  );
  // Glossary <Term>: opens with the keyboard, is described for screen readers, closes with Esc.
  await evaluate(`document.querySelector('.term[data-term="baseline"]').focus(), 1`);
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r' });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await sleep(150);
  const termOpen = await evaluate(`(() => { const t = document.querySelector('.term[data-term="baseline"]'); const pop = document.getElementById(t.getAttribute('aria-describedby')); return { expanded: t.getAttribute('aria-expanded'), visible: !pop.hidden, text: pop.textContent }; })()`);
  await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await sleep(150);
  const termClosed = await evaluate(`(() => { const t = document.querySelector('.term[data-term="baseline"]'); return t.getAttribute('aria-expanded') === 'false' && document.getElementById(t.getAttribute('aria-describedby')).hidden; })()`);
  check('Glossary term opens with the keyboard (Enter), is described for screen readers and closes with Esc', termOpen.expanded === 'true' && termOpen.visible && termOpen.text.startsWith('Baseline: What the item would have sold without the promotion') && termClosed, JSON.stringify(termOpen));
  // Layout rules 5 and 6: Rows lives in the table card; tags on each affected block; highlighted when changed.
  const placement = await evaluate(`(() => {
    const rows = [...document.querySelectorAll('.rows-control')];
    const bar = document.querySelector('.calc-settings');
    const cannGroup = [...bar.querySelectorAll('.toggle-group')].find((g) => g.textContent.includes('Cannibalization level'));
    return { rows: rows.length, inTable: rows.every((r) => !!r.closest('.table-card')), inBar: !!bar.querySelector('.rows-control'), barTitle: bar.querySelector('.calc-settings-title')?.textContent, cannChip: !!cannGroup?.querySelector('.pending-chip') && cannGroup.querySelector('.pending-chip').textContent.includes('#3'), affects: [...bar.querySelectorAll('.tip-body')].filter((t) => t.textContent.startsWith('Affects: ')).length };
  })()`);
  check('Rows appears only in the table card; Calculation settings bar has the other controls, each with "Affects: …"', placement.rows === 1 && placement.inTable && !placement.inBar && placement.barTitle === 'Calculation settings' && placement.cannChip && placement.affects >= 2, JSON.stringify(placement));
  const tagsOf = `(() => { const out = {}; for (const w of document.querySelectorAll('.setting-tags')) { const b = w.dataset.block; out[b] = (out[b] ?? []).concat([...w.querySelectorAll('.setting-tag')].map((t) => t.dataset.setting + (t.classList.contains('is-changed') ? '*' : '') + '=' + t.firstChild.textContent)); } return out; })()`;
  const hbTags = await evaluate(tagsOf);
  check(
    'Hot Buy: every affected block shows its tags with the default values',
    JSON.stringify(hbTags.tiles) === JSON.stringify(['baseline=Baseline 4 wk', 'basis=Net Customer Sales', 'cann=Subcategory level', 'weights=Current weights']) && JSON.stringify(hbTags.salesChart) === JSON.stringify(['baseline=Baseline 4 wk', 'basis=Net Customer Sales']) && hbTags.bridge?.length === 3 && hbTags.table?.length === 4,
    JSON.stringify(hbTags),
  );
  await evaluate(`[...document.querySelectorAll('[role=group][aria-label="Sales basis"] button')].find((b) => b.textContent === 'Gross').click(), 1`);
  await until(`location.search.includes('sb=gross')`, 'Gross sales basis for the tags');
  const grossTags = await evaluate(tagsOf);
  check(
    'Changing Sales basis highlights its tag on every affected block and leaves the others plain',
    ['tiles', 'salesChart', 'bridge', 'table'].every((b) => grossTags[b].includes('basis*=Gross Sales (default Net Customer)') && grossTags[b].some((t) => t.startsWith('baseline=Baseline 4 wk'))),
    JSON.stringify(grossTags),
  );
  await evaluate(`[...document.querySelectorAll('[role=group][aria-label="Sales basis"] button')].find((b) => b.textContent === 'Net Customer').click(), 1`);
  await until(`!location.search.includes('sb=gross')`, 'Net Customer again');
  await send('Page.navigate', { url: `${base}/?tab=post` });
  await until(`!!document.querySelector('.setting-tags')`, 'Post-Promo tags');
  await sleep(300);
  const postInfo = await evaluate(`(() => { const t = ${tagsOf}; const bar = document.querySelector('.calc-settings'); const units = [...document.querySelectorAll('section.chart-card')].find((c) => /(Units|Pounds) vs\\. baseline$/.test(c.getAttribute('aria-label'))); const sales = [...document.querySelectorAll('section.chart-card')].find((c) => /Sales vs\\. baseline$/.test(c.getAttribute('aria-label'))); return { tags: t, barBasis: !!bar.querySelector('[aria-label="Sales basis"]'), salesBasis: !!sales?.querySelector('[aria-label="Sales basis"]'), unitsBasis: !!units?.querySelector('[aria-label="Sales basis"]'), cann: !!document.querySelector('[aria-label="Cannibalization level"]') }; })()`);
  check(
    'Post-Promo Trend: Sales basis only in the sales chart; units chart and table show no basis tag; no cannibalization control',
    !postInfo.barBasis && postInfo.salesBasis && !postInfo.unitsBasis && !postInfo.cann && JSON.stringify(postInfo.tags.unitsChart) === JSON.stringify(['baseline=Baseline by promo type']) && postInfo.tags.salesChart?.length === 2 && JSON.stringify(postInfo.tags.table) === JSON.stringify(['baseline=Baseline by promo type']),
    JSON.stringify(postInfo),
  );
  await send('Page.navigate', { url: `${base}/?tab=shopper&bw=8` });
  await until(`!!document.querySelector('.setting-tags')`, 'Shopper tags');
  const shopTags = await evaluate(tagsOf);
  check(
    'Promo Shopper Impact: only the baseline tag, highlighted when changed from the default',
    Object.values(shopTags).flat().every((t) => t === 'baseline*=Baseline 8 wk (default by promo type)') && Object.keys(shopTags).sort().join() === 'panels,table,tiles',
    JSON.stringify(shopTags),
  );
  await send('Page.navigate', { url: `${base}/?tab=hotbuy` });
  await until(`!!document.querySelector('.rows-control')`, 'Hot Buy again');
  // Local "Event" filters of the charts: bridge defaults to All events; pickers, table rows and the URL stay in sync.
  const bridgeCard = `[...document.querySelectorAll('section.chart-card')].find((c) => / bridge$/.test(c.getAttribute('aria-label') ?? ''))`;
  const salesCard = `[...document.querySelectorAll('section.chart-card')].find((c) => / vs\\. baseline$/.test(c.getAttribute('aria-label') ?? ''))`;
  const pickerState = `(() => { const b = ${bridgeCard}; const s = ${salesCard}; const val = (c) => { const i = c.querySelector('.event-picker input, .event-picker select'); return i.tagName === 'SELECT' ? i.selectedOptions[0].textContent : i.value; }; return { bridge: val(b), bridgeSub: b.querySelector('.chart-sub').textContent, sales: val(s), salesSub: s.querySelector('.chart-sub').textContent, label: [...b.querySelectorAll('.event-picker .inline-label')].map((l) => l.textContent.trim()).join(), oldButtons: !!b.querySelector('[aria-label="Bridge scope"]'), selected: document.querySelector('tr.is-selected .lbl, tr.is-selected th')?.textContent ?? null, url: location.search }; })()`;
  const p0 = await evaluate(pickerState);
  check('Bridge Event filter defaults to "All events in the table (N)" and the old buttons are gone', /^All events in the table \(\d+\)$/.test(p0.bridge) && /^All \d+ events in the table$/.test(p0.bridgeSub) && p0.label === 'Event' && !p0.oldButtons && / · Hot Buy · \d\d\/\d\d\/\d\d–\d\d\/\d\d\/\d\d$/.test(p0.sales), JSON.stringify(p0));
  // Pick the second event in the bridge combobox with the keyboard.
  await evaluate(`(() => { const i = (${bridgeCard}).querySelector('.event-picker input'); i.focus(); i.click(); return 1; })()`);
  await until(`!!(${bridgeCard}).querySelector('[role=listbox]')`, 'bridge Event list');
  const key = async (k, code, vk) => {
    await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: k, code, windowsVirtualKeyCode: vk });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code, windowsVirtualKeyCode: vk });
  };
  await key('Escape', 'Escape', 27);
  await sleep(150);
  const pickerEsc = await evaluate(`!(${bridgeCard}).querySelector('[role=listbox]')`);
  await key('ArrowDown', 'ArrowDown', 40);
  await key('ArrowDown', 'ArrowDown', 40);
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r' });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await until(`location.search.includes('sel=')`, 'event picked in the bridge');
  const p1 = await evaluate(pickerState);
  check('Picking an event in the bridge (keyboard) updates the URL, the table row and the sales chart; Esc closes the list', pickerEsc && p1.bridge === p1.sales && !p1.bridge.startsWith('All') && / in .+/.test(p1.bridgeSub) && !!p1.selected && p1.selected.startsWith(p1.bridge.split(' · ')[0]), JSON.stringify({ pickerEsc, ...p1 }));
  // A row click selects that event in both dropdowns.
  await evaluate(`(() => { const rows = [...document.querySelectorAll('table.hier tbody tr:not(.total-row):not(.is-selected)')].filter((r) => !r.classList.contains('sku-row')); rows[2].click(); return 1; })()`);
  await sleep(300);
  const p2 = await evaluate(pickerState);
  check('A table row click selects the event in both Event dropdowns', p2.bridge === p2.sales && p2.bridge !== p1.bridge && p2.url !== p1.url, JSON.stringify({ bridge: p2.bridge, sales: p2.sales }));
  // "All events" in the bridge keeps the sales chart on the selected event.
  await evaluate(`(() => { const i = (${bridgeCard}).querySelector('.event-picker input'); i.focus(); i.click(); return 1; })()`);
  await until(`!!(${bridgeCard}).querySelector('[role=listbox]')`, 'bridge Event list again');
  await evaluate(`(() => { const li = [...(${bridgeCard}).querySelectorAll('[role=option]')].find((o) => o.textContent.startsWith('All events in the table')); li.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); return 1; })()`);
  await sleep(300);
  const p3 = await evaluate(pickerState);
  check('Choosing "All events" in the bridge keeps the sales chart on the selected event', p3.bridge.startsWith('All events in the table') && p3.sales === p2.sales, JSON.stringify({ bridge: p3.bridge, sales: p3.sales }));
  // Global filters that drop the selected event: bridge back to All, sales chart to the top event.
  const selId = new URLSearchParams(p2.url).get('sel');
  await send('Page.navigate', { url: `${base}/?tab=hotbuy&sel=${selId}&dept=6` });
  await until(`!!(${bridgeCard}) || !!document.querySelector('.empty-card')`, 'Hot Buy with another department');
  const p4 = await evaluate(`(() => { const b = ${bridgeCard}; if (!b) return { empty: true }; return ${pickerState}; })()`);
  check('When filters drop the selected event, the bridge goes back to All events', !!p4.empty || p4.bridge.startsWith('All events in the table'), JSON.stringify(p4));
  await send('Page.navigate', { url: `${base}/?tab=hotbuy` });
  await until(`!!(${bridgeCard})`, 'Hot Buy default again');
  // Promo window chart: Daily for a one-week Hot Buy, Weekly for a multi-week TPR, three shaded windows, table columns.
  const cardOf = (prefix) => `[...document.querySelectorAll('section.chart-card')].find((c) => /^(Daily|Weekly) /.test(c.getAttribute('aria-label') ?? '') && c.getAttribute('aria-label').endsWith(' vs. baseline') && (${JSON.stringify(prefix)} === '' || c.getAttribute('aria-label').startsWith(${JSON.stringify(prefix)})))`;
  const shoot = async (selectorExpr, file) => {
    if (!process.env.SCREENSHOTS) return;
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 2, mobile: false });
    await sleep(500);
    await evaluate(`(${selectorExpr}).scrollIntoView({ block: 'center' }), 1`);
    await sleep(300);
    const clip = await evaluate(`(() => { const r = (${selectorExpr}).getBoundingClientRect(); return { x: r.x + scrollX, y: r.y + scrollY, width: r.width, height: r.height, scale: 1 }; })()`);
    const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip });
    writeFileSync(join(process.env.SCREENSHOTS, file), Buffer.from(shot.result.data, 'base64'));
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  };
  await until(`!!(${cardOf('Daily')})`, 'Daily chart for a one-week Hot Buy');
  const hbChart = await evaluate(`(() => { const c = ${cardOf('')}; return { title: c.querySelector('.chart-title').textContent, sub: c.querySelector('.chart-sub').textContent, shades: [...c.querySelectorAll('.recharts-reference-area')].length, labels: [...c.querySelectorAll('.recharts-reference-area text, .recharts-label')].map((t) => t.textContent).join('|') }; })()`);
  check('Hot Buy chart: Daily Net Customer Sales vs. baseline with Baseline, Promo and After shaded', hbChart.title === 'Daily Net Customer Sales vs. baseline' && hbChart.shades === 3 && /Baseline/.test(hbChart.labels) && /Promo/.test(hbChart.labels) && /After/.test(hbChart.labels) && /^[^·]+, HB-\d{4}-\d{3}$/.test(hbChart.sub), JSON.stringify(hbChart));
  await shoot(cardOf('Daily'), 'chart-hotbuy-daily.png');
  // Hot Buy Performance, the two top chart cards, light and dark colour scheme (the app has one theme today).
  await shoot(`document.querySelector('.chart-grid')`, 'hotbuy-cards-light.png');
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] });
  await shoot(`document.querySelector('.chart-grid')`, 'hotbuy-cards-dark.png');
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] });
  await evaluate(`(${cardOf('')}).querySelector('button[aria-label="Show as table"], button[aria-label="Show chart"]').click(), 1`);
  await sleep(200);
  const hbHead = await evaluate(`[...(${cardOf('')}).querySelectorAll('th')].map((t) => t.textContent.trim()).join('|')`);
  const hbNote = await evaluate(`(${cardOf('')}).querySelector('.chart-table-note')?.textContent ?? ''`);
  check('Chart table view: Day, Phase, Days, Sales $, Baseline $, Difference $', hbHead === 'Day|Phase|Days|Sales $|Baseline $|Difference $' && hbNote.includes('baseline window 4 weeks') && hbNote.includes('after 4 weeks'), `${hbHead} · ${hbNote}`);
  await evaluate(`(${cardOf('')}).querySelector('button[aria-label="Show as table"], button[aria-label="Show chart"]').click(), 1`);
  await send('Page.navigate', { url: `${base}/?tab=other&tm=all&pt=TPR` });
  await until(`!!(${cardOf('')})`, 'Other Promo chart');
  await evaluate(`(() => { const rows = [...document.querySelectorAll('table.hier tbody tr:not(.total-row)')]; const r = rows.find((tr) => / \\+ [2-9] wk/.test(tr.textContent) || /TPR-/.test(tr.textContent) && / \\+ \\d+ wk/.test(tr.textContent)); (r ?? rows[0]).click(); return 1; })()`);
  await sleep(400);
  const tprChart = await evaluate(`(() => { const c = ${cardOf('')}; return { title: c.querySelector('.chart-title').textContent, sub: c.querySelector('.chart-sub').textContent }; })()`);
  if (!tprChart.title.startsWith('Weekly')) await evaluate(`[...(${cardOf('')}).querySelectorAll('button')].find((b) => b.textContent === 'Weekly').click(), 1`);
  await sleep(300);
  const tprWeekly = await evaluate(`(() => { const c = ${cardOf('Weekly')}; return c ? { title: c.querySelector('.chart-title').textContent, sub: c.querySelector('.chart-sub').textContent, shades: c.querySelectorAll('.recharts-reference-area').length } : null; })()`);
  check('TPR chart: Weekly Net Customer Sales vs. baseline, 13-week baseline window, three windows', !!tprWeekly && tprWeekly.title === 'Weekly Net Customer Sales vs. baseline' && /^[^·]+, TPR-\d{4}-\d{3}b?$/.test(tprWeekly.sub) && tprWeekly.shades === 3, JSON.stringify({ tprChart, tprWeekly }));
  await shoot(cardOf('Weekly'), 'chart-tpr-weekly.png');
  await evaluate(`(${cardOf('Weekly')}).querySelector('button[aria-label="Show as table"], button[aria-label="Show chart"]').click(), 1`);
  await sleep(200);
  const tprHead = await evaluate(`[...(${cardOf('Weekly')}).querySelectorAll('th')].map((t) => t.textContent.trim()).join('|')`);
  const tprNote = await evaluate(`(${cardOf('Weekly')}).querySelector('.chart-table-note')?.textContent ?? ''`);
  check('Weekly table view: Week, Phase, Days, Sales $, Baseline $, Difference $', tprHead === 'Week|Phase|Days|Sales $|Baseline $|Difference $' && tprNote.includes('baseline window 13 weeks'), `${tprHead} · ${tprNote}`);
  await send('Page.navigate', { url: `${base}/?tab=hotbuy` });
  await until(`!!document.querySelector('table.hier tbody tr:not(.total-row) button[aria-expanded]')`, 'Hot Buy table again');
  await evaluate(`document.querySelector('table.hier tbody tr:not(.total-row) button[aria-expanded]').click(), 1`);
  await until(`!!document.querySelector('tr.sku-row .pg-only')`, 'SKU row dash');
  check('SKU-row cannibalization dash has the tooltip', await evaluate(`[...document.querySelectorAll('tr.sku-row .pg-only')].every((e) => e.title === 'Measured at price group level')`));
  await send('Page.navigate', { url: `${base}/?tab=shopper` });
  await until(`!!document.querySelector('.sum-label')`, 'buyer count sum label');
  check('Promo Shopper Impact: aggregates-only approval line (#16) and "By promo type" baseline', await evaluate(`document.body.textContent.includes('Aggregates only. Individual-level detail requires approval (#16).')`) && (await evaluate(pressed('Baseline window in weeks'))) === 'By promo type');
  check('Promo Buyer Count total is labelled as a sum across events', await evaluate(`document.querySelector('.sum-label').textContent.includes('Sum across events (not unique households)') && !!document.querySelector('.sum-label .tip')`));
  await send('Page.navigate', { url: `${base}/?tab=other` });
  await until(`!!document.querySelector('.baseline-note')`, 'Other Promo baseline control');
  check('Other Promo Performance: 13-week baseline by default', (await evaluate(pressed('Baseline window in weeks'))) === '13 wk');
  // 6. Tabs = the workbook views in its order without Promo Funding (#2); Post-Promo Trend is its own level-2 tab (#8).
  await send('Page.navigate', { url: `${base}/?tab=funding&fu=bill` });
  await until(`document.querySelector('#section-title')?.textContent.includes('Hot Buy Performance')`, 'default tab for tab=funding');
  check(
    'tab=funding opens the default tab (Hot Buy Performance); the six tabs follow the workbook order without Promo Funding',
    await evaluate(`[...document.querySelectorAll('[role=tab]')].map((t) => t.textContent.trim()).join('|') === 'Hot Buy Performance|Other Promo Performance|Post-Promo Trend|Promo History|Promo Shopper Impact|Promo Run Trend' && !location.search.includes('fu=') && !location.search.includes('tab=funding') && !document.body.textContent.includes('Not in this dashboard (#2)')`),
  );
  // Time filter: Rolling mode reads "Period · Last 13 weeks" and says which promotions it includes; no "Span" anywhere.
  const time = await evaluate(`(() => {
    const labels = [...document.querySelectorAll('.filter-card .field-label')].map((l) => l.textContent.trim());
    const sel = [...document.querySelectorAll('.filter-card .field')].find((f) => f.querySelector('.field-label')?.textContent.trim() === 'Period');
    const select = sel?.querySelector('select');
    return { labels, period: select ? select.options[select.selectedIndex].text : '', options: select ? [...select.options].map((o) => o.text).join('|') : '', hint: document.querySelector('.range-hint').textContent };
  })()`);
  check(
    'Time filter: Rolling "Period" shows "Last 13 weeks" and "Promotions starting … (last complete ad week)"; never "Span"',
    time.labels.includes('Period') && !time.labels.some((l) => /span/i.test(l)) && time.period === 'Last 13 weeks' && time.options === 'Last 6 weeks|Last 13 weeks|Last 26 weeks|Last 52 weeks' && /^Promotions starting \d\d\/\d\d\/\d\d–\d\d\/\d\d\/\d\d \(last complete ad week\)$/.test(time.hint),
    JSON.stringify(time),
  );
  for (const [q, label] of [['tm=todate&td=ytd', 'Period'], ['tm=fiscal&fg=quarter&fy=2026&q=2', 'Grain']]) {
    await send('Page.navigate', { url: `${base}/?tab=hotbuy&${q}` });
    await until(`!!document.querySelector('.range-hint')`, 'range hint');
    await sleep(200);
    const t = await evaluate(`({ labels: [...document.querySelectorAll('.filter-card .field-label')].map((l) => l.textContent.trim()), hint: document.querySelector('.range-hint').textContent })`);
    check(`Time filter (${q}): "${label}" label, "Promotions starting …", never "Span"`, t.labels.includes(label) && !t.labels.some((l) => /span/i.test(l)) && /^Promotions starting \d\d\/\d\d\/\d\d/.test(t.hint), JSON.stringify(t));
  }
  await send('Page.navigate', { url: `${base}/?tab=post` });
  await until(`document.querySelector('#section-title')?.textContent.includes('Post-Promo Trend')`, 'Post-Promo Trend tab');
  check(
    'Post-Promo Trend is its own tab, marked Level 2, with Post-Promo Dip % and Repeat Purchase Rate %',
    await evaluate(`(() => { const plain = (el) => { const c = el.cloneNode(true); c.querySelectorAll('.term-pop').forEach((p) => p.remove()); return c.textContent; }; const labels = [...document.querySelectorAll('.kpi-label')].map((l) => plain(l).trim()); return /^Post-Promo Trend\\s*Level 2 · not MVP$/.test(plain(document.querySelector('#section-title')).trim()) && labels.length === 2 && labels[0].startsWith('Post-Promo Dip %') && labels[1].startsWith('Repeat Purchase Rate %'); })()`),
  );
  await send('Page.navigate', { url: `${base}/?tab=trend` });
  await until(`document.querySelector('#section-title')?.textContent.includes('Promo Run Trend')`, 'Promo Run Trend tab');
  check(
    'Promo Run Trend no longer holds a Post-Promo section',
    await evaluate(`!document.querySelector('.secondary-section') && !document.body.textContent.includes('View content pending')`),
  );

  // 7. Layout rule 2: the business context moved to the KPI definitions dialog, one entry per view.
  await evaluate(`[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'KPI definitions').click(), 1`);
  await until(`!!document.querySelector('.defs-views-list')`, 'views section in the KPI definitions dialog');
  check(
    'KPI definitions dialog lists each of the six views with priority, user story and what to validate',
    await evaluate(`(() => { const items = [...document.querySelectorAll('.defs-views-list li')].filter((li) => li.id !== 'view-funding'); return items.length === 6 && items.every((li) => li.textContent.includes('User story') && li.textContent.includes('To validate') && /Must Have|Should Have|Nice to have/.test(li.textContent) && /View \\d of 6/.test(li.textContent)); })()`),
  );
  check(
    'KPI definitions dialog keeps Promo Funding with the DNP tool note (#2)',
    await evaluate(`(document.querySelector('#view-funding')?.textContent ?? '').includes('Not part of this dashboard: vendor funding analytics live in the DNP tool (#2). Vendor Promo Funding $ is still an input to Net Gross Margin.')`),
  );
  check(
    'KPI definitions: the workbook name links to SharePoint in a new tab',
    await evaluate(`(() => { const l = [...document.querySelectorAll('.defs-intro a')].find((x) => x.textContent.trim() === 'UC3_KPIs_Definitions_and_Mapping.xlsx'); return !!l && l.href.startsWith('https://weismarketsinc.sharepoint.com/') && l.target === '_blank' && l.rel.includes('noopener') && l.rel.includes('noreferrer'); })()`),
  );
  const method = await evaluate(`(() => {
    const t = document.querySelector('#def-score .defs-method');
    const rows = t ? [...t.querySelectorAll(':scope > tbody > tr')].map((r) => [...r.children].map((c) => c.textContent)) : [];
    return { row: !!document.querySelector('#def-score'), table: !!t, rows, verdicts: [...document.querySelectorAll('#def-score .verdict-chip')].map((x) => x.textContent).join('|') };
  })()`);
  check(
    'KPI definitions: Hot Buy Score method table (metric, current and proposed weight, how it scores) and the three verdicts',
    method.rows.length === 7 && method.rows[0][1] === '35 %' && method.rows[0][2] === '46.5 %' && method.rows[0][3].startsWith('Scaled to the discount d: floor F = d ÷ (1 − d).') && method.rows[2][3].startsWith('Directional') && method.verdicts === 'RE-EXECUTE|REFINE TACTIC|RECONSIDER SLOT',
    JSON.stringify({ ...method, rows: method.rows.slice(0, 3) }),
  );
  await evaluate(`document.querySelector('.defs-close').click(), 1`);

  // 8. Prototype review: Hot Buy Score, promo fatigue, timing heat map, Run Trend rows, Shopper Impact proposals, notes.
  const hoverAt = async (selectorExpr) => {
    await evaluate(`(${selectorExpr}).scrollIntoView({ block: 'center' }), 1`);
    await sleep(150);
    const r = await evaluate(`(() => { const b = (${selectorExpr}).getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; })()`);
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: r.x, y: r.y });
    await sleep(200);
  };
  await send('Page.navigate', { url: `${base}/?tab=hotbuy` });
  await until(`!!document.querySelector('table.hier .score-cell')`, 'Hot Buy Score column');
  const SCORE_CHIP = 'Scoring method: Weis Hot Buy Scoring Framework · weights pending (#19)';
  const scoreState = `(() => {
    const heads = [...document.querySelectorAll('table.hier thead th')].map((t) => t.textContent.trim());
    const cells = [...document.querySelectorAll('table.hier tbody tr:not(.sku-row) .score-cell')];
    const tile = [...document.querySelectorAll('.kpi-tile')].find((t) => t.querySelector('.kpi-label').textContent.startsWith('Hot Buy Score'));
    return {
      col: heads.findIndex((h) => h.startsWith('Hot Buy Score')) >= 0 && heads[heads.findIndex((h) => h.startsWith('Hot Buy Score')) + 1]?.startsWith('Net Incremental GM $'),
      scores: cells.map((c) => Number(c.querySelector('.cell-bar').firstChild.textContent)),
      verdicts: cells.map((c) => c.querySelector('.verdict-chip')?.textContent ?? ''),
      labels: cells.map((c) => c.getAttribute('aria-label')),
      tile: tile?.querySelector('.kpi-value').textContent ?? null,
      counts: tile?.querySelector('.verdict-counts')?.textContent ?? '',
      tileChip: tile?.textContent.includes(${JSON.stringify(SCORE_CHIP)}) ?? false,
      tileTip: tile?.querySelector('.tip-body')?.textContent ?? '',
      tableChip: document.querySelector('.table-card .chart-title').textContent.includes(${JSON.stringify(SCORE_CHIP)}),
      weights: ${pressed('Hot Buy Score weights')},
      inBar: !!document.querySelector('.calc-settings [role=group][aria-label="Hot Buy Score weights"]'),
      tags: [...document.querySelectorAll('.setting-tag[data-setting="weights"]')].map((t) => (t.classList.contains('is-changed') ? '*' : '') + t.firstChild.textContent),
      byRow: Object.fromEntries(cells.map((c) => [c.closest('tr').querySelector('.lbl')?.textContent ?? '', Number(c.querySelector('.cell-bar').firstChild.textContent)])),
    };
  })()`;
  const score = await evaluate(scoreState);
  const VERDICT = { 'RE-EXECUTE': (v) => v >= 85, 'REFINE TACTIC': (v) => v >= 70 && v <= 84, 'RECONSIDER SLOT': (v) => v < 70 };
  check(
    'Hot Buy Score: whole numbers 0–100 with a text verdict chip that matches the score; Net Incremental GM $ next to it; tile with the count by verdict; method chip',
    score.col && score.scores.length > 0 && score.scores.every((v, i) => Number.isInteger(v) && v >= 0 && v <= 100 && VERDICT[score.verdicts[i]]?.(v)) && /^\d{1,3}$/.test(score.tile ?? '') && /^\d+ Re-execute · \d+ Refine · \d+ Reconsider$/.test(score.counts) && score.tileChip && score.tableChip,
    JSON.stringify({ ...score, labels: score.labels.length }),
  );
  check(
    'Hot Buy Score (i): fixed 4-week pre-period and margin not part of the method (#19)',
    score.tileTip.includes("The score uses the method's fixed 4-week pre-period; the Baseline window setting does not change it.") && score.tileTip.includes('Margin is not part of the current scoring method; whether to add it is open (#19).'),
    score.tileTip,
  );
  check('Weights: "Current" by default in the Calculation settings bar; tile and table show the plain tag', score.weights === 'Current' && score.inBar && score.tags.length === 2 && score.tags.every((t) => t === 'Current weights'), JSON.stringify(score.tags));
  await hoverAt(`document.querySelector('table.hier tbody tr:not(.total-row) .score-cell')`);
  const breakdownOf = `(() => { const h = document.querySelector('.hovercard'); if (!h) return null; return { head: [...h.querySelectorAll('thead th')].map((t) => t.textContent).join('|'), rows: [...h.querySelectorAll('tbody tr')].map((r) => [...r.children].map((c) => c.textContent)), notes: [...h.querySelectorAll('.hovercard-note')].map((n) => n.textContent) }; })()`;
  const breakdown = await evaluate(breakdownOf);
  check(
    'Hovering a score shows value, points, weight and contribution per metric (Current 35 / 25 / 15 / 5 / 8 / 7 / 5 %), the total and the margin note',
    !!breakdown &&
      breakdown.head === 'Metric|Value|Points|Weight|Adds' &&
      breakdown.rows.length === 8 &&
      breakdown.rows.slice(0, 7).map((r) => r[0]).join('|') === 'Sales Lift|Unit Lift|Basket Lift|Cat. Sales Lift|Cat. Trip Lift|New-to-Category|Cat. Units' &&
      breakdown.rows.slice(0, 7).map((r) => r[3]).join('|') === '35 %|25 %|15 %|5 %|8 %|7 %|5 %' &&
      breakdown.rows[7][0] === 'Total (rounded)' &&
      breakdown.notes.some((n) => n.startsWith('Net Incremental Gross Margin $') && n.endsWith('not part of the score (#19).')) &&
      /^Hot Buy Score \d+ of 100, (RE-EXECUTE|REFINE TACTIC|RECONSIDER SLOT) \(Current weights\)\. Sales Lift /.test(score.labels[0]),
    JSON.stringify(breakdown),
  );
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 5, y: 5 });
  // The Baseline window does not change the score (the method's fixed 4-week pre-period).
  await send('Page.navigate', { url: `${base}/?tab=hotbuy&bw=13` });
  await until(`!!document.querySelector('table.hier .score-cell')`, 'Hot Buy Score with a 13-week baseline');
  const score13 = await evaluate(scoreState);
  check(
    'Hot Buy Score does not change with the Baseline window (13 wk vs. default 4 wk), event by event',
    Object.keys(score.byRow).length === score.scores.length && Object.entries(score.byRow).every(([k, v]) => score13.byRow[k] === v) && score13.counts === score.counts,
    `${JSON.stringify(score.byRow)} | ${JSON.stringify(score13.byRow)}`,
  );
  // Proposed weights: the URL keeps them, the tags are highlighted, the breakdown uses 46.5 / 31 / 10 / 2.5 / 4 / 3.5 / 2.5 %.
  await send('Page.navigate', { url: `${base}/?tab=hotbuy` });
  await until(`!!document.querySelector('table.hier .score-cell')`, 'Hot Buy Score column again');
  await evaluate(`[...document.querySelectorAll('[role=group][aria-label="Hot Buy Score weights"] button')].find((b) => b.textContent === 'Proposed').click(), 1`);
  await until(`location.search.includes('sw=proposed')`, 'Proposed weights in the URL');
  await sleep(300);
  const proposed = await evaluate(scoreState);
  await hoverAt(`document.querySelector('table.hier tbody tr:not(.total-row) .score-cell')`);
  const breakdownP = await evaluate(breakdownOf);
  check(
    'Weights: Proposed highlights the tag on the tile and the table ("Proposed weights (default Current)") and the breakdown uses the proposed weights',
    proposed.weights === 'Proposed' && proposed.tags.length === 2 && proposed.tags.every((t) => t === '*Proposed weights (default Current)') && breakdownP?.rows.slice(0, 7).map((r) => r[3]).join('|') === '46.5 %|31 %|10 %|2.5 %|4 %|3.5 %|2.5 %' && /\(Proposed weights\)/.test(proposed.labels[0]),
    JSON.stringify({ tags: proposed.tags, weights: breakdownP?.rows.map((r) => r[3]) }),
  );
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 5, y: 5 });
  await send('Page.navigate', { url: `${base}/?tab=hotbuy` });
  await until(`!!document.querySelector('table.hier .score-cell')`, 'Hot Buy Score column, Current weights');
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 5, y: 5 });
  const netInfo = await evaluate(`(() => { const t = document.querySelector('.kpi-tile .tip[aria-label="Net Incremental GM $ definition"]')?.closest('.kpi-tile'); const th = [...document.querySelectorAll('table.hier thead th')].find((x) => x.textContent.trim().startsWith('Net Incremental GM $')); return [t?.querySelector('.tip-body')?.textContent ?? '', th?.title ?? '']; })()`);
  check('Net Incremental GM $ (i) and column tooltip say funding is brought in behind the scenes', netInfo.every((t) => t.startsWith('Includes vendor funding. Funding data is brought in behind the scenes even though funding KPIs are not shown.')), JSON.stringify(netInfo));
  await evaluate(`document.querySelector('.paste-btn').click(), 1`);
  await until(`!!document.querySelector('.paste-pop')`, 'Paste UPCs popover');
  check('Paste UPCs popover shows the concept note', await evaluate(`document.querySelector('.paste-pop .paste-concept').textContent.trim() === 'Concept for review: this is the functionality we want to bring to Power BI. The final input format may differ.'`));
  await evaluate(`document.querySelector('.paste-btn').click(), 1`);

  await send('Page.navigate', { url: `${base}/?tab=history` });
  await until(`!!document.querySelector('.heatmap')`, 'timing heat map');
  const hist = await evaluate(`(() => {
    const cards = [...document.querySelectorAll('#tab-panel .chart-card, #tab-panel .table-card')].map((c) => c.getAttribute('aria-label'));
    const heat = [...document.querySelectorAll('section.chart-card')].find((c) => c.getAttribute('aria-label') === 'Promotion timing heat map');
    const heads = [...document.querySelectorAll('table.hier thead th')].map((t) => t.textContent.trim());
    const cells = [...heat.querySelectorAll('.heat-cell[aria-label]:not(.is-empty)')];
    return {
      order: cards.indexOf('Promotion timing heat map') === cards.length - 2 && cards[cards.length - 1] === 'Every past promotion',
      chip: heat.querySelector('.chart-title-chip').textContent === 'New request · production data from Cognira (pending)',
      legend: !!heat.querySelector('.heat-legend-bar') && heat.querySelector('.heat-legend').textContent.includes('No event'),
      cells: cells.length,
      cellLabel: cells[0]?.getAttribute('aria-label') ?? '',
      empty: heat.querySelectorAll('.heat-cell.is-empty').length > 0,
      fatigueCols: ['Promos in last 52 weeks', 'Days since previous promo'].every((h) => heads.includes(h)) && heads.some((h) => h.startsWith('Promo fatigue') && h.includes('Promo Hygiene Review thresholds')) && heads.some((h) => h.startsWith('Discount below floor')),
      fatigueTip: [...document.querySelectorAll('table.hier thead .th-extra .tip-body')].some((t) => t.textContent.startsWith('Thresholds from the Promo Hygiene Review (calibrated). The fatigue window is not yet calibrated. Not part of the Hot Buy Score.')),
      flags: [...document.querySelectorAll('table.hier tbody .flag-cell')].map((f) => f.getAttribute('aria-label')),
      oldFlag: document.body.textContent.includes('Promoted often</span>') || [...document.querySelectorAll('.flag-chip')].some((f) => f.textContent === 'Promoted often'),
    };
  })()`);
  check('Promo History: timing heat map after the charts and before the table, with chip, legend, labelled and empty cells', hist.order && hist.chip && hist.legend && hist.cells > 0 && /: Sales Lift % [+−-]?\d/.test(hist.cellLabel) && hist.empty, JSON.stringify(hist));
  check('Promo History: Promos in last 52 weeks, Days since previous promo, Promo fatigue (chip and (i)) and Discount below floor columns', hist.fatigueCols && hist.fatigueTip, JSON.stringify(hist));
  check('Promo History: the old "Promoted often" flag is gone', !hist.oldFlag);
  const heatCard = `[...document.querySelectorAll('section.chart-card')].find((c) => c.getAttribute('aria-label') === 'Promotion timing heat map')`;
  await shoot(heatCard, 'history-heatmap.png');
  await evaluate(`[...(${heatCard}).querySelectorAll('button')].find((b) => b.textContent === 'Category').click(), 1`);
  await evaluate(`[...(${heatCard}).querySelectorAll('button')].find((b) => b.textContent === 'Net Incremental GM $').click(), 1`);
  await sleep(300);
  const heat2 = await evaluate(`(() => { const c = ${heatCard}; return { rowHead: c.querySelector('.heat-head .heat-rowhead').textContent, legend: c.querySelector('.heat-legend-label').textContent }; })()`);
  await evaluate(`(${heatCard}).querySelector('button[aria-label="Show as table"]').click(), 1`);
  await sleep(200);
  const heatTable = await evaluate(`[...(${heatCard}).querySelectorAll('th')].map((t) => t.textContent).join('|')`);
  check('Heat map local controls switch rows to Category and colour to Net Incremental GM $; table view lists the 12 months', heat2.rowHead === 'Category' && heat2.legend === 'Avg Net Incremental GM $ per event' && heatTable === 'Category|Events|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec', JSON.stringify({ heat2, heatTable }));
  // Promo hygiene: Cheerios Family Size (price group 8) has one "Possible promo fatigue" event and one "Watch" in the demo data.
  await send('Page.navigate', { url: `${base}/?tab=history&pg=8` });
  await until(`document.querySelectorAll('table.hier tbody .flag-cell').length > 1`, 'flagged events');
  const fatigue = await evaluate(`[...document.querySelectorAll('table.hier tbody .flag-cell')].map((f) => ({ text: f.textContent, label: f.getAttribute('aria-label') }))`);
  await hoverAt(`[...document.querySelectorAll('table.hier tbody .flag-cell')].find((f) => f.textContent === 'Possible promo fatigue')`);
  await until(`!!document.querySelector('.hovercard .hovercard-list li')`, 'fatigue tooltip');
  const fatigueTip = await evaluate(`[...document.querySelectorAll('.hovercard .hovercard-list li')].map((l) => l.textContent)`);
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 5, y: 5 });
  const flagged = fatigue.filter((f) => f.text === 'Possible promo fatigue');
  const watched = fatigue.filter((f) => f.text === 'Watch');
  check(
    'Promo History: "Possible promo fatigue" (promoted often + efficiency in flag) and "Watch" (in watch), with the rules met and the event values',
    flagged.length === 1 &&
      watched.length === 1 &&
      flagged[0].label.startsWith('Possible promo fatigue. Promoted often: ') && /Low efficiency: -?\d+\.\d extra units \(%\) per discount point \([^:]+: flag below \d\.\d(, TPR values assumed)?\)/.test(flagged[0].label) &&
      watched[0].label.startsWith('Watch. Promoted often: ') && /Efficiency to watch: -?\d+\.\d extra units \(%\) per discount point \([^:]+: watch below \d\.\d(, TPR values assumed)?\)/.test(watched[0].label) &&
      fatigueTip.some((t) => t.startsWith('Promoted often: ') && t.includes('window not yet calibrated')) &&
      fatigueTip.some((t) => t.startsWith('Low efficiency: ')),
    JSON.stringify({ fatigue, fatigueTip }),
  );
  // Discount below floor (check A): Weis Quality Paper Towels 6 Rolls (price group 42) has one event under its floor.
  await send('Page.navigate', { url: `${base}/?tab=history&pg=42` });
  await until(`[...document.querySelectorAll('table.hier tbody .flag-cell')].some((f) => f.textContent === 'Below floor')`, 'event below the discount floor');
  const floor = await evaluate(`[...document.querySelectorAll('table.hier tbody .flag-cell')].filter((f) => f.textContent === 'Below floor').map((f) => f.getAttribute('aria-label'))`);
  check('Promo History: "Below floor" marks an event whose discount is under the calibrated minimum for its type', floor.length >= 1 && floor.every((l) => /^Below floor\. Promo Depth \d+ % is below the (15|10) % floor for /.test(l)), JSON.stringify(floor));

  await send('Page.navigate', { url: `${base}/?tab=trend` });
  await until(`!!document.querySelector('.runs-table')`, 'runs side by side');
  const trend = await evaluate(`(() => {
    const card = [...document.querySelectorAll('.table-card')].find((c) => c.getAttribute('aria-label') === 'Runs side by side');
    const rows = [...card.querySelectorAll('tbody th')].map((t) => t.textContent);
    const lift = [...card.querySelectorAll('tbody tr')].find((r) => r.querySelector('th').textContent.startsWith('Sales Lift %'));
    return { first: rows[0], counts: [...card.querySelector('tbody tr').querySelectorAll('td')].every((td) => /^\\d+$/.test(td.textContent)), bands: [...lift.querySelectorAll('td .lift-band')].map((b) => b.className.replace('lift-band ', '') + ':' + b.textContent).join(' '), legend: card.querySelector('.lift-legend')?.textContent ?? '', definitions: [...card.querySelectorAll('.table-head button')].some((b) => /Definitions|Thresholds|more/.test(b.textContent.trim())), legendTip: card.querySelector('.lift-legend .tip-body')?.textContent ?? '' };
  })()`);
  check(
    'Promo Run Trend: Event count row, lift colours by illustrative thresholds with legend and value shown, no Definitions link',
    trend.first.startsWith('Event count') && trend.counts && /band-(good|watch|low):[+−-]?\d/.test(trend.bands) && trend.legend.includes('Illustrative thresholds') && trend.legend.includes('High ≥ 30 %') && trend.legend.includes('Medium 10 %–30 %') && trend.legend.includes('Low < 10 %') && !trend.definitions && trend.legendTip.startsWith('Colour of Sales Lift % and Unit Lift % in each run: High (green) at 30 % or more'),
    JSON.stringify(trend),
  );

  // Shopper Impact: the "Layout proposal" control switches between A, B and C (default A).
  await send('Page.navigate', { url: `${base}/?tab=shopper` });
  await until(`!!document.querySelector('.proposal-bar')`, 'Shopper Impact proposals');
  const layoutOf = `(() => ({
    pressed: ${pressed('Layout proposal')},
    chip: document.querySelector('.proposal-bar .proposal-chip')?.textContent ?? '',
    approval: document.body.textContent.includes('Aggregates only. Individual-level detail requires approval (#16).'),
    a: !!document.querySelector('.table-card[aria-label="Category summary"]') && [...document.querySelectorAll('section.chart-card')].some((c) => c.getAttribute('aria-label') === 'Promo buyer lift by category'),
    b: [...document.querySelectorAll('section.chart-card')].some((c) => c.getAttribute('aria-label') === 'Promo buyers before, during and after') && !!document.querySelector('.proposal-bar .event-picker') && !!document.querySelector('.table-card[aria-label="All events"]'),
    c: document.querySelectorAll('.snapshot-grid .snapshot-card').length > 0 && !!document.querySelector('.snapshot-card .score-badge b') && !!document.querySelector('.proposal-bar .month-picker'),
    tiles: document.querySelectorAll('.kpi-tile').length,
  }))()`;
  // Whole page: the viewport grows to the page height, so the sticky header and the tab bar stay in place.
  const shootPage = async (file) => {
    if (!process.env.SCREENSHOTS) return;
    await evaluate(`scrollTo(0, 0), 1`);
    const h = await evaluate(`document.documentElement.scrollHeight`);
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: Math.min(h, 6000), deviceScaleFactor: 1, mobile: false });
    await sleep(500);
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(join(process.env.SCREENSHOTS, file), Buffer.from(shot.result.data, 'base64'));
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  };
  const pick = async (label) => {
    await evaluate(`[...document.querySelectorAll('[role=group][aria-label="Layout proposal"] button')].find((b) => b.textContent.startsWith(${JSON.stringify(label)})).click(), 1`);
    await sleep(500);
    return evaluate(layoutOf);
  };
  const la = await evaluate(layoutOf);
  check('Shopper Impact: proposal A (Category summary) by default, with the "Proposal for review" chip and the #16 line', la.pressed === 'A · Category summary' && la.a && !la.b && !la.c && la.chip === 'Proposal for review' && la.approval, JSON.stringify(la));
  await shootPage('shopper-proposal-a.png');
  const lb = await pick('B');
  check('Shopper Impact: the control switches to proposal B (Event detail)', lb.pressed === 'B · Event detail' && lb.b && !lb.a && !lb.c && lb.approval && lb.tiles >= 5, JSON.stringify(lb));
  await shootPage('shopper-proposal-b.png');
  const lc = await pick('C');
  check('Shopper Impact: the control switches to proposal C (Executive snapshot) with the Hot Buy Score per card', lc.pressed === 'C · Executive snapshot' && lc.c && !lc.a && !lc.b && lc.approval, JSON.stringify(lc));
  const snapshotOf = `(() => ({
    scores: [...document.querySelectorAll('.snapshot-card .score-badge b')].map((b) => Number(b.textContent)),
    verdicts: [...document.querySelectorAll('.snapshot-card .score-badge .verdict-chip')].map((v) => v.textContent),
    counts: [...document.querySelectorAll('.kpi-tile')].find((t) => t.querySelector('.kpi-label').textContent.startsWith('Hot Buy Score'))?.querySelector('.verdict-counts')?.textContent ?? '',
    weights: ${pressed('Hot Buy Score weights')},
    inHeader: !!document.querySelector('.snapshot-head .block-settings [role=group][aria-label="Hot Buy Score weights"]'),
    inBar: !!document.querySelector('.calc-settings [role=group][aria-label="Hot Buy Score weights"]'),
    tags: [...document.querySelectorAll('.setting-tag[data-setting="weights"]')].map((t) => (t.classList.contains('is-changed') ? '*' : '') + t.firstChild.textContent),
  }))()`;
  const snap = await evaluate(snapshotOf);
  check(
    'Shopper Impact C: cards ordered by score with a verdict chip, count by verdict, Weights in the snapshot header (not in the bar)',
    snap.scores.length > 0 && snap.scores.every((v, i) => i === 0 || snap.scores[i - 1] >= v) && snap.verdicts.length === snap.scores.length && snap.verdicts.every((v, i) => VERDICT[v]?.(snap.scores[i])) && /^\d+ Re-execute · \d+ Refine · \d+ Reconsider$/.test(snap.counts) && snap.weights === 'Current' && snap.inHeader && !snap.inBar && snap.tags.every((t) => t === 'Current weights'),
    JSON.stringify(snap),
  );
  await evaluate(`[...document.querySelectorAll('[role=group][aria-label="Hot Buy Score weights"] button')].find((b) => b.textContent === 'Proposed').click(), 1`);
  await sleep(400);
  const snapP = await evaluate(snapshotOf);
  check('Shopper Impact C: Proposed weights highlight the snapshot tags', snapP.weights === 'Proposed' && snapP.tags.length > 0 && snapP.tags.every((t) => t === '*Proposed weights (default Current)'), JSON.stringify(snapP.tags));
  await evaluate(`[...document.querySelectorAll('[role=group][aria-label="Hot Buy Score weights"] button')].find((b) => b.textContent === 'Current').click(), 1`);
  await sleep(300);
  await shootPage('shopper-proposal-c.png');
  const la2 = await pick('A');
  check('Shopper Impact: back to proposal A', la2.a && !la2.c, JSON.stringify(la2));

  check('No console errors or exceptions', errors.length === 0, errors.slice(0, 3).join(' | '));
  if (process.env.E2E_DEBUG) console.log(debug.join('\n'));
  ws.close();
  return results.every((r) => r.ok);
}

main()
  .then(async (ok) => {
    await cleanup();
    process.exit(ok ? 0 : 1);
  })
  .catch(async (err) => {
    console.error(`✗ ${err.message}`);
    await cleanup();
    process.exit(1);
  });
