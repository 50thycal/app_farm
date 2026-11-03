/**
 * `web-game` apps: a self-contained offline web game (its own repo) shipped in a Capacitor shell.
 * This module checks the game repo out, builds its store flavour, and provides the static checks preflight
 * runs on the bundle and on the committed iOS project (Info.plist, privacy manifest, Xcode project).
 */
import { cpSync, existsSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import path from 'node:path';
import { appPaths, ensureDir, log, readJsonIf, run, walk, writeJson } from './util.ts';
import { Checks } from './state.ts';
import type { Spec, WebGameSource } from '../schemas/index.ts';

export function sourceOf(spec: Spec): WebGameSource {
  if (spec.app.kind !== 'web-game' || !spec.source) throw new Error('spec.app.kind is not "web-game" (or spec.source is missing)');
  return spec.source;
}

/** A public GitHub repo clones without a token; FARM_SOURCE_URL overrides (e.g. a local mirror). */
export function repoUrl(src: WebGameSource) {
  return process.env.FARM_SOURCE_URL || `https://github.com/${src.value}.git`;
}

const sh = (cmd: string, cwd: string, o: { quiet?: boolean; env?: Record<string, string>; timeoutSec?: number } = {}) =>
  run('bash', ['-c', o.timeoutSec ? `timeout ${o.timeoutSec} bash -c ${JSON.stringify(cmd)}` : cmd], { cwd, quiet: o.quiet, env: o.env });

export async function git(cwd: string, args: string[]) {
  const r = await run('git', args, { cwd, quiet: true });
  if (r.code !== 0) throw new Error(`git ${args.join(' ')}: ${(r.stderr || r.stdout).trim().slice(-500)}`);
  return r.stdout.trim();
}

export async function sourceState(slug: string): Promise<{ exists: boolean; sha?: string; dirty?: boolean }> {
  const dir = appPaths(slug).source;
  if (!existsSync(path.join(dir, '.git'))) return { exists: false };
  const sha = await git(dir, ['rev-parse', 'HEAD']).catch(() => undefined);
  const dirty = (await git(dir, ['status', '--porcelain']).catch(() => '')).length > 0;
  return { exists: true, sha, dirty };
}

/**
 * Check out spec.source at its ref into apps/<slug>/source (shallow). An existing checkout is fetched and moved
 * to the ref; a dirty one is left alone unless `force`. FARM_SOURCE_PINNED=1 keeps whatever is checked out
 * (CI checks the game out itself at the requested ref).
 */
export async function checkoutSource(slug: string, spec: Spec, o: { force?: boolean } = {}) {
  const src = sourceOf(spec);
  const dir = appPaths(slug).source;
  const st = await sourceState(slug);
  if (st.exists && process.env.FARM_SOURCE_PINNED === '1') {
    log.info(`source pinned at ${st.sha?.slice(0, 10)} (FARM_SOURCE_PINNED=1)`);
    return st.sha!;
  }
  if (st.exists && st.dirty && !o.force) throw new Error(`${dir} has local changes; commit them in the game repo or re-run with --force`);
  if (!st.exists) {
    rmSync(dir, { recursive: true, force: true });
    ensureDir(dir);
    await git(dir, ['init', '-q']);
    await git(dir, ['remote', 'add', 'origin', repoUrl(src)]);
  }
  log.info(`fetch ${src.value}@${src.ref}`);
  await git(dir, ['fetch', '-q', '--depth', '1', 'origin', src.ref]);
  await git(dir, ['checkout', '-q', '--force', '--detach', 'FETCH_HEAD']);
  const sha = await git(dir, ['rev-parse', 'HEAD']);
  log.ok(`source ${src.value}@${src.ref} → ${sha.slice(0, 10)}`);
  return sha;
}

export async function installSource(slug: string, spec: Spec) {
  const src = sourceOf(spec);
  const dir = appPaths(slug).source;
  log.info(`${src.installCmd} (game repo)`);
  const r = await sh(src.installCmd, dir, { quiet: true });
  if (r.code !== 0) throw new Error(`${src.installCmd} failed:\n${(r.stderr || r.stdout).slice(-2000)}`);
}

export function sourcePackage(slug: string): { scripts?: Record<string, string>; version?: string; dependencies?: Record<string, string>; devDependencies?: Record<string, string> } | undefined {
  return readJsonIf(path.join(appPaths(slug).source, 'package.json'));
}

/** The build the farm will actually run: buildCmd, or the declared fallback when buildCmd's npm script is missing. */
export function resolveBuild(slug: string, spec: Spec): { cmd: string; entry: string; usedFallback: boolean } {
  const src = sourceOf(spec);
  const script = src.buildCmd.match(/^npm run ([\w:.-]+)/)?.[1];
  const scripts = sourcePackage(slug)?.scripts ?? {};
  if (script && !scripts[script] && src.fallback) return { cmd: src.fallback.buildCmd, entry: src.fallback.entry, usedFallback: true };
  return { cmd: src.buildCmd, entry: src.entry, usedFallback: false };
}

export interface SourceReport {
  repo: string; ref: string; sha?: string; builtAt: string; buildCmd: string; entry: string; usedFallback: boolean; storeFlavor: boolean;
}

/** Build the store flavour and snapshot webDir to .farm-tmp/store-web (dist/ is shared with other builds). */
export async function buildStore(slug: string, spec: Spec): Promise<{ dir: string; entry: string; report: SourceReport }> {
  const src = sourceOf(spec);
  const P = appPaths(slug);
  if (!existsSync(path.join(P.source, 'package.json'))) throw new Error(`no game checkout at apps/${slug}/source — run: npm run farm -- run ${slug} scaffold`);
  if (!existsSync(path.join(P.source, 'node_modules'))) await installSource(slug, spec);
  const b = resolveBuild(slug, spec);
  if (b.usedFallback) log.warn(`"${src.buildCmd}" does not exist in ${src.value}@${src.ref} yet — using the fallback "${b.cmd}" (${b.entry}); preflight will fail until the store flavour exists`);
  log.info(`${b.cmd} (game repo)`);
  const r = await sh(b.cmd, P.source, { quiet: true });
  if (r.code !== 0) throw new Error(`${b.cmd} failed:\n${(r.stderr || r.stdout).slice(-3000)}`);
  const web = path.join(P.source, src.webDir);
  if (!existsSync(path.join(web, b.entry))) throw new Error(`${b.cmd} did not produce ${src.webDir}/${b.entry}`);
  rmSync(P.storeWeb, { recursive: true, force: true });
  ensureDir(path.dirname(P.storeWeb));
  cpSync(web, P.storeWeb, { recursive: true });
  const report: SourceReport = {
    repo: src.value, ref: src.ref, sha: (await sourceState(slug)).sha, builtAt: new Date().toISOString(),
    buildCmd: b.cmd, entry: b.entry, usedFallback: b.usedFallback, storeFlavor: hasStoreFlavor(readFileSync(path.join(web, b.entry), 'utf8')),
  };
  writeJson(path.join(P.reports, 'source.json'), report);
  log.ok(`store bundle → apps/${slug}/.farm-tmp/store-web (${report.storeFlavor ? 'store flavour' : 'NOT the store flavour'}, ${report.sha?.slice(0, 10)})`);
  return { dir: P.storeWeb, entry: b.entry, report };
}

export function readSourceReport(slug: string): SourceReport | undefined {
  return readJsonIf(path.join(appPaths(slug).reports, 'source.json'));
}

/** The last store bundle if `skipBuild` and it exists, else a fresh build. */
export async function storeBundle(slug: string, spec: Spec, o: { skipBuild?: boolean } = {}) {
  const P = appPaths(slug);
  const rep = readSourceReport(slug);
  if (o.skipBuild && rep && existsSync(path.join(P.storeWeb, rep.entry))) return { dir: P.storeWeb, entry: rep.entry, report: rep };
  return buildStore(slug, spec);
}

// ------------------------------------------------------------------ static checks

/** `<meta name="app-flavor" content="store">` in the entry page (attribute order free). */
export function hasStoreFlavor(html: string) {
  return [...html.matchAll(/<meta\b[^>]*>/gi)].some((m) => /\bname\s*=\s*["']app-flavor["']/i.test(m[0]) && /\bcontent\s*=\s*["']store["']/i.test(m[0]));
}

/** XML namespace identifiers: written into SVG/XHTML markup, never fetched. Exact matches only. */
export const NAMESPACE_URLS = new Set([
  'http://www.w3.org/2000/svg', 'http://www.w3.org/1999/xlink', 'http://www.w3.org/1999/xhtml',
  'http://www.w3.org/XML/1998/namespace', 'http://www.w3.org/1998/Math/MathML', 'http://www.w3.org/2000/xmlns/',
]);
const URL_RE = /\b(?:https?|wss?):\/\/[^\s"'`)<>\\,;{}]+/gi;
/** Legal comments a minifier keeps (`/*! … *\/`, `@license`, `@preserve`) and source-map pointers. Their URLs are not code. */
const LEGAL_COMMENT_RE = /\/\*(?:!|\*?\s*@(?:license|preserve))[\s\S]*?\*\//g;
const SOURCEMAP_RE = /\/\/[#@] sourceMappingURL=\S+/g;

export function stripLegalComments(code: string) {
  return code.replace(LEGAL_COMMENT_RE, ' ').replace(SOURCEMAP_RE, ' ');
}

/**
 * The store bundle must be self-contained: no remote hosts in code or markup, no backend endpoints, no
 * network channels, nothing from the playtest tooling. `allowUrls` = exact URLs that may appear as links
 * (the app's own privacy/terms/support pages, opened outside the app).
 */
export function scanBundle(dir: string, o: { allowUrls?: string[]; forbid?: string[] } = {}): Checks {
  const c = new Checks();
  const allow = new Set(o.allowUrls ?? []);
  const files = walk(dir, (f) => /\.(m?js|css|html?|json|svg|webmanifest|txt|xml)$/i.test(f), ['node_modules', '.git']);
  const code = files.filter((f) => /\.(m?js|css|html?|svg)$/i.test(f));
  const data = files.filter((f) => !code.includes(f));
  const rel = (f: string) => path.relative(dir, f);
  const remote: string[] = [];
  const links = new Set<string>();
  const namespaces = new Set<string>();
  const endpoints: string[] = [];
  const channels: string[] = [];
  let xhr = 0;
  let fetches = 0;
  for (const f of code) {
    const text = stripLegalComments(readFileSync(f, 'utf8'));
    for (const m of text.matchAll(URL_RE)) {
      const u = m[0].replace(/[.\]]+$/, '');
      if (NAMESPACE_URLS.has(u)) namespaces.add(u);
      else if (allow.has(u)) links.add(u);
      else remote.push(`${rel(f)}: ${u.slice(0, 120)}`);
    }
    for (const m of text.matchAll(/["'`](\/api\/[\w./-]*)/g)) endpoints.push(`${rel(f)}: ${m[1]}`);
    for (const m of text.matchAll(/\bnew\s+(WebSocket|EventSource)\s*\(|navigator\.sendBeacon\s*\(/g)) channels.push(`${rel(f)}: ${m[0]}`);
    xhr += (text.match(/\bXMLHttpRequest\b/g) ?? []).length;
    fetches += (text.match(/\bfetch\s*\(/g) ?? []).length;
  }
  c.expect(remote.length === 0, 'bundle.remote-urls', `No remote URLs in code/markup (${files.length} files scanned)`,
    `Remote URLs in the store bundle (a store build must load nothing remote): ${[...new Set(remote)].slice(0, 6).join(' · ')}`, '4.2 / 2.5.2');
  if (namespaces.size) c.pass('bundle.namespaces', `Allowed: XML namespace identifiers (${[...namespaces].join(', ')})`);
  if (links.size) c.pass('bundle.own-links', `Allowed: the app's own legal pages as links (${[...links].join(', ')})`, '5.1.1(i)');
  c.expect(endpoints.length === 0, 'bundle.api', 'No backend endpoints (/api/…)', `Backend endpoints in the store bundle: ${[...new Set(endpoints)].slice(0, 5).join(' · ')}`, '5.1.2');
  c.expect(channels.length === 0, 'bundle.channels', 'No WebSocket / EventSource / sendBeacon', `Network channels in the store bundle: ${channels.slice(0, 5).join(' · ')}`, '5.1.2');
  if (xhr) c.warn('bundle.xhr', `XMLHttpRequest referenced ${xhr}× — confirm it only loads bundled files`);
  if (fetches) c.pass('bundle.fetch', `${fetches} fetch() call(s), none to a remote host or /api/ (runtime requests are checked by the playtest)`);
  for (const s of o.forbid ?? []) {
    const hit = files.find((f) => readFileSync(f, 'utf8').includes(s));
    c.expect(!hit, `bundle.forbid.${s.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase()}`, `"${s}" absent`, `"${s}" is in the store bundle (${hit ? rel(hit) : ''}) — playtest/dev tooling must not ship`, '2.3.1 / 5.1.2');
  }
  const dataUrls = new Set<string>();
  for (const f of data) for (const m of readFileSync(f, 'utf8').matchAll(URL_RE)) if (!NAMESPACE_URLS.has(m[0]) && !allow.has(m[0])) dataUrls.add(`${rel(f)}: ${m[0].replace(/^(\w+:\/\/[^/]+).*/, '$1')}`);
  if (dataUrls.size) c.warn('bundle.data-urls', `URLs inside data files (fine as attribution text; never fetch or open them): ${[...dataUrls].slice(0, 4).join(' · ')}`);
  return c;
}

// ------------------------------------------------------------------ iOS project

/** Minimal XML property-list parser (dict, array, string, integer, real, true, false, date, data). */
export function parsePlist(xml: string): any {
  const body = xml.replace(/<!--[\s\S]*?-->/g, '').replace(/<\?[\s\S]*?\?>/g, '').replace(/<!DOCTYPE[^>]*>/gi, '');
  const tokens = [...body.matchAll(/<(\/?)(\w+)(?:\s[^>]*?)?(\s*\/)?>|([^<]+)/g)];
  let i = 0;
  const skipWs = () => { while (i < tokens.length && tokens[i][4] !== undefined && !tokens[i][4].trim()) i++; };
  const unesc = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
  const text = (tag: string) => {
    let t = '';
    while (i < tokens.length && !(tokens[i][1] === '/' && tokens[i][2] === tag)) { t += tokens[i][4] ?? ''; i++; }
    i++;
    return unesc(t);
  };
  const value = (): any => {
    skipWs();
    const [, close, tag, selfClose] = tokens[i++];
    if (close) throw new Error(`plist: unexpected </${tag}>`);
    if (selfClose) return tag === 'true' ? true : tag === 'false' ? false : tag === 'dict' ? {} : tag === 'array' ? [] : '';
    switch (tag) {
      case 'dict': {
        const o: Record<string, any> = {};
        for (;;) {
          skipWs();
          if (tokens[i][1] === '/' && tokens[i][2] === 'dict') { i++; return o; }
          if (tokens[i][2] !== 'key') throw new Error(`plist: expected <key>, got <${tokens[i][2]}>`);
          i++;
          const k = text('key');
          o[k] = value();
        }
      }
      case 'array': {
        const a: any[] = [];
        for (;;) {
          skipWs();
          if (tokens[i][1] === '/' && tokens[i][2] === 'array') { i++; return a; }
          a.push(value());
        }
      }
      case 'string': case 'date': case 'data': return text(tag);
      case 'integer': return parseInt(text(tag), 10);
      case 'real': return parseFloat(text(tag));
      case 'true': case 'false': text(tag); return tag === 'true';
      default: throw new Error(`plist: unsupported <${tag}>`);
    }
  };
  while (i < tokens.length && tokens[i][2] !== 'plist') i++;
  i++;
  return value();
}

export function readPlist(file: string) {
  return existsSync(file) ? parsePlist(readFileSync(file, 'utf8')) : undefined;
}

/** All values of a build setting in project.pbxproj (one per configuration). */
export function pbxSetting(pbx: string, key: string): string[] {
  return [...pbx.matchAll(new RegExp(`\\b${key} = ("?)([^;\\n]*?)\\1;`, 'g'))].map((m) => m[2]);
}

export function listFiles(dir: string, re: RegExp): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const n of readdirSync(dir)) {
    const p = path.join(dir, n);
    if (statSync(p).isDirectory()) { if (!/^(Pods|build|DerivedData|public)$/.test(n)) out.push(...listFiles(p, re)); }
    else if (re.test(n)) out.push(p);
  }
  return out;
}
