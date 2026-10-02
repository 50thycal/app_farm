/**
 * Apple review preflight — every automatable check we know App Review (and App Store Connect's
 * upload validation) applies. FAIL = would be rejected or refused at upload. WARN = judgment call.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { appPaths, log, newestMtime, readJson, readJsonIf, run, walk, which, writeJson, writeText } from '../lib/util.ts';
import { Checks, loadConfig, loadPipeline, validateFile } from '../lib/state.ts';
import { DEVICES, PLACEHOLDER_RE, PREVIEW, SCREENSHOTS, type DeviceId } from '../lib/apple.ts';
import { specPolicyChecks } from './policy.ts';
import { listingChecks, appPrivacyJson } from './listing.ts';
import { PERMISSION_PLIST } from './scaffold.ts';

/** Native modules → Info.plist purpose strings they require when linked. */
const PACKAGE_PLIST: Record<string, string[]> = {
  'expo-camera': ['NSCameraUsageDescription'],
  'expo-image-picker': ['NSPhotoLibraryUsageDescription'],
  'expo-media-library': ['NSPhotoLibraryUsageDescription'],
  'expo-location': ['NSLocationWhenInUseUsageDescription'],
  'expo-contacts': ['NSContactsUsageDescription'],
  'expo-calendar': ['NSCalendarsUsageDescription'],
  'expo-av': ['NSMicrophoneUsageDescription'],
  'expo-audio': ['NSMicrophoneUsageDescription'],
  'expo-tracking-transparency': ['NSUserTrackingUsageDescription'],
  'expo-local-authentication': ['NSFaceIDUsageDescription'],
  'expo-sensors': ['NSMotionUsageDescription'],
  'expo-speech-recognition': ['NSSpeechRecognitionUsageDescription', 'NSMicrophoneUsageDescription'],
};
const GENERIC_PURPOSE = /\$\(PRODUCT_NAME\)|^allow .{0,40} to access your \w+\.?$|^(this app|we) (needs?|requires?)/i;

async function ffprobe(file: string) {
  const r = await run('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', file], { quiet: true });
  return r.code === 0 ? JSON.parse(r.stdout) : undefined;
}

export async function preflight(slug: string, opts: { fast?: boolean } = {}) {
  const P = appPaths(slug);
  const c = new Checks();
  const cfg = loadConfig();
  const pl = loadPipeline(slug);

  // ------------------------------------------------------------ A. inputs
  const spec = validateFile('spec', P.spec);
  const listing = validateFile('listing', P.listing);
  const shots = validateFile('shots', P.shots);
  const journeys = validateFile('journeys', P.journeys);
  for (const [n, v] of [['spec', spec], ['listing', listing], ['shots', shots], ['journeys', journeys]] as const)
    c.expect(v.ok, `input.${n}`, `${n} valid`, v.ok ? '' : `${n} invalid: ${v.errors.slice(0, 5).join('; ')}`);
  if (!spec.ok) return finish(slug, c);
  const S = spec.data;
  c.merge(specPolicyChecks(S));

  // ------------------------------------------------------------ B. app config
  if (!existsSync(P.appJson)) { c.fail('config.app-json', 'app/app.json missing — run scaffold'); return finish(slug, c); }
  const pkg = readJson(path.join(P.app, 'package.json'));
  const deps = { ...pkg.dependencies, ...pkg.devDependencies } as Record<string, string>;
  let expo: any = readJson(P.appJson).expo;
  if (!opts.fast) {
    const r = await run('npx', ['expo', 'config', '--json', '--type', 'introspect'], { cwd: P.app, quiet: true, env: { EXPO_OFFLINE: '1', CI: '1' } });
    if (r.code === 0) expo = JSON.parse(r.stdout.slice(r.stdout.indexOf('{')));
    else c.fail('config.introspect', `expo config failed: ${r.stderr.slice(-300)}`);
  }
  const ios = expo.ios ?? {};
  const plist = ios.infoPlist ?? {};
  c.expect(ios.bundleIdentifier === S.app.bundleId, 'config.bundle-id', `bundleIdentifier ${ios.bundleIdentifier}`, `bundleIdentifier "${ios.bundleIdentifier}" ≠ spec "${S.app.bundleId}"`);
  c.expect(!/placeholder|example|com\.yourcompany/i.test(ios.bundleIdentifier ?? ''), 'config.bundle-id.real', 'bundle id is real', 'bundle id is a placeholder');
  c.expect(expo.version === S.app.version, 'config.version', `version ${expo.version}`, `version ${expo.version} ≠ spec ${S.app.version}`);
  c.expect(expo.name === S.app.name, 'config.name', `display name "${expo.name}"`, `app name "${expo.name}" ≠ spec "${S.app.name}"`, undefined, 'warn');
  c.expect((expo.name ?? '').length <= 30, 'config.name.len', 'home-screen name ≤ 30', 'name too long');
  const exempt = plist.ITSAppUsesNonExemptEncryption === false || ios.config?.usesNonExemptEncryption === false;
  c.expect(exempt, 'config.encryption', 'Export compliance declared (ITSAppUsesNonExemptEncryption=false)',
    'Set ios.config.usesNonExemptEncryption=false (or document real encryption) — otherwise every build blocks on export compliance', 'Export compliance');
  c.expect(ios.supportsTablet === S.app.supportsTablet, 'config.tablet', `supportsTablet=${ios.supportsTablet}`, `supportsTablet=${ios.supportsTablet} but spec says ${S.app.supportsTablet}`);
  c.expect(!!ios.privacyManifests || existsSync(path.join(P.app, 'PrivacyInfo.xcprivacy')), 'config.privacy-manifest', 'Privacy manifest configured',
    'No privacy manifest (ios.privacyManifests) — required-reason APIs must be declared', 'Privacy manifest (ITMS-91053)');
  c.expect(!!expo.scheme, 'config.scheme', `scheme ${expo.scheme}`, 'No URL scheme — needed for deep links/demo mode');
  if (plist.NSAppTransportSecurity?.NSAllowsArbitraryLoads) c.warn('config.ats', 'NSAllowsArbitraryLoads=true — justify or remove', '2.5 / ATS');
  if (plist.UIBackgroundModes?.length) c.warn('config.background-modes', `UIBackgroundModes: ${plist.UIBackgroundModes.join(', ')} — each must be used and justified in review notes`, '2.5.4');

  const required = new Set<string>();
  for (const p of S.permissions) for (const k of PERMISSION_PLIST[p.key] ?? []) required.add(k);
  for (const [dep, keys] of Object.entries(PACKAGE_PLIST)) if (deps[dep]) keys.forEach((k) => required.add(k));
  for (const k of required) {
    const v = plist[k];
    if (!v) c.fail(`config.plist.${k}`, `${k} missing — the app will crash when it requests this permission`, '5.1.1(ii)');
    else c.expect(!GENERIC_PURPOSE.test(v) && v.length >= 25, `config.plist.${k}`, `${k} is specific`, `${k} is generic ("${v}") — explain the exact feature and benefit`, '5.1.1(ii)');
  }
  for (const k of Object.keys(plist).filter((k) => /UsageDescription$/.test(k) && !required.has(k)))
    if (GENERIC_PURPOSE.test(String(plist[k]))) c.warn(`config.plist.${k}`, `${k} is generic ("${plist[k]}")`, '5.1.1(ii)');

  if (deps['react-native-webview']) c.warn('code.webview', 'react-native-webview is a dependency — apps that are mostly web views are rejected', '4.2 / 4.2.2');

  // ------------------------------------------------------------ C. icon
  for (const [id, f] of [['store', P.iconPng], ['app', path.join(P.app, 'assets', 'images', 'icon.png')]] as const) {
    if (!existsSync(f)) { c.fail(`icon.${id}`, `${path.relative(P.dir, f)} missing`); continue; }
    const m = await sharp(f).metadata();
    c.expect(m.width === 1024 && m.height === 1024, `icon.${id}.size`, `${id} icon 1024²`, `${id} icon is ${m.width}×${m.height} (need 1024×1024)`);
    c.expect(!m.hasAlpha, `icon.${id}.alpha`, `${id} icon opaque`, `${id} icon has an alpha channel — App Store Connect rejects it`, 'ITMS-90717');
  }

  // ------------------------------------------------------------ D. code scan
  const src = walk(P.app, (f) => /\.(tsx?|jsx?)$/.test(f) && !f.includes(`${path.sep}.maestro${path.sep}`) && !f.includes(`${path.sep}e2e${path.sep}`));
  const code = src.map((f) => ({ f, text: readFileSync(f, 'utf8') }));
  const hits: string[] = [];
  for (const { f, text } of code)
    text.split('\n').forEach((line, i) => { if (PLACEHOLDER_RE.test(line)) hits.push(`${path.relative(P.app, f)}:${i + 1} ${line.trim().slice(0, 80)}`); });
  const hard = hits.filter((h) => /FARM_PLACEHOLDER|lorem|dolor sit/i.test(h));
  c.expect(hard.length === 0, 'code.placeholder', 'No placeholder content', `Placeholder content: ${hard.slice(0, 5).join(' · ')}`, '2.1 / 2.3.3');
  const soft = hits.filter((h) => !hard.includes(h));
  if (soft.length) c.warn('code.todo', `${soft.length} TODO/FIXME/example markers: ${soft.slice(0, 4).join(' · ')}`);
  const all = code.map((x) => x.text).join('\n');
  if (/seedDemoData\(\): Promise<void> \{\}/.test(all)) c.warn('code.demo-seed', 'seedDemoData() is empty — screenshots/review will show an empty app');
  if (/['"`>][^'"`<\n]*\b(Google Play|Play Store)\b/.test(all)) c.fail('code.other-platform', 'UI text mentions Google Play', '2.3.10');
  for (const s of S.screens) c.expect(existsSync(path.join(P.app, s.file)), `code.screen.${s.id}`, `${s.file} exists`, `Screen ${s.id} expected at app/${s.file}`);
  c.expect(/privacyUrl/.test(all), 'code.privacy-link', 'In-app privacy policy link', 'No in-app link to the privacy policy', '5.1.1(i)');
  const accounts = S.accounts.required || S.accounts.methods.some((m) => m !== 'anonymous');
  if (accounts) c.expect(/delete-account/.test(all), 'code.account-deletion', 'Account deletion UI present', 'No in-app account deletion (testID "delete-account")', '5.1.1(v)');
  if (S.accounts.methods.some((m) => m === 'google' || m === 'facebook'))
    c.expect(!!deps['expo-apple-authentication'], 'code.siwa', 'Sign in with Apple linked', 'Third-party login without Sign in with Apple', '4.8');
  if (S.monetization.model === 'freemium-iap' || S.monetization.model === 'subscription') {
    c.expect(!!(deps['react-native-iap'] || deps['expo-iap'] || deps['react-native-purchases']), 'code.iap', 'StoreKit IAP library present', 'Digital goods must use In-App Purchase', '3.1.1');
    c.expect(/restore/i.test(all), 'code.restore', 'Restore Purchases present', 'No Restore Purchases UI', '3.1.1');
    if (/stripe|paypal|checkout\.session|buy on (our|the) web/i.test(all)) c.fail('code.external-payment', 'External payment references for digital goods', '3.1.1 / 3.1.3');
  }
  if (S.privacy.tracking) c.expect(!!deps['expo-tracking-transparency'], 'code.att', 'ATT linked', 'Tracking without App Tracking Transparency', '5.1.2');

  if (!opts.fast) {
    const tsc = await run('npx', ['tsc', '--noEmit'], { cwd: P.app, quiet: true });
    c.expect(tsc.code === 0, 'code.typecheck', 'TypeScript clean', `tsc errors:\n${tsc.stdout.split('\n').slice(0, 8).join(' | ')}`);
    const exp = await run('npx', ['expo', 'export', '-p', 'ios', '--output-dir', 'dist-ios'], { cwd: P.app, quiet: true, env: { EXPO_OFFLINE: '1', CI: '1' } });
    c.expect(exp.code === 0, 'code.ios-bundle', 'iOS JS bundle builds (Hermes)', `iOS bundle failed: ${(exp.stderr || exp.stdout).slice(-400)}`);
  }

  // ------------------------------------------------------------ E. playtest freshness
  const pt = readJsonIf(path.join(P.reports, 'playtest.json'));
  if (!pt) c.fail('playtest.missing', 'No playtest report — run: farm run <slug> playtest');
  else {
    c.expect(pt.ok, 'playtest.ok', 'Playtest passed', `Playtest has ${pt.checks.filter((x: any) => x.level === 'fail').length} failure(s)`, '2.1');
    const srcNewest = newestMtime(src);
    c.expect(Date.parse(pt.at) >= srcNewest - 1000, 'playtest.fresh', 'Playtest is newer than the code', 'Code changed after the last playtest — re-run it');
  }

  // ------------------------------------------------------------ F. listing
  if (listing.ok) c.merge(listingChecks(listing.data, S));

  // ------------------------------------------------------------ G. screenshots + preview
  const devices: DeviceId[] = S.app.supportsTablet ? ['iphone-6.9', 'ipad-13'] : ['iphone-6.9'];
  for (const dev of devices) {
    const dir = path.join(P.screenshots, dev);
    const files = existsSync(dir) ? readdirSync(dir).filter((f) => /\.(png|jpe?g)$/i.test(f)).sort() : [];
    c.expect(files.length >= SCREENSHOTS.min && files.length <= SCREENSHOTS.max, `shots.${dev}.count`, `${dev}: ${files.length} screenshots`,
      `${dev}: ${files.length} screenshots (need ${SCREENSHOTS.min}–${SCREENSHOTS.max})`);
    if (files.length && files.length < SCREENSHOTS.recommendedMin) c.warn(`shots.${dev}.few`, `Only ${files.length} screenshots — 3+ convert better`);
    for (const f of files) {
      const m = await sharp(path.join(dir, f)).metadata();
      const okSize = DEVICES[dev].accepted.some(([w, h]) => (m.width === w && m.height === h) || (m.width === h && m.height === w));
      c.expect(okSize, `shots.${dev}.${f}.size`, `${f} ${m.width}×${m.height}`, `${f} is ${m.width}×${m.height}; accepted: ${DEVICES[dev].accepted.map((a) => a.join('×')).join(', ')}`);
      c.expect(!m.hasAlpha, `shots.${dev}.${f}.alpha`, `${f} opaque`, `${f} has alpha`);
    }
    const raw = existsSync(path.join(P.rawNative)) && readdirSync(P.rawNative).some((f) => f.endsWith('.png'));
    if (!raw) c.warn(`shots.${dev}.source`, 'Screenshots were captured from the web build. Recapture on the iOS Simulator before submitting (farm-native-qa workflow or mac/native-qa.sh) so they show true native rendering', '2.3.3');
  }
  const prev = path.join(P.previews, 'iphone-6.9', 'preview.mp4');
  if (!existsSync(prev)) c.warn('preview.missing', 'No app preview video (optional, but improves conversion)');
  else if (!which('ffprobe')) c.warn('preview.ffprobe', 'ffprobe missing; cannot validate preview');
  else {
    const info = await ffprobe(prev);
    const v = info?.streams?.find((s: any) => s.codec_type === 'video');
    const a = info?.streams?.find((s: any) => s.codec_type === 'audio');
    const dur = Number(info?.format?.duration ?? 0);
    const [num, den] = String(v?.r_frame_rate ?? '0/1').split('/').map(Number);
    const [pw, ph] = DEVICES['iphone-6.9'].preview;
    c.expect(dur >= PREVIEW.minSec && dur <= PREVIEW.maxSec, 'preview.duration', `preview ${dur.toFixed(1)}s`, `preview is ${dur.toFixed(1)}s (15–30s)`);
    c.expect(v?.width === pw && v?.height === ph, 'preview.size', `preview ${v?.width}×${v?.height}`, `preview ${v?.width}×${v?.height} (need ${pw}×${ph})`);
    c.expect(num / den <= 30.01, 'preview.fps', `preview ${(num / den).toFixed(0)} fps`, 'preview > 30 fps');
    c.expect(v?.codec_name === 'h264', 'preview.codec', 'preview H.264', `codec ${v?.codec_name}`);
    c.expect(!!a, 'preview.audio', 'preview has audio track', 'preview has no audio track (App Store Connect may reject it)', undefined, 'warn');
    c.expect(statSync(prev).size < PREVIEW.maxBytes, 'preview.bytes', 'preview < 500MB', 'preview too large');
  }

  // ------------------------------------------------------------ H. privacy label + site
  const ap = readJsonIf(P.appPrivacy);
  c.expect(!!ap && JSON.stringify(ap) === JSON.stringify(appPrivacyJson(S)), 'privacy.label', 'App Privacy answers match spec',
    'store/app_privacy.json missing or stale — run: farm run <slug> listing-export', '5.1.2');
  for (const f of ['privacy.html', 'terms.html', 'support.html', 'index.html'])
    c.expect(existsSync(path.join(P.site, f)), `site.${f}`, `site/${f}`, `site/${f} missing — run: farm run <slug> legal`);
  if (/example|your-domain|TODO/i.test(cfg.legal.baseUrl) || !cfg.legal.baseUrl.startsWith('https://'))
    c.fail('site.base-url', `farm.config.json legal.baseUrl "${cfg.legal.baseUrl}" is not a real https URL`);

  // ------------------------------------------------------------ I. release readiness (non-blocking for local gate)
  for (const k of ['legalName', 'firstName', 'lastName', 'email', 'phone'] as const)
    c.expect(!!cfg.owner[k], `owner.${k}`, `owner.${k} set`, `farm.config.json owner.${k} empty (needed for App Review contact)`, undefined, 'warn');
  c.expect(!!cfg.apple.teamId, 'apple.team', 'Apple Team ID set', 'farm.config.json apple.teamId empty', undefined, 'warn');
  c.expect(!!pl.release.ascAppId, 'release.asc-app', `App Store Connect app ${pl.release.ascAppId}`,
    'No App Store Connect app id yet — create the app record (docs/HUMAN_STEPS.md) then `farm set <slug> ascAppId <id>`', undefined, 'warn');

  return finish(slug, c);
}

function finish(slug: string, c: Checks) {
  const P = appPaths(slug);
  writeJson(path.join(P.reports, 'preflight.json'), { at: new Date().toISOString(), ok: c.ok, checks: c.list });
  writeText(path.join(P.reports, 'preflight.md'), c.toMarkdown(`Apple preflight — ${slug}`));
  for (const f of c.failed) log.err(`${f.id}: ${f.msg}${f.ref ? ` [${f.ref}]` : ''}`);
  for (const w of c.warned) log.warn(`${w.id}: ${w.msg}${w.ref ? ` [${w.ref}]` : ''}`);
  (c.ok ? log.ok : log.err)(`preflight: ${c.failed.length} fail, ${c.warned.length} warn → apps/${slug}/reports/preflight.md`);
  return c;
}
