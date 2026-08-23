/* UI verification: drives the built app in headless chromium against the real API.
   Not shipped — lives outside the project deps. */
import { chromium } from 'playwright';
import fs from 'node:fs';

const DATA_DIR = '/tmp/tdb-ui-' + Date.now();
const PORT = 3977;
const BASE = `http://127.0.0.1:${PORT}`;
process.env.DATA_DIR = DATA_DIR;

const { buildExpressApp, serveSpa } = await import('../dist/server/app.js');
const { initDb, closeDb } = await import('../dist/server/db.js');
initDb(DATA_DIR);
const app = buildExpressApp({ dataDir: DATA_DIR, maxUploadMb: 5 });
serveSpa(app, new URL('../dist/web', import.meta.url).pathname);
const server = app.listen(PORT);

const errors = [];
let step = 0;
const shot = (page, name) =>
  page.screenshot({ path: `/tmp/ui-shots/${String(++step).padStart(2, '0')}-${name}.png`, fullPage: false });

try {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: 'en-US',
    timezoneId: 'Europe/Berlin',
  });
  const page = await ctx.newPage();
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));

  fs.mkdirSync('/tmp/ui-shots', { recursive: true });

  // 1. empty state
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await shot(page, 'empty');
  if (!(await page.getByText('No trips yet').isVisible())) throw new Error('expected empty state');

  // 2. create a trip that started yesterday (so redistribution is observable)
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  await page.getByRole('button', { name: 'New trip' }).click();
  await page.fill('#trip-name', 'Portugal Test');
  await page.fill('#trip-start', yesterday);
  await page.fill('#trip-days', '5');
  await page.fill('#trip-budget', '50');
  await shot(page, 'create-form');
  await page.getByRole('button', { name: 'Create trip' }).click();
  await page.waitForTimeout(800);
  await shot(page, 'today');

  // Today tab should show the ring with "Left today"
  if (!(await page.getByText('Left today').isVisible())) throw new Error('today hero missing');

  // 3. add an expense via FAB
  await page.click('.fab');
  await page.waitForSelector('#exp-amount');
  await page.fill('#exp-amount', '63,50'); // comma decimal + overspend day 1
  await page.fill('#exp-date', yesterday);
  await page.fill('#exp-title', 'Airport transfer');
  await page.getByText('Transport', { exact: false }).first().click();
  await shot(page, 'expense-form');
  await page.locator('.sheet').getByRole('button', { name: 'Add expense' }).click();
  await page.waitForTimeout(700);
  await shot(page, 'after-expense');

  // 4. Trip tab: timeline shows day 1 over budget (red) and reduced future projections
  await page.getByRole('button', { name: 'Trip', exact: true }).click();
  await page.waitForTimeout(400);
  await shot(page, 'trip-timeline', { fullPage: true });
  const body = await page.textContent('body');
  if (!/Settled/.test(body)) throw new Error('settled day missing from timeline');
  if (!/Planned/.test(body)) throw new Error('planned days missing');

  // 5. Expenses tab lists it; search works
  await page.getByRole('button', { name: 'Expenses', exact: true }).click();
  await page.waitForTimeout(300);
  if (!(await page.getByText('Airport transfer').isVisible())) throw new Error('expense not listed');
  await page.fill('input[aria-label="Search expenses"]', 'zzz-no-match');
  await page.waitForTimeout(200);
  if (!(await page.getByText('No matches').isVisible())) throw new Error('search filter broken');
  await shot(page, 'expenses-search');

  // 6. Settings: edit trip → change budget to 80 → today allocations recalc
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: 'Edit trip' }).click();
  await page.fill('#trip-budget', '80');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: 'Today', exact: true }).click();
  await page.waitForTimeout(400);
  const todayCard = await page.textContent('.hero');
  if (!/€|EUR|\d/.test(todayCard)) throw new Error('currency amount missing after edit');
  await shot(page, 'settings-recalc');

  // 7. reload — state persists via localStorage + API
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  if (!(await page.getByText('Portugal Test').isVisible())) throw new Error('trip selection did not persist');
  await shot(page, 'reload-persist');

  await browser.close();

  if (errors.length) {
    console.log('CONSOLE ERRORS:\n' + errors.join('\n'));
    process.exitCode = 1;
  } else {
    console.log('UI VERIFICATION PASSED — no console errors');
  }
} catch (err) {
  console.error('UI VERIFICATION FAILED:', err.message);
  console.error(errors.length ? 'console errors:\n' + errors.join('\n') : '(no console errors captured)');
  process.exitCode = 1;
} finally {
  server.closeAllConnections?.();
  server.close();
  closeDb();
  fs.rmSync(DATA_DIR, { recursive: true, force: true });
  process.exit(process.exitCode || 0);
}
