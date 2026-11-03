import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stepsToMaestro } from './lib/maestro.ts';
import { specPolicyChecks } from './stages/policy.ts';
import { appPrivacyJson } from './stages/listing.ts';
import { Spec, Step, Listing } from './schemas/index.ts';
import { readFileSync } from 'node:fs';

const sample = Spec.parse(JSON.parse(readFileSync(new URL('../apps/sprout/spec.json', import.meta.url), 'utf8')));

test('sample spec passes policy', () => {
  assert.equal(specPolicyChecks(sample).failed.length, 0);
});

test('accounts without deletion fail 5.1.1(v); google login without SIWA fails 4.8', () => {
  const s = structuredClone(sample);
  s.accounts = { required: true, methods: ['email', 'google'], deletionInApp: false };
  const ids = specPolicyChecks(s).failed.map((c) => c.id);
  assert.ok(ids.includes('spec.account-deletion'));
  assert.ok(ids.includes('spec.siwa'));
});

test('vague permission strings fail', () => {
  const s = structuredClone(sample);
  s.permissions = [{ key: 'camera', reason: 'This app needs access to your camera.' }];
  assert.ok(specPolicyChecks(s).failed.some((c) => c.id === 'spec.permission.camera'));
});

test('maestro compile: demo deep link once, ids, text regex escaping', () => {
  const steps = [{ open: '/plants' }, { tap: { id: 'add' } }, { expect: { text: 'Due (today)' } }, { open: '/' }].map((s) => Step.parse(s));
  const y = stepsToMaestro(steps, { appId: 'com.x.y', scheme: 'xy', demo: true, name: 't' });
  assert.match(y, /openLink: "xy:\/\/plants\?farmDemo=1"/);
  assert.match(y, /openLink: "xy:\/\/"\n/);
  assert.match(y, /tapOn: \{ id: "add" \}/);
  assert.ok(y.includes('".*Due \\\\(today\\\\).*"'));
});

test('app privacy json: not collected', () => {
  assert.deepEqual(appPrivacyJson(sample), [{ data_protections: ['DATA_NOT_COLLECTED'] }]);
});

test('listing schema enforces limits', () => {
  const l = JSON.parse(readFileSync(new URL('../apps/sprout/store/listing.json', import.meta.url), 'utf8'));
  assert.ok(Listing.safeParse(l).success);
  assert.ok(!Listing.safeParse({ ...l, name: 'x'.repeat(31) }).success);
});

// ---------------------------------------------------------------- landscape + web-game
import { DEVICES, deviceSpec } from './lib/apple.ts';
import { hasStoreFlavor, parsePlist, pbxSetting, scanBundle } from './lib/webgame.ts';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

test('portrait device spec is unchanged; landscape is 2868×1320 with a 1920×886 preview', () => {
  assert.equal(deviceSpec('iphone-6.9', 'portrait'), DEVICES['iphone-6.9']);
  assert.equal(deviceSpec('iphone-6.9', 'default'), DEVICES['iphone-6.9']);
  const l = deviceSpec('iphone-6.9', 'landscape');
  assert.deepEqual(l.out, [2868, 1320]);
  assert.deepEqual(l.accepted, [[2868, 1320], [2796, 1290], [2736, 1260]]);
  assert.deepEqual(l.preview, [1920, 886]);
  assert.equal(l.displayType, DEVICES['iphone-6.9'].displayType);
  assert.throws(() => deviceSpec('ipad-13', 'landscape'));
});

test('web-game spec needs source; an Expo spec must not carry one', () => {
  const raw = JSON.parse(readFileSync(new URL('../apps/sprout/spec.json', import.meta.url), 'utf8'));
  const source = { type: 'repo', value: 'owner/game', ref: 'main' };
  const wg = Spec.parse({ ...raw, app: { ...raw.app, kind: 'web-game', orientation: 'landscape' }, source });
  assert.equal(wg.app.kind, 'web-game');
  assert.equal(wg.source?.buildCmd, 'npm run build:store');
  assert.equal(wg.source?.ios.scheme, 'App');
  assert.ok(!Spec.safeParse({ ...raw, app: { ...raw.app, kind: 'web-game' } }).success);
  assert.ok(!Spec.safeParse({ ...raw, source }).success);
  assert.equal(sample.app.kind, 'expo');
});

test('maestro refuses web-only steps', () => {
  assert.throws(() => stepsToMaestro([Step.parse({ tap: { css: '.x' } })], { appId: 'a.b.c', scheme: 'x', demo: false, name: 't' }));
  assert.throws(() => stepsToMaestro([Step.parse({ hook: 'play' })], { appId: 'a.b.c', scheme: 'x', demo: false, name: 't' }));
});

test('store flavour marker', () => {
  assert.ok(hasStoreFlavor('<head><meta content="store" name="app-flavor"></head>'));
  assert.ok(!hasStoreFlavor('<meta name="app-flavor" content="playtest">'));
});

test('bundle scan: namespaces, legal comments and own links pass; remote hosts, endpoints and forbidden strings fail', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'farm-scan-'));
  const own = 'https://legal.example.org/app/privacy';
  writeFileSync(path.join(dir, 'ok.js'), `/*! lib v1 | MIT https://github.com/x/y */const s="http://www.w3.org/2000/svg";a.href="${own}";fetch("./a/b.json");\n//# sourceMappingURL=ok.js.map`);
  writeFileSync(path.join(dir, 'credits.json'), '{"sourceUrl":"https://registry.npmjs.org/x"}');
  const clean = scanBundle(dir, { allowUrls: [own], forbid: ['Download log'] });
  assert.deepEqual(clean.failed, []);
  assert.ok(clean.warned.some((w) => w.id === 'bundle.data-urls'));
  writeFileSync(path.join(dir, 'bad.js'), 'fetch("/api/playlog",{method:"POST"});const u="https://cdn.example.net/x.js";new WebSocket(u);b("Download log")');
  const ids = scanBundle(dir, { allowUrls: [own], forbid: ['Download log'] }).failed.map((f) => f.id);
  assert.deepEqual(ids.sort(), ['bundle.api', 'bundle.channels', 'bundle.forbid.download-log', 'bundle.remote-urls']);
  writeFileSync(path.join(dir, 'bad.js'), 'throw new Error("see https://capacitorjs.com/");fetch("https://api.example.net/x")');
  const d = scanBundle(dir, { allowUrls: [own], declared: [{ url: 'https://capacitorjs.com/', why: 'error message text in @capacitor/core' }] });
  assert.deepEqual(d.failed.map((f) => f.id).sort(), ['bundle.fetch-remote', 'bundle.remote-urls']);
  assert.ok(d.list.some((x) => x.id === 'bundle.declared-url' && x.level === 'pass'));
});

test('plist + pbxproj readers', () => {
  const p = parsePlist(`<?xml version="1.0"?><!DOCTYPE plist><plist version="1.0"><dict>
    <key>UISupportedInterfaceOrientations</key><array><string>UIInterfaceOrientationLandscapeLeft</string><string>UIInterfaceOrientationLandscapeRight</string></array>
    <key>ITSAppUsesNonExemptEncryption</key><false/><key>N</key><integer>3</integer><key>E</key><string>a &amp; b</string><key>D</key><dict/></dict></plist>`);
  assert.deepEqual(p.UISupportedInterfaceOrientations, ['UIInterfaceOrientationLandscapeLeft', 'UIInterfaceOrientationLandscapeRight']);
  assert.equal(p.ITSAppUsesNonExemptEncryption, false);
  assert.equal(p.N, 3);
  assert.equal(p.E, 'a & b');
  assert.deepEqual(p.D, {});
  const pbx = 'PRODUCT_BUNDLE_IDENTIFIER = com.appfarm.x;\n TARGETED_DEVICE_FAMILY = "1,2";\n TARGETED_DEVICE_FAMILY = 1;';
  assert.deepEqual(pbxSetting(pbx, 'PRODUCT_BUNDLE_IDENTIFIER'), ['com.appfarm.x']);
  assert.deepEqual(pbxSetting(pbx, 'TARGETED_DEVICE_FAMILY'), ['1,2', '1']);
});
