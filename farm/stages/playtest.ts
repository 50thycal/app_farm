/**
 * Automated playtest on the web build:
 *  1. Scripted user journeys (app/e2e/journeys.json) — must all pass.
 *  2. A crawler that opens every static route in the spec, taps every safe button and watches for
 *     crashes, console errors, blank screens, not-found routes, horizontal overflow and tiny tap targets.
 * Every screen is captured to reports/playtest/*.png so an agent can visually review the UI.
 */
import path from 'node:path';
import { rmSync } from 'node:fs';
import { appPaths, ensureDir, log, writeJson, writeText } from '../lib/util.ts';
import { Checks, validateFile } from '../lib/state.ts';
import { exportWeb, launch, phoneContext, runSteps, serveStatic, trackErrors, waitForApp } from '../lib/web.ts';

const UNSAFE = /delete|remove|sign ?out|log ?out|reset|erase|purchase|subscribe|buy|restore/i;

export async function playtest(slug: string, opts: { skipBuild?: boolean } = {}) {
  const P = appPaths(slug);
  const checks = new Checks();
  const spec = validateFile('spec', P.spec);
  const journeys = validateFile('journeys', P.journeys);
  if (!spec.ok) throw new Error(`spec.json invalid: ${spec.errors.join('; ')}`);
  if (!journeys.ok) checks.fail('journeys.schema', `e2e/journeys.json invalid: ${journeys.errors.join('; ')}`);

  const dist = opts.skipBuild ? path.join(P.app, 'dist-web') : await exportWeb(P.app);
  const server = await serveStatic(dist);
  const browser = await launch();
  const shotDir = path.join(P.reports, 'playtest');
  rmSync(shotDir, { recursive: true, force: true });
  ensureDir(shotDir);
  const results: any = { journeys: [], screens: [] };

  try {
    // ---- 1. journeys
    for (const j of journeys.ok ? journeys.data.journeys : []) {
      const ctx = await phoneContext(browser, server.url);
      const page = await ctx.newPage();
      const errors = trackErrors(page);
      let failure: string | undefined;
      try {
        await runSteps(page, server.url, j.steps, {
          demo: j.demo,
          onScreenshot: async (name, p) => { await p.screenshot({ path: path.join(shotDir, `journey-${j.id}-${name}.png`) }); },
        });
      } catch (e) {
        failure = (e as Error).message;
        await page.screenshot({ path: path.join(shotDir, `FAIL-journey-${j.id}.png`) }).catch(() => {});
      }
      await ctx.close();
      const lvl = failure || errors.length ? (j.critical ? 'fail' : 'warn') : 'pass';
      checks.add(`journey.${j.id}`, lvl, failure ?? (errors.length ? `runtime errors: ${errors.slice(0, 3).join(' | ')}` : j.title));
      results.journeys.push({ id: j.id, title: j.title, failure, errors });
    }

    // ---- 2. crawler over every static route
    const routes = spec.data.screens.filter((s) => !s.route.includes('['));
    for (const s of routes) {
      const ctx = await phoneContext(browser, server.url);
      const page = await ctx.newPage();
      const errors = trackErrors(page);
      const id = `screen.${s.id}`;
      try {
        await page.goto(`${server.url}${s.route}${s.route.includes('?') ? '&' : '?'}farmDemo=1`);
        await waitForApp(page);
        await page.screenshot({ path: path.join(shotDir, `screen-${s.id}.png`) });
        const text = (await page.locator('body').innerText()).trim();
        if (!text) checks.fail(`${id}.blank`, `${s.route} renders no text`);
        if (/This screen doesn't exist|Unmatched Route|Page could not be found/i.test(text))
          checks.fail(`${id}.route`, `${s.route} is not a real route (expected file ${s.file})`);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
        if (overflow) checks.warn(`${id}.overflow`, `${s.route} overflows horizontally at 390pt width`, 'HIG layout');

        // Tap targets (HIG: ≥ 44×44pt)
        const small = await page.evaluate(() =>
          [...document.querySelectorAll('[role="button"],a[href],[role="link"],[role="tab"]')]
            .map((el) => el.getBoundingClientRect())
            .filter((r) => r.width > 0 && r.height > 0 && (r.width < 30 || r.height < 30)).length);
        if (small) checks.warn(`${id}.tap-targets`, `${small} tappable element(s) smaller than ~30pt on ${s.route} (HIG wants 44pt)`, 'HIG');

        // Monkey: tap each safe button once, reload between taps.
        const buttons = await page.locator('[role="button"]:visible').evaluateAll((els) =>
          els.map((el, i) => ({ i, label: ((el as HTMLElement).innerText || el.getAttribute('aria-label') || el.getAttribute('data-testid') || '').trim() })));
        let tapped = 0;
        for (const b of buttons.slice(0, 15)) {
          if (UNSAFE.test(b.label)) continue;
          const before = errors.length;
          await page.locator('[role="button"]:visible').nth(b.i).click({ timeout: 3000 }).catch(() => {});
          await page.waitForTimeout(350);
          tapped++;
          if (errors.length > before) checks.fail(`${id}.tap`, `Tapping "${b.label || `button #${b.i}`}" on ${s.route} raised: ${errors[errors.length - 1]}`);
          await page.goto(`${server.url}${s.route}`);
          await waitForApp(page);
        }
        checks.expect(errors.length === 0, `${id}.errors`, `${s.route}: no runtime errors (${tapped} taps)`, `${s.route}: ${errors.slice(0, 3).join(' | ')}`);
        results.screens.push({ id: s.id, route: s.route, tapped, errors });
      } catch (e) {
        checks.fail(`${id}.crash`, `${s.route}: ${(e as Error).message.split('\n')[0]}`);
      }
      await ctx.close();
    }
  } finally {
    await browser.close();
    await server.close();
  }

  ensureDir(P.reports);
  writeJson(path.join(P.reports, 'playtest.json'), { at: new Date().toISOString(), ok: checks.ok, checks: checks.list, ...results });
  writeText(path.join(P.reports, 'playtest.md'), checks.toMarkdown(`Playtest — ${slug}`) +
    `\nScreen captures for visual review: \`apps/${slug}/reports/playtest/*.png\`\n`);
  (checks.ok ? log.ok : log.err)(`playtest: ${checks.failed.length} fail, ${checks.warned.length} warn → apps/${slug}/reports/playtest.md`);
  return checks;
}
