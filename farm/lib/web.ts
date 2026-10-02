/**
 * Drives the app's web build (react-native-web via `expo export -p web`) with Playwright.
 * Used for playtests, raw screenshots and the app preview video when no Mac/simulator is available.
 */
import { createServer, type Server } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { chromium, type Browser, type BrowserContext, type Page, type Locator } from 'playwright-core';
import { chromiumPath, run, log } from './util.ts';
import type { Step, Target } from '../schemas/index.ts';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.ico': 'image/x-icon',
};

export async function exportWeb(appDir: string) {
  log.info('expo export -p web');
  const r = await run('npx', ['expo', 'export', '-p', 'web', '--output-dir', 'dist-web'], { cwd: appDir, env: { EXPO_OFFLINE: '1', CI: '1' }, quiet: true });
  if (r.code !== 0) throw new Error(`web export failed:\n${(r.stderr || r.stdout).slice(-4000)}`);
  return path.join(appDir, 'dist-web');
}

/** Static server mimicking Vercel/expo-router static hosting: /foo → foo.html → foo/index.html → +not-found.html */
export function serveStatic(dir: string): Promise<{ url: string; close: () => Promise<void> }> {
  const server: Server = createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url ?? '/').split('?')[0]);
    const candidates = [urlPath, `${urlPath}.html`, path.join(urlPath, 'index.html')];
    for (const c of candidates) {
      const f = path.join(dir, c);
      if (f.startsWith(dir) && existsSync(f) && statSync(f).isFile()) {
        res.writeHead(200, { 'content-type': MIME[path.extname(f)] ?? 'application/octet-stream' });
        return res.end(readFileSync(f));
      }
    }
    const nf = path.join(dir, '+not-found.html');
    res.writeHead(404, { 'content-type': MIME['.html'] });
    res.end(existsSync(nf) ? readFileSync(nf) : 'not found');
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      resolve({ url: `http://127.0.0.1:${port}`, close: () => new Promise((r) => server.close(() => r())) });
    });
  });
}

export async function launch(): Promise<Browser> {
  return chromium.launch({ executablePath: chromiumPath(), args: ['--font-render-hinting=none'] });
}

export interface PhoneOpts { width?: number; height?: number; dpr?: number; video?: { dir: string; size: { width: number; height: number } }; dark?: boolean }
export async function phoneContext(browser: Browser, baseUrl: string, o: PhoneOpts = {}): Promise<BrowserContext> {
  const ctx = await browser.newContext({
    viewport: { width: o.width ?? 390, height: o.height ?? 844 },
    deviceScaleFactor: o.dpr ?? 2,
    isMobile: true,
    hasTouch: true,
    colorScheme: o.dark ? 'dark' : 'light',
    locale: 'en-US',
    timezoneId: 'America/Los_Angeles',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1',
    ...(o.video ? { recordVideo: o.video } : {}),
  });
  // Keep the app sandboxed: no external navigation, popups or third-party calls during automated runs.
  const origin = new URL(baseUrl).origin;
  await ctx.route('**/*', (route) => (route.request().url().startsWith(origin) || route.request().url().startsWith('data:') ? route.continue() : route.abort()));
  ctx.on('page', (p) => { if (p !== ctx.pages()[0]) p.close().catch(() => {}); });
  await ctx.addInitScript(() => {
    // Hide scrollbars so captures look like a phone; freeze the caret blink.
    const style = document.createElement('style');
    style.textContent = '::-webkit-scrollbar{display:none} *{scrollbar-width:none; caret-color: transparent}';
    document.addEventListener('DOMContentLoaded', () => document.head.appendChild(style));
    window.open = () => null;
  });
  return ctx;
}

export function locate(page: Page, t: Target): Locator {
  if ('id' in t) return page.locator(`[data-testid="${t.id}"]`).filter({ visible: true }).first();
  return page.getByText(t.text, { exact: false }).filter({ visible: true }).first();
}
export function describeTarget(t: Target) { return 'id' in t ? `#${t.id}` : `"${t.text}"`; }

export async function waitForApp(page: Page) {
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForFunction(() => (document.body?.innerText ?? '').trim().length > 0, null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(400);
}

export interface StepRunOpts {
  demo: boolean;
  stepDelayMs?: number;
  timeoutMs?: number;
  onScreenshot?: (name: string, page: Page) => Promise<void>;
  smooth?: boolean;
}

/** Execute DSL steps. Throws with a readable message on the first failing step. */
export async function runSteps(page: Page, baseUrl: string, steps: Step[], o: StepRunOpts) {
  let opened = false;
  const timeout = o.timeoutMs ?? 8000;
  for (const [i, s] of steps.entries()) {
    const where = `step ${i + 1} ${JSON.stringify(s)}`;
    try {
      if ('open' in s) {
        const demo = o.demo && !opened ? (s.open.includes('?') ? '&' : '?') + 'farmDemo=1' : '';
        await page.goto(baseUrl + s.open + demo);
        await waitForApp(page);
        opened = true;
      } else if ('tap' in s) {
        const l = locate(page, s.tap);
        await l.waitFor({ state: 'visible', timeout });
        if (o.smooth) await l.hover().catch(() => {});
        await l.click({ timeout });
      } else if ('type' in s) {
        const l = locate(page, s.type.target);
        await l.waitFor({ state: 'visible', timeout });
        if (o.smooth) await l.pressSequentially(s.type.text, { delay: 60 });
        else await l.fill(s.type.text);
      } else if ('expect' in s) {
        await locate(page, s.expect).waitFor({ state: 'visible', timeout });
      } else if ('expectNot' in s) {
        await page.waitForTimeout(300);
        const n = await ('id' in s.expectNot
          ? page.locator(`[data-testid="${s.expectNot.id}"]`).filter({ visible: true }).count()
          : page.getByText(s.expectNot.text).filter({ visible: true }).count());
        if (n > 0) throw new Error(`${describeTarget(s.expectNot)} is still visible`);
      } else if ('back' in s) {
        await page.goBack();
        await waitForApp(page);
      } else if ('wait' in s) {
        await page.waitForTimeout(s.wait);
      } else if ('scroll' in s) {
        const vp = page.viewportSize() ?? { width: 390, height: 844 };
        await page.mouse.move(vp.width / 2, vp.height / 2);
        const dy = s.scroll === 'down' ? vp.height * 0.6 : -vp.height * 0.6;
        if (o.smooth) for (let k = 0; k < 12; k++) { await page.mouse.wheel(0, dy / 12); await page.waitForTimeout(25); }
        else await page.mouse.wheel(0, dy);
      } else if ('screenshot' in s) {
        await o.onScreenshot?.(s.screenshot, page);
      }
      if (!('wait' in s)) await page.waitForTimeout(o.stepDelayMs ?? 250);
    } catch (e) {
      throw new Error(`${where}: ${(e as Error).message.split('\n')[0]}`);
    }
  }
}

/** Collect uncaught errors + console.error output for a page. */
export function trackErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (/net::ERR_FAILED|Failed to load resource/.test(t)) return; // blocked third-party requests (sandbox)
    errors.push(`console.error: ${t.slice(0, 300)}`);
  });
  return errors;
}
