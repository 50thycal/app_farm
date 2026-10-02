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
