// End-to-end check of the production build (adapted from UC2): access gate, the six views, typed dates and the
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
  ['trend', 'Promo Run Trend'],
  ['funding', 'Promo Funding'],
  ['history', 'Promo History'],
  ['shopper', 'Promo Shopper Impact'],
];

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
    check(`${title} renders`, !info.error && info.tiles >= 5 && info.tiles <= 8 && info.pending > 0 && info.rows > 0, `${info.tiles} tiles · ${info.rows} table rows · ${info.charts} charts · ${info.pending} pending marks`);
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
  check('Baseline note with Definition pending #6', await evaluate(`(() => { const n = document.querySelector('.baseline-note'); return n.textContent.includes('Baseline includes prior promo weeks in the window') && n.textContent.includes('Definition pending #6'); })()`));
  await evaluate(`document.querySelector('table.hier tbody tr:not(.total-row) button[aria-expanded]').click(), 1`);
  await until(`!!document.querySelector('tr.sku-row .pg-only')`, 'SKU row dash');
  check('SKU-row cannibalization dash has the tooltip', await evaluate(`[...document.querySelectorAll('tr.sku-row .pg-only')].every((e) => e.title === 'Measured at price group level')`));
  await send('Page.navigate', { url: `${base}/?tab=shopper` });
  await until(`!!document.querySelector('.sum-label')`, 'buyer count sum label');
  check('Promo Buyer Count total is labelled as a sum across events', await evaluate(`document.querySelector('.sum-label').textContent.includes('Sum across events (not unique households)') && !!document.querySelector('.sum-label .tip')`));
  await send('Page.navigate', { url: `${base}/?tab=funding&fu=bill` });
  await until(`document.querySelector('.banner-stack')?.textContent.includes('Bill-back only')`, 'funding filter note');
  check('Funding Type filter note is shown', true);

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
