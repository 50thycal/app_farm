/**
 * Preflight for `app.kind: "web-game"` — the ONE documented exception to AGENTS.md rule 4 ("never wrap a web
 * view as the app"). A self-contained offline game may ship its web bundle in a Capacitor shell; in exchange,
 * these checks replace the Expo config/code checks and must all pass:
 *   - the bundle is the store flavour and is self-contained (no remote URLs, endpoints or network channels;
 *     the playtest also watches runtime requests), with no playtest/dev tooling (spec.source.forbid)
 *   - native integration: Capacitor Preferences (storage that survives WKWebView eviction) and Haptics, the
 *     declared orientation locked in Info.plist, Game Center when the spec declares it
 *   - the shipped iOS project matches the spec: bundle id, version, device family, export compliance,
 *     privacy manifest, launch screen, opaque 1024 icon
 * Rationale and limits: AGENTS.md rule 4, apple/REVIEW_GUIDELINES_CHECKLIST.md (4.2), docs/RUNBOOK.md.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { appPaths, readJsonIf, walk } from '../lib/util.ts';
import { Checks } from '../lib/state.ts';
import { PLACEHOLDER_RE } from '../lib/apple.ts';
import { legalUrls } from './scaffold.ts';
import { listFiles, pbxSetting, readPlist, readSourceReport, scanBundle, sourceOf, sourcePackage, sourceState } from '../lib/webgame.ts';
import type { FarmConfig, Spec } from '../schemas/index.ts';

const GENERIC_PURPOSE = /\$\(PRODUCT_NAME\)|^allow .{0,40} to access your \w+\.?$|^(this app|we) (needs?|requires?)/i;
const IAP_PLUGINS = ['@capgo/native-purchases', '@revenuecat/purchases-capacitor', 'cordova-plugin-purchase', '@capacitor-community/in-app-purchases'];
const LANDSCAPE = ['UIInterfaceOrientationLandscapeLeft', 'UIInterfaceOrientationLandscapeRight'];

async function iconFingerprint(file: string) {
  return sharp(file).flatten({ background: '#000000' }).resize(16, 16, { fit: 'fill' }).removeAlpha().raw().toBuffer();
}

export async function webGamePreflight(slug: string, S: Spec, cfg: FarmConfig): Promise<Checks> {
  const c = new Checks();
  const P = appPaths(slug);
  const src = sourceOf(S);
  c.warn('code.webview-exception', 'Web-view shell (Capacitor) allowed only as app.kind "web-game" — AGENTS.md rule 4 exception. ' +
    'Residual Guideline 4.2 risk: keep the review notes explicit about the native features (offline, Game Center, haptics, native storage)', '4.2');

  // ------------------------------------------------------------ source + store bundle
  const st = await sourceState(slug);
  if (!st.exists) { c.fail('webgame.source', `no game checkout — run: npm run farm -- run ${slug} scaffold`); return c; }
  c.pass('webgame.source', `${src.value}@${src.ref} at ${st.sha?.slice(0, 10)}`);
  const rep = readSourceReport(slug);
  const bundleOk = !!rep && existsSync(path.join(P.storeWeb, rep.entry));
  if (!bundleOk) c.fail('webgame.bundle', `no store bundle — run: npm run farm -- run ${slug} playtest (or assets)`);
  else {
    c.expect(rep.sha === st.sha, 'webgame.bundle.fresh', 'store bundle built from the checked-out commit',
      `store bundle is from ${rep.sha?.slice(0, 10)} but the checkout is ${st.sha?.slice(0, 10)} — re-run playtest`);
    c.expect(!rep.usedFallback, 'webgame.store-build', `built with ${rep.buildCmd}`,
      `built with the fallback "${rep.buildCmd}" — ${src.buildCmd} does not exist in ${src.value}@${src.ref} yet`);
    c.expect(rep.storeFlavor, 'webgame.store-flavor', `${rep.entry} is the store flavour`,
      `${rep.entry} lacks <meta name="app-flavor" content="store"> — the store build must drop playtest notes, log upload and developer tools`, '2.3.1 / 5.1.2');
    const urls = legalUrls(cfg, slug);
    c.merge(scanBundle(P.storeWeb, { allowUrls: [urls.privacyUrl, urls.termsUrl, urls.supportUrl, urls.marketingUrl], forbid: src.forbid, declared: src.allowUrls }));

    const code = walk(P.storeWeb, (f) => /\.(m?js|html?)$/i.test(f)).map((f) => readFileSync(f, 'utf8')).join('\n');
    const hard = code.match(/FARM_PLACEHOLDER|lorem ipsum|dolor sit amet/i);
    c.expect(!hard, 'code.placeholder', 'No placeholder content', `Placeholder content in the bundle ("${hard?.[0]}")`, '2.1 / 2.3.3');
    if (/['"`>][^'"`<\n]*\b(Google Play|Play Store)\b/.test(code)) c.fail('code.other-platform', 'UI text mentions Google Play', '2.3.10');
    c.expect(code.includes(urls.privacyUrl), 'code.privacy-link', `In-app privacy policy link (${urls.privacyUrl})`,
      `The store bundle does not link ${urls.privacyUrl} — Settings must link the privacy policy`, '5.1.1(i)');
    if (PLACEHOLDER_RE.test(code.replace(/TODO|FIXME|XXX/g, ''))) c.warn('code.todo', 'Placeholder-like text in the bundle (example.com, test@test, …)');
    const iap = S.monetization.model === 'freemium-iap' || S.monetization.model === 'subscription';
    if (iap) {
      c.expect(/restore/i.test(code), 'code.restore', 'Restore Purchases present', 'No Restore Purchases in the store bundle', '3.1.1');
      if (/stripe|paypal|checkout\.session|buy on (our|the) web/i.test(code)) c.fail('code.external-payment', 'External payment references for digital goods', '3.1.1 / 3.1.3');
    }
  }

  // ------------------------------------------------------------ Capacitor shell
  const pkg = sourcePackage(slug) ?? {};
  const deps = { ...pkg.dependencies, ...pkg.devDependencies } as Record<string, string>;
  for (const [dep, why] of [
    ['@capacitor/core', 'the native shell'], ['@capacitor/ios', 'the iOS platform'],
    ['@capacitor/preferences', 'native storage — WKWebView localStorage can be evicted by iOS; progress must survive'],
    ['@capacitor/haptics', 'native haptics (a 4.2 native-value signal)'],
  ] as const) c.expect(!!deps[dep], `cap.dep.${dep.split('/')[1]}`, `${dep} ${deps[dep]}`, `${dep} missing — ${why}`, '4.2');
  if (S.monetization.model === 'freemium-iap' || S.monetization.model === 'subscription')
    c.expect(IAP_PLUGINS.some((d) => deps[d]), 'code.iap', `StoreKit plugin ${IAP_PLUGINS.find((d) => deps[d])}`, `Digital goods must use In-App Purchase (one of ${IAP_PLUGINS.join(', ')})`, '3.1.1');
  if (S.privacy.tracking) c.fail('code.att', 'Tracking is not supported for web-game apps (no ATT integration)', '5.1.2');
  c.expect(pkg.version === S.app.version, 'config.version', `version ${pkg.version} (MARKETING_VERSION)`,
    `game package.json version ${pkg.version} ≠ spec app.version ${S.app.version} — the release workflow uses package.json as MARKETING_VERSION`);

  const capFile = ['capacitor.config.ts', 'capacitor.config.json', 'capacitor.config.js'].map((f) => path.join(P.source, f)).find(existsSync);
  if (!capFile) c.fail('cap.config', `no capacitor.config.* in ${src.value}@${src.ref}`);
  else {
    const cap = readFileSync(capFile, 'utf8');
    const field = (k: string) => cap.match(new RegExp(`["']?${k}["']?\\s*:\\s*["'\`]([^"'\`]+)["'\`]`))?.[1];
    c.expect(field('appId') === S.app.bundleId, 'cap.app-id', `appId ${field('appId')}`, `capacitor appId "${field('appId')}" ≠ spec bundleId "${S.app.bundleId}"`);
    c.expect(field('appName') === S.app.name, 'cap.app-name', `appName ${field('appName')}`, `capacitor appName "${field('appName')}" ≠ "${S.app.name}"`, undefined, 'warn');
    c.expect(field('webDir') === src.webDir, 'cap.web-dir', `webDir ${field('webDir')}`, `capacitor webDir "${field('webDir')}" ≠ spec source.webDir "${src.webDir}"`);
    // server.url makes the shell load a live (remote) site instead of the bundled files.
    c.expect(!/\bserver\s*:\s*\{[^}]*\burl\s*:/s.test(cap), 'cap.server-url', 'No server.url (loads the bundled files)',
      'capacitor config sets server.url — the app would load remote content (4.2 / 2.5.2). Use it only in a local dev config', '4.2 / 2.5.2');
  }

  // ------------------------------------------------------------ Xcode project
  const proj = path.join(P.source, src.ios.project, 'project.pbxproj');
  const appDir = path.join(P.source, src.ios.appDir);
  if (!existsSync(proj)) { c.fail('ios.project', `${src.ios.project} missing in ${src.value}@${src.ref} — commit the Capacitor iOS project (npx cap add ios)`); return c; }
  const pbx = readFileSync(proj, 'utf8');
  const ids = [...new Set(pbxSetting(pbx, 'PRODUCT_BUNDLE_IDENTIFIER'))];
  c.expect(ids.length > 0 && ids.every((x) => x === S.app.bundleId), 'config.bundle-id', `PRODUCT_BUNDLE_IDENTIFIER ${ids.join(', ')}`,
    `PRODUCT_BUNDLE_IDENTIFIER ${ids.join(', ') || '(none)'} ≠ spec "${S.app.bundleId}"`);
  const fam = [...new Set(pbxSetting(pbx, 'TARGETED_DEVICE_FAMILY'))];
  const wantFam = S.app.supportsTablet ? '1,2' : '1';
  c.expect(fam.length > 0 && fam.every((f) => f.replace(/\s/g, '') === wantFam), 'config.tablet', `TARGETED_DEVICE_FAMILY ${fam.join(', ')}`,
    `TARGETED_DEVICE_FAMILY ${fam.join(', ') || '(unset)'} but spec supportsTablet=${S.app.supportsTablet} needs "${wantFam}" (iPad support means iPad screenshots + review)`, '2.4.1');

  const spm = path.join(P.source, 'ios', 'App', 'CapApp-SPM', 'Package.swift');
  const podfile = path.join(P.source, 'ios', 'App', 'Podfile');
  const plugins = existsSync(spm) ? readFileSync(spm, 'utf8') : existsSync(podfile) ? readFileSync(podfile, 'utf8') : '';
  if (!plugins) c.warn('cap.native-plugins', 'No ios/App/CapApp-SPM/Package.swift (or Podfile) — run npx cap sync ios and commit it');
  else {
    if (!existsSync(spm)) c.warn('cap.spm', 'CocoaPods project: farm-capacitor-release expects Swift Package Manager (no .xcworkspace)');
    for (const [mod, id] of [['CapacitorPreferences', 'preferences'], ['CapacitorHaptics', 'haptics']] as const)
      c.expect(plugins.includes(mod), `cap.native.${id}`, `${mod} linked in the iOS project`, `${mod} is not in ${existsSync(spm) ? 'CapApp-SPM/Package.swift' : 'Podfile'} — npx cap sync ios`, '4.2');
  }

  const plist = readPlist(path.join(appDir, 'Info.plist'));
  if (!plist) c.fail('config.info-plist', `${src.ios.appDir}/Info.plist missing`);
  else {
    const orients: string[] = plist.UISupportedInterfaceOrientations ?? [];
    if (S.app.orientation === 'landscape')
      c.expect(orients.length > 0 && orients.every((o) => LANDSCAPE.includes(o)), 'config.orientation', `Landscape lock: ${orients.join(', ')}`,
        `UISupportedInterfaceOrientations is [${orients.join(', ')}] — a landscape game must list only LandscapeLeft/Right`, '4.0 / HIG');
    else if (S.app.orientation === 'portrait')
      c.expect(orients.length > 0 && orients.every((o) => /Portrait/.test(o)), 'config.orientation', `Portrait lock: ${orients.join(', ')}`, `UISupportedInterfaceOrientations is [${orients.join(', ')}]`, '4.0 / HIG');
    c.expect(plist.ITSAppUsesNonExemptEncryption === false, 'config.encryption', 'Export compliance declared (ITSAppUsesNonExemptEncryption=false)',
      'Info.plist: set ITSAppUsesNonExemptEncryption = false (or document real encryption) — otherwise every build blocks on export compliance', 'Export compliance');
    c.expect(!!plist.UILaunchStoryboardName, 'config.launch-screen', `launch screen ${plist.UILaunchStoryboardName}`, 'No UILaunchStoryboardName — required for a full-screen modern iPhone app', '2.1');
    const display = plist.CFBundleDisplayName ?? plist.CFBundleName;
    c.expect(display === S.app.name, 'config.name', `display name "${display}"`, `home-screen name "${display}" ≠ spec "${S.app.name}"`, '2.3.8', 'warn');
    if (plist.NSAppTransportSecurity?.NSAllowsArbitraryLoads) c.warn('config.ats', 'NSAllowsArbitraryLoads=true — a self-contained game needs no network at all', '2.5 / ATS');
    if (plist.UIBackgroundModes?.length) c.warn('config.background-modes', `UIBackgroundModes: ${plist.UIBackgroundModes.join(', ')} — each must be used and justified`, '2.5.4');
    for (const k of Object.keys(plist).filter((k) => /UsageDescription$/.test(k)))
      c.expect(!GENERIC_PURPOSE.test(String(plist[k])) && String(plist[k]).length >= 25, `config.plist.${k}`, `${k} is specific`, `${k} is generic ("${plist[k]}")`, '5.1.1(ii)');
  }

  const manifest = readPlist(path.join(appDir, 'PrivacyInfo.xcprivacy'));
  if (!manifest) c.fail('config.privacy-manifest', `${src.ios.appDir}/PrivacyInfo.xcprivacy missing — required-reason APIs must be declared`, 'Privacy manifest (ITMS-91053)');
  else {
    c.expect(manifest.NSPrivacyTracking === S.privacy.tracking || (!S.privacy.tracking && manifest.NSPrivacyTracking === undefined), 'config.privacy-manifest.tracking',
      `NSPrivacyTracking ${manifest.NSPrivacyTracking ?? false}`, `NSPrivacyTracking ${manifest.NSPrivacyTracking} ≠ spec tracking ${S.privacy.tracking}`, '5.1.2');
    const apis: string[] = (manifest.NSPrivacyAccessedAPITypes ?? []).map((a: any) => a.NSPrivacyAccessedAPIType);
    if (deps['@capacitor/preferences']) c.expect(apis.includes('NSPrivacyAccessedAPICategoryUserDefaults'), 'config.privacy-manifest.userdefaults',
      'UserDefaults declared (Preferences)', 'Preferences stores in UserDefaults: declare NSPrivacyAccessedAPICategoryUserDefaults (CA92.1)', 'ITMS-91053', 'warn');
    const collected = manifest.NSPrivacyCollectedDataTypes ?? [];
    if (!S.privacy.collectsData) c.expect(collected.length === 0, 'config.privacy-manifest.collected', 'Manifest declares no collected data (matches the label)',
      `Manifest declares ${collected.length} collected data type(s) but spec says no data is collected`, '5.1.2');
  }

  // ------------------------------------------------------------ icon (the binary's icon is what the App Store shows)
  const icons = listFiles(path.join(appDir, 'Assets.xcassets', 'AppIcon.appiconset'), /\.png$/i);
  let big: string | undefined;
  for (const f of icons) { const m = await sharp(f).metadata(); if (m.width === 1024 && m.height === 1024) { big = f; break; } }
  if (!big) c.fail('icon.app', 'No 1024×1024 PNG in AppIcon.appiconset', 'ITMS-90704');
  else {
    const m = await sharp(big).metadata();
    c.expect(!m.hasAlpha, 'icon.app.alpha', 'app icon opaque', `${path.relative(P.source, big)} has an alpha channel — App Store Connect rejects it`, 'ITMS-90717');
    if (existsSync(P.iconPng)) {
      const [a, b] = await Promise.all([iconFingerprint(big), iconFingerprint(P.iconPng)]);
      let diff = 0;
      for (let i = 0; i < a.length; i++) diff += Math.abs(a[i] - b[i]);
      const mean = diff / a.length;
      c.expect(mean < 40, 'icon.match', `binary icon matches store/icon-1024.png (Δ ${mean.toFixed(1)})`,
        `binary icon differs from store/icon-1024.png (Δ ${mean.toFixed(1)}) — the marketing site and the App Store would show different icons`, undefined, 'warn');
    }
  }
  if (existsSync(P.iconPng)) {
    const m = await sharp(P.iconPng).metadata();
    c.expect(m.width === 1024 && m.height === 1024 && !m.hasAlpha, 'icon.store', 'store icon 1024² opaque', `store/icon-1024.png is ${m.width}×${m.height}${m.hasAlpha ? ' with alpha' : ''}`, 'ITMS-90717');
  } else c.fail('icon.store', 'store/icon-1024.png missing — run assets');

  // ------------------------------------------------------------ Game Center
  if (S.app.gameCenter) {
    const swift = listFiles(appDir, /\.swift$/).filter((f) => /import GameKit/.test(readFileSync(f, 'utf8')));
    c.expect(swift.length > 0, 'gamecenter.code', `GameKit used (${swift.map((f) => path.basename(f)).join(', ')})`, 'spec declares Game Center but no Swift file in the app imports GameKit');
    const ent = listFiles(appDir, /\.entitlements$/).find((f) => /com\.apple\.developer\.game-center/.test(readFileSync(f, 'utf8')));
    c.expect(!!ent, 'gamecenter.entitlement', `Game Center entitlement in ${ent ? path.basename(ent) : ''}`,
      'No .entitlements file with com.apple.developer.game-center — Game Center sign-in fails without it', undefined, 'warn');
    if (ent) c.expect(pbxSetting(pbx, 'CODE_SIGN_ENTITLEMENTS').length > 0, 'gamecenter.entitlement-linked', 'CODE_SIGN_ENTITLEMENTS set', 'The entitlements file is not referenced by CODE_SIGN_ENTITLEMENTS', undefined, 'warn');
  }

  // ------------------------------------------------------------ playtest freshness (the game moves in its own repo)
  const pt = readJsonIf(path.join(P.reports, 'playtest.json'));
  if (!pt) c.fail('playtest.missing', `No playtest report — run: npm run farm -- run ${slug} playtest`);
  else {
    c.expect(pt.ok, 'playtest.ok', 'Playtest passed', `Playtest has ${pt.checks.filter((x: any) => x.level === 'fail').length} failure(s)`, '2.1');
    c.expect(pt.source?.sha === st.sha, 'playtest.fresh', 'Playtest ran on the checked-out commit', `Playtest ran on ${pt.source?.sha?.slice(0, 10)}, checkout is ${st.sha?.slice(0, 10)} — re-run it`);
  }
  return c;
}
