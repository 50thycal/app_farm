import { spawn, spawnSync, type SpawnOptions } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const APPS_DIR = path.join(ROOT, 'apps');
export const TEMPLATES_DIR = path.join(ROOT, 'templates');
export const PLAYBOOKS_DIR = path.join(ROOT, 'playbooks');

export function appPaths(slug: string) {
  const dir = path.join(APPS_DIR, slug);
  return {
    dir,
    pipeline: path.join(dir, 'pipeline.json'),
    idea: path.join(dir, 'idea.md'),
    brief: path.join(dir, 'brief.json'),
    spec: path.join(dir, 'spec.json'),
    specMd: path.join(dir, 'spec.md'),
    app: path.join(dir, 'app'),
    appJson: path.join(dir, 'app', 'app.json'),
    easJson: path.join(dir, 'app', 'eas.json'),
    journeys: path.join(dir, 'app', 'e2e', 'journeys.json'),
    store: path.join(dir, 'store'),
    listing: path.join(dir, 'store', 'listing.json'),
    shots: path.join(dir, 'store', 'shots.json'),
    iconSvg: path.join(dir, 'store', 'icon.svg'),
    iconPng: path.join(dir, 'store', 'icon-1024.png'),
    rawWeb: path.join(dir, 'store', 'raw', 'web'),
    rawNative: path.join(dir, 'store', 'raw', 'native'),
    screenshots: path.join(dir, 'store', 'screenshots'),
    previews: path.join(dir, 'store', 'previews'),
    appPrivacy: path.join(dir, 'store', 'app_privacy.json'),
    fastlaneMeta: path.join(dir, 'store', 'fastlane', 'metadata'),
    site: path.join(dir, 'site'),
    reports: path.join(dir, 'reports'),
    tmp: path.join(dir, '.farm-tmp'),
  };
}
export type AppPaths = ReturnType<typeof appPaths>;

// ---------- logging ----------
const tty = process.stdout.isTTY;
const c = (code: number) => (s: string) => (tty ? `\x1b[${code}m${s}\x1b[0m` : s);
export const color = { red: c(31), green: c(32), yellow: c(33), blue: c(34), gray: c(90), bold: c(1) };
export const log = {
  info: (...a: unknown[]) => console.log(color.blue('›'), ...a),
  ok: (...a: unknown[]) => console.log(color.green('✓'), ...a),
  warn: (...a: unknown[]) => console.log(color.yellow('!'), ...a),
  err: (...a: unknown[]) => console.error(color.red('✗'), ...a),
  step: (s: string) => console.log('\n' + color.bold(`== ${s} ==`)),
};

// ---------- fs ----------
export function readJson<T = any>(file: string): T {
  return JSON.parse(readFileSync(file, 'utf8')) as T;
}
export function readJsonIf<T = any>(file: string): T | undefined {
  return existsSync(file) ? readJson<T>(file) : undefined;
}
export function writeJson(file: string, data: unknown) {
  ensureDir(path.dirname(file));
  writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
}
export function writeText(file: string, text: string) {
  ensureDir(path.dirname(file));
  writeFileSync(file, text);
}
export function ensureDir(dir: string) {
  mkdirSync(dir, { recursive: true });
  return dir;
}
export function walk(dir: string, filter: (p: string) => boolean = () => true, skip = ['node_modules', '.git', 'dist-web', 'dist-ios', 'ios', 'android', '.expo']): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (skip.includes(name)) continue;
    const p = path.join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...walk(p, filter, skip));
    else if (filter(p)) out.push(p);
  }
  return out;
}
export function newestMtime(files: string[]): number {
  return files.reduce((m, f) => Math.max(m, statSync(f).mtimeMs), 0);
}

// ---------- processes ----------
export interface RunResult { code: number; stdout: string; stderr: string }
/** Run a command, streaming output; resolves with exit code + captured output. */
export function run(cmd: string, args: string[], opts: SpawnOptions & { quiet?: boolean; input?: string } = {}): Promise<RunResult> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: ['pipe', 'pipe', 'pipe'], ...opts, env: { ...process.env, ...opts.env } });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (d) => { stdout += d; if (!opts.quiet) process.stdout.write(d); });
    child.stderr?.on('data', (d) => { stderr += d; if (!opts.quiet) process.stderr.write(d); });
    if (opts.input) child.stdin?.end(opts.input); else child.stdin?.end();
    child.on('error', (e) => resolve({ code: 127, stdout, stderr: stderr + String(e) }));
    child.on('close', (code) => resolve({ code: code ?? 1, stdout, stderr }));
  });
}
export function which(bin: string): string | undefined {
  const r = spawnSync(process.platform === 'win32' ? 'where' : 'which', [bin], { encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim().split('\n')[0] : undefined;
}

export function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'app';
}

/** Locate a Chromium for Playwright: env override, the cloud image's bundled build, then Playwright's own cache. */
export function chromiumPath(): string | undefined {
  if (process.env.FARM_CHROMIUM) return process.env.FARM_CHROMIUM;
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  if (existsSync(base)) {
    for (const d of readdirSync(base).filter((n) => /^chromium-\d+$/.test(n)).sort().reverse()) {
      for (const rel of ['chrome-linux/chrome', 'chrome-mac/Chromium.app/Contents/MacOS/Chromium', 'chrome-mac-arm64/Chromium.app/Contents/MacOS/Chromium']) {
        const p = path.join(base, d, rel);
        if (existsSync(p)) return p;
      }
    }
  }
  const macChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  if (existsSync(macChrome)) return macChrome;
  return undefined; // let playwright-core resolve its own install (npx playwright install chromium)
}
