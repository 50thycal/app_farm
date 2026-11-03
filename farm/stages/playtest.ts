/**
 * Automated playtest on the web build:
 *  1. Scripted user journeys (app/e2e/journeys.json) — must all pass.
 *  2. A crawler that opens every static route in the spec, taps every safe button and watches for
 *     crashes, console errors, blank screens, not-found routes, horizontal overflow and tiny tap targets.
 * Every screen is captured to reports/playtest/*.png so an agent can visually review the UI.
 */
import path from 'node:path';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { spawn, type ChildProcess } from 'node:child_process';
import type { Page } from 'playwright-core';
import { appPaths, chromiumPath, ensureDir, log, run, writeJson, writeText } from '../lib/util.ts';
import { Checks, validateFile } from '../lib/state.ts';
import { exportWeb, launch, loadHooks, phoneContext, runSteps, serveStatic, trackErrors, waitForApp } from '../lib/web.ts';
import { shq, sourceOf, sourceState, storeBundle } from '../lib/webgame.ts';
import { seedStorage } from './assets.ts';

const UNSAFE = /delete|remove|sign ?out|log ?out|reset|erase|purchase|subscribe|buy|restore/i;

export async function playtest(slug: string, opts: { skipBuild?: boolean; fast?: boolean } = {}) {
  const P = appPaths(slug);
  const kind = validateFile('spec', P.spec);
  if (kind.ok && kind.data.app.kind === 'web-game') return playtestWebGame(slug, opts);
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

// ============================================================================ web-game
/** Landscape phone viewports (pt) a web game is checked at: 6.9", 6.3"/16 Pro, 6.1"/14, 4.7"/SE. */
const PHONE_SIZES: [number, number][] = [[956, 440], [874, 402], [844, 390], [667, 375]];

async function startServer(cmd: string, cwd: string, url: string): Promise<ChildProcess> {
  const child = spawn('bash', ['-c', cmd], { cwd, detached: true, stdio: 'ignore' });
  for (let i = 0; i < 120; i++) {
    await new Promise((r) => setTimeout(r, 500));
    if (child.exitCode !== null) throw new Error(`"${cmd}" exited with ${child.exitCode}`);
    if (await fetch(url).then((r) => r.status < 500).catch(() => false)) return child;
  }
  stopServer(child);
  throw new Error(`"${cmd}" did not serve ${url} within 60 s`);
}
function stopServer(child?: ChildProcess) {
  if (child?.pid && child.exitCode === null) try { process.kill(-child.pid, 'SIGTERM'); } catch { /* gone */ }
}
const tail = (s: string, n: number) => s.trim().split('\n').slice(-n).join('\n');
/** One-line summary of a test runner's output (vitest/jest totals, or ok:/FAIL: line counts). */
function suiteSummary(out: string) {
  const plain = out.replace(/\x1b\[[0-9;]*m/g, '');
  const totals = plain.match(/^\s*Tests\s+(\d.+)$/m)?.[1]?.trim();
  if (totals) return `tests: ${totals}`;
  const ok = (plain.match(/^ok:/gm) ?? []).length;
  const bad = (plain.match(/^FAIL:/gm) ?? []).length;
  return ok || bad ? `${ok} ok, ${bad} FAIL` : tail(plain, 1).slice(0, 160);
}

/**
 * Web-game playtest: (1) the game's own suites (spec.source.tests), (2) the store-flavour bundle opened at
 * four phone sizes in the app's orientation (runtime errors, remote requests, overflow, captures) and
 * (3) the farm-side journeys (apps/<slug>/e2e/journeys.json) against the store bundle.
 */
export async function playtestWebGame(slug: string, opts: { skipBuild?: boolean; fast?: boolean } = {}) {
  const P = appPaths(slug);
  const checks = new Checks();
  const spec = validateFile('spec', P.spec);
  if (!spec.ok) throw new Error(`spec.json invalid: ${spec.errors.join('; ')}`);
  const src = sourceOf(spec.data);
  const journeys = validateFile('journeys', P.webJourneys);
  if (!journeys.ok) checks.fail('journeys.schema', `e2e/journeys.json invalid: ${journeys.errors.join('; ')}`);
  if (!existsSync(path.join(P.source, 'package.json'))) throw new Error(`no game checkout — run: npm run farm -- run ${slug} scaffold`);
  const shotDir = path.join(P.reports, 'playtest');
  rmSync(shotDir, { recursive: true, force: true });
  ensureDir(shotDir);
  const results: any = { source: await sourceState(slug), suites: [], journeys: [], screens: [] };

  // ---- 1. the game's own suites
  let server: ChildProcess | undefined;
  // --fast skips the suites for quick capture iterations; the report then cannot pass the gate.
  if (opts.fast && src.tests.length) checks.fail('suite.skipped', `game suites skipped (--fast): re-run without --fast — ${src.tests.map((t) => t.id).join(', ')}`);
  try {
    for (const t of opts.fast ? [] : src.tests) {
      if (t.server && !server) {
        if (!src.previewServer) { checks.fail(`suite.${t.id}`, `${t.id} needs source.previewServer`); continue; }
        log.info(`${src.previewServer.buildCmd} (for the game's e2e suites)`);
        const b = await run('bash', ['-c', src.previewServer.buildCmd], { cwd: P.source, quiet: true });
        if (b.code !== 0) { checks.fail('suite.preview-build', `${src.previewServer.buildCmd} failed: ${tail(b.stderr || b.stdout, 8)}`); break; }
        try { server = await startServer(src.previewServer.cmd, P.source, src.previewServer.url); } catch (e) {
          checks.fail('suite.preview-server', `${(e as Error).message} (is something else on ${src.previewServer.url}?)`);
          break;
        }
      }
      log.info(`suite ${t.id}: ${t.cmd}`);
      const t0 = Date.now();
      const env: Record<string, string> = { CI: '1', SHOT_DIR: ensureDir(path.join(P.tmp, 'suites', t.id)) };
      if (src.previewServer) env.BASE_URL = src.previewServer.url;
      const chrome = chromiumPath();
      if (chrome) env.CHROMIUM_PATH = chrome;
      // Output goes to a file, not a pipe: a grandchild that outlives the suite (a test's server, esbuild)
      // would otherwise hold the pipe open and the run would never finish.
      const logFile = path.join(P.tmp, 'suites', `${t.id}.log`);
      const r = await run('bash', ['-c', `timeout ${t.timeoutSec} bash -c ${shq(t.cmd)} > ${shq(logFile)} 2>&1 < /dev/null`], { cwd: P.source, quiet: true, env });
      const out = existsSync(logFile) ? readFileSync(logFile, 'utf8') : `${r.stdout}\n${r.stderr}`;
      const summary = suiteSummary(out);
      const secs = Math.round((Date.now() - t0) / 1000);
      checks.add(`suite.${t.id}`, r.code === 0 ? 'pass' : t.critical ? 'fail' : 'warn',
        r.code === 0 ? `${t.cmd}: ${summary} (${secs}s)` : `${t.cmd} exited ${r.code === 124 ? 'on timeout' : r.code}: ${summary} — ${tail(out.replace(/\x1b\[[0-9;]*m/g, ''), 6).replace(/\n/g, ' | ')}`);
      results.suites.push({ id: t.id, cmd: t.cmd, code: r.code, secs, summary, tail: tail(out, 15) });
    }
  } finally {
    stopServer(server);
  }

  // ---- 2. the store bundle at phone sizes
  let web: Awaited<ReturnType<typeof storeBundle>> | undefined;
  try { web = await storeBundle(slug, spec.data, { skipBuild: opts.skipBuild }); } catch (e) { checks.fail('store.build', (e as Error).message.slice(0, 1500)); }
  if (web) {
    checks.expect(web.report.storeFlavor, 'store.flavor', `${web.entry} is the store flavour`,
      `${web.entry} has no <meta name="app-flavor" content="store"> (${web.report.usedFallback ? 'fallback build — the store flavour is not in this ref yet' : 'wrong build'}); preflight will fail`, undefined, 'warn');
    const landscape = spec.data.app.orientation === 'landscape';
    const sizes = PHONE_SIZES.map(([a, b]) => (landscape ? [a, b] : [b, a]) as [number, number]);
    const hooks = await loadHooks(slug);
    const srv = await serveStatic(web.dir, { index: web.entry });
    const browser = await launch();
    const origin = new URL(srv.url).origin;
    const watch = (page: Page) => {
      const errors = trackErrors(page);
      const external: string[] = [];
      page.on('request', (r) => { const u = r.url(); if (!u.startsWith(origin) && !/^(data|blob):/.test(u)) external.push(u); });
      return { errors, external };
    };
    try {
      for (const [w, h] of sizes) {
        const ctx = await phoneContext(browser, srv.url, { width: w, height: h, dpr: 2 });
        const page = await ctx.newPage();
        const { errors, external } = watch(page);
        const id = `screen.${w}x${h}`;
        try {
          await page.goto(`${srv.url}/`);
          await waitForApp(page);
          await page.waitForTimeout(800);
          await page.screenshot({ path: path.join(shotDir, `screen-${w}x${h}.png`) });
          const m = await page.evaluate(() => ({
            sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight, iw: window.innerWidth, ih: window.innerHeight,
            text: (document.body?.innerText ?? '').trim().length,
          }));
          if (!m.text) checks.fail(`${id}.blank`, `${w}×${h}: the first screen renders no text`);
          checks.expect(m.sw <= m.iw + 2 && m.sh <= m.ih + 2, `${id}.overflow`, `${w}×${h}: fits the screen`, `${w}×${h}: page scrolls (${m.sw}×${m.sh} in ${m.iw}×${m.ih}) — a game screen must fit`, 'HIG layout', 'warn');
        } catch (e) {
          checks.fail(`${id}.crash`, `${w}×${h}: ${(e as Error).message.split('\n')[0]}`);
        }
        checks.expect(errors.length === 0, `${id}.errors`, `${w}×${h}: no runtime errors`, `${w}×${h}: ${errors.slice(0, 3).join(' | ')}`);
        checks.expect(external.length === 0, `${id}.remote`, `${w}×${h}: no remote requests`, `${w}×${h}: requested ${[...new Set(external)].slice(0, 4).join(', ')}`, '4.2');
        results.screens.push({ size: `${w}x${h}`, errors, external });
        await ctx.close();
      }
      // ---- 3. farm journeys against the store bundle (largest phone size)
      const [w, h] = sizes[0];
      for (const j of journeys.ok ? journeys.data.journeys : []) {
        const ctx = await phoneContext(browser, srv.url, { width: w, height: h, dpr: 2 });
        await seedStorage(ctx, j.seed);
        const page = await ctx.newPage();
        const { errors, external } = watch(page);
        let failure: string | undefined;
        try {
          await runSteps(page, srv.url, j.steps, {
            demo: j.demo, hooks,
            onScreenshot: async (name, p) => { await p.screenshot({ path: path.join(shotDir, `journey-${j.id}-${name}.png`) }); },
          });
        } catch (e) {
          failure = (e as Error).message;
          await page.screenshot({ path: path.join(shotDir, `FAIL-journey-${j.id}.png`) }).catch(() => {});
        }
        await ctx.close();
        const lvl = failure || errors.length || external.length ? (j.critical ? 'fail' : 'warn') : 'pass';
        checks.add(`journey.${j.id}`, lvl, failure ?? (errors.length ? `runtime errors: ${errors.slice(0, 3).join(' | ')}` : external.length ? `remote requests: ${[...new Set(external)].slice(0, 3).join(', ')}` : j.title));
        results.journeys.push({ id: j.id, title: j.title, failure, errors, external });
      }
    } finally {
      await browser.close();
      await srv.close();
    }
  }

  ensureDir(P.reports);
  writeJson(path.join(P.reports, 'playtest.json'), { at: new Date().toISOString(), ok: checks.ok, checks: checks.list, ...results });
  writeText(path.join(P.reports, 'playtest.md'), checks.toMarkdown(`Playtest — ${slug}`) +
    `\nSource: ${src.value}@${src.ref} (${results.source.sha?.slice(0, 10) ?? '?'}). Screen captures for visual review: \`apps/${slug}/reports/playtest/*.png\`\n`);
  (checks.ok ? log.ok : log.err)(`playtest: ${checks.failed.length} fail, ${checks.warned.length} warn → apps/${slug}/reports/playtest.md`);
  return checks;
}
