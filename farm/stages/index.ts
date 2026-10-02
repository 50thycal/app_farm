/**
 * The pipeline. Each stage has an owner (agent | script | ci | human), a playbook for agents,
 * an optional deterministic `run`, and a `gate` that decides whether the stage is done.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { appPaths, log, run, walk } from '../lib/util.ts';
import { Checks, loadPipeline, validateFile } from '../lib/state.ts';
import { specPolicyChecks } from './policy.ts';
import { scaffold } from './scaffold.ts';
import { playtest } from './playtest.ts';
import { makeAssets } from './assets.ts';
import { buildSite } from './legal.ts';
import { preflight } from './preflight.ts';
import { exportFastlane, listingChecks, writeAppPrivacy } from './listing.ts';
import { writeMaestroFlows } from '../lib/maestro.ts';
import { exportWeb } from '../lib/web.ts';

export type Owner = 'agent' | 'script' | 'ci' | 'human';
export interface Stage {
  id: string;
  title: string;
  owner: Owner;
  /** Where it can run: cloud = this Linux session, mac = needs macOS/Xcode, ci = GitHub Actions. */
  where: ('cloud' | 'mac' | 'ci')[];
  playbook?: string;
  optional?: boolean;
  run?: (slug: string, o: RunOpts) => Promise<unknown>;
  gate: (slug: string, o: RunOpts) => Promise<Checks>;
}
export interface RunOpts { skipBuild?: boolean; force?: boolean; fast?: boolean }

const schemaGate = (name: 'brief' | 'spec' | 'journeys' | 'shots' | 'listing', file: (s: string) => string) => async (slug: string) => {
  const c = new Checks();
  const v = validateFile(name, file(slug));
  if (v.ok) c.pass(`${name}.schema`, `${name} valid`);
  else v.errors.forEach((e, i) => c.fail(`${name}.schema.${i}`, e));
  return c;
};

export const STAGES: Stage[] = [
  {
    id: 'intake', title: 'Intake: idea → brief', owner: 'agent', where: ['cloud', 'mac'], playbook: '01-intake.md',
    gate: schemaGate('brief', (s) => appPaths(s).brief),
  },
  {
    id: 'spec', title: 'Product spec + App Review policy design', owner: 'agent', where: ['cloud', 'mac'], playbook: '02-spec.md',
    gate: async (slug) => {
      const c = await schemaGate('spec', (s) => appPaths(s).spec)(slug);
      const v = validateFile('spec', appPaths(slug).spec);
      if (v.ok) {
        c.merge(specPolicyChecks(v.data));
        if (v.data.app.slug !== slug) c.fail('spec.slug', `spec.app.slug must be "${slug}"`);
      }
      c.expect(existsSync(appPaths(slug).specMd), 'spec.md', 'spec.md written', 'Write spec.md (human-readable PRD)');
      return c;
    },
  },
  {
    id: 'scaffold', title: 'Scaffold Expo app from spec', owner: 'script', where: ['cloud', 'mac'],
    run: (slug, o) => scaffold(slug, { force: o.force }),
    gate: async (slug) => {
      const P = appPaths(slug);
      const c = new Checks();
      c.expect(existsSync(path.join(P.app, 'node_modules')), 'scaffold.deps', 'dependencies installed', 'run npm install in app/');
      c.expect(existsSync(P.appJson) && existsSync(P.easJson), 'scaffold.config', 'app.json + eas.json', 'config missing');
      return c;
    },
  },
  {
    id: 'build', title: 'Build the app (features, demo data, journeys)', owner: 'agent', where: ['cloud', 'mac'], playbook: '03-build.md',
    gate: async (slug, o) => {
      const P = appPaths(slug);
      const c = await schemaGate('journeys', (s) => appPaths(s).journeys)(slug);
      const spec = validateFile('spec', P.spec);
      if (!spec.ok) return c.fail('spec', 'spec invalid');
      for (const s of spec.data.screens) c.expect(existsSync(path.join(P.app, s.file)), `screen.${s.id}`, `${s.file}`, `missing app/${s.file} for screen ${s.id}`);
      const src = walk(P.app, (f) => /\.(tsx?)$/.test(f)).map((f) => readFileSync(f, 'utf8')).join('\n');
      c.expect(!src.includes('FARM_PLACEHOLDER'), 'build.placeholder', 'starter placeholder replaced', 'FARM_PLACEHOLDER still present (replace the starter home screen)');
      c.expect(!/seedDemoData\(\): Promise<void> \{\}/.test(src), 'build.demo-seed', 'demo data seeded', 'Implement seedDemoData() in lib/farm/demo.ts');
      const j = validateFile('journeys', P.journeys);
      if (j.ok && spec.ok) c.expect(j.data.journeys.length >= spec.data.journeys.length, 'build.journeys', `${j.data.journeys.length} journeys`,
        `spec lists ${spec.data.journeys.length} journeys but e2e/journeys.json has ${j.data.journeys.length}`);
      const tsc = await run('npx', ['tsc', '--noEmit'], { cwd: P.app, quiet: true });
      c.expect(tsc.code === 0, 'build.typecheck', 'tsc clean', `tsc:\n${tsc.stdout.split('\n').slice(0, 15).join('\n')}`);
      if (!o.fast) {
        try { await exportWeb(P.app); c.pass('build.web-export', 'web export ok'); } catch (e) { c.fail('build.web-export', (e as Error).message.slice(0, 1500)); }
      }
      return c;
    },
  },
  {
    id: 'playtest', title: 'Automated playtest (journeys + crawler)', owner: 'script', where: ['cloud', 'mac'], playbook: '04-playtest-fix.md',
    run: (slug, o) => playtest(slug, { skipBuild: o.skipBuild }),
    gate: async (slug) => {
      const c = new Checks();
      const f = path.join(appPaths(slug).reports, 'playtest.json');
      if (!existsSync(f)) return c.fail('playtest.report', 'no report');
      const r = JSON.parse(readFileSync(f, 'utf8'));
      return c.merge(Object.assign(new Checks(), { list: r.checks }));
    },
  },
  {
    id: 'listing', title: 'Store listing copy, icon design, screenshot scenes', owner: 'agent', where: ['cloud', 'mac'], playbook: '05-listing.md',
    run: async (slug) => {
      const P = appPaths(slug);
      const spec = validateFile('spec', P.spec);
      const l = validateFile('listing', P.listing);
      const shots = validateFile('shots', P.shots);
      const j = validateFile('journeys', P.journeys);
      if (spec.ok) writeAppPrivacy(slug, spec.data);
      if (l.ok) exportFastlane(slug, l.data);
      if (spec.ok && j.ok) writeMaestroFlows(slug, spec.data.app.bundleId, spec.data.app.scheme, j.data.journeys,
        shots.ok ? shots.data.scenes : undefined, shots.ok ? shots.data.preview.steps : undefined);
    },
    gate: async (slug) => {
      const P = appPaths(slug);
      const c = await schemaGate('listing', (s) => appPaths(s).listing)(slug);
      c.merge(await schemaGate('shots', (s) => appPaths(s).shots)(slug));
      const l = validateFile('listing', P.listing);
      const spec = validateFile('spec', P.spec);
      if (l.ok && spec.ok) c.merge(listingChecks(l.data, spec.data));
      c.expect(existsSync(P.iconSvg), 'listing.icon-svg', 'store/icon.svg', 'Design store/icon.svg (1024×1024 viewBox, full-bleed, no transparency, no text)');
      return c;
    },
  },
  {
    id: 'assets', title: 'Render icon, screenshots, preview video', owner: 'script', where: ['cloud', 'mac'],
    run: (slug, o) => makeAssets(slug, { skipBuild: o.skipBuild }),
    gate: async (slug) => {
      const P = appPaths(slug);
      const c = new Checks();
      c.expect(existsSync(P.iconPng), 'assets.icon', 'icon-1024.png', 'icon missing');
      c.expect(existsSync(path.join(P.screenshots, 'iphone-6.9')), 'assets.shots', 'screenshots rendered', 'screenshots missing');
      c.expect(existsSync(path.join(P.previews, 'iphone-6.9', 'preview.mp4')), 'assets.preview', 'preview rendered', 'preview missing', undefined, 'warn');
      return c;
    },
  },
  {
    id: 'legal', title: 'Privacy policy, terms, support + marketing pages', owner: 'script', where: ['cloud', 'mac'],
    run: async (slug) => buildSite(slug),
    gate: async (slug) => {
      const c = new Checks();
      for (const f of ['index.html', 'privacy.html', 'terms.html', 'support.html'])
        c.expect(existsSync(path.join(appPaths(slug).site, f)), `legal.${f}`, f, `${f} missing`);
      return c;
    },
  },
  {
    id: 'preflight', title: 'Apple review preflight gate', owner: 'script', where: ['cloud', 'mac'], playbook: '06-preflight-fix.md',
    run: (slug, o) => preflight(slug, { fast: o.fast }),
    gate: async (slug) => {
      const f = path.join(appPaths(slug).reports, 'preflight.json');
      const c = new Checks();
      if (!existsSync(f)) return c.fail('preflight.report', 'no report');
      return c.merge(Object.assign(new Checks(), { list: JSON.parse(readFileSync(f, 'utf8')).checks }));
    },
  },
  {
    id: 'native-qa', title: 'Native simulator QA + native screenshots/preview (macOS)', owner: 'ci', where: ['ci', 'mac'], optional: true, playbook: '07-native-qa.md',
    gate: async (slug) => {
      const c = new Checks();
      const f = path.join(appPaths(slug).reports, 'native-qa.json');
      if (!existsSync(f)) return c.fail('native-qa.report', 'run the farm-native-qa workflow or mac/native-qa.sh');
      const r = JSON.parse(readFileSync(f, 'utf8'));
      return c.expect(r.ok, 'native-qa.ok', 'Maestro journeys passed on the iOS simulator', `native QA failed: ${r.summary ?? ''}`);
    },
  },
  {
    id: 'release', title: 'EAS build + upload to TestFlight', owner: 'ci', where: ['ci', 'mac'], playbook: '08-release.md',
    gate: async (slug) => {
      const pl = loadPipeline(slug);
      return new Checks().expect(!!pl.release.lastBuild, 'release.build', `build ${pl.release.lastBuild?.buildNumber} on TestFlight`, 'No TestFlight build recorded yet');
    },
  },
  {
    id: 'store', title: 'Push listing, screenshots, preview, age rating, review info to App Store Connect', owner: 'ci', where: ['ci', 'mac'], playbook: '08-release.md',
    gate: async (slug) => {
      const pl = loadPipeline(slug);
      return new Checks().expect(pl.stages.store?.status === 'done', 'store.pushed', 'listing pushed', 'Run the farm-asc workflow (action: listing), then `farm gate <slug> store --force`');
    },
  },
  {
    id: 'submit', title: 'Human sign-off → submit for App Review', owner: 'human', where: ['ci', 'mac'], playbook: '09-submit.md',
    gate: async (slug) => {
      const pl = loadPipeline(slug);
      return new Checks().expect(!!pl.release.submittedAt, 'submit.done', `submitted ${pl.release.submittedAt}`, 'Not submitted');
    },
  },
];

export const stageById = (id: string) => {
  const s = STAGES.find((x) => x.id === id);
  if (!s) throw new Error(`unknown stage "${id}". Stages: ${STAGES.map((x) => x.id).join(', ')}`);
  return s;
};

export function nextStage(slug: string): Stage | undefined {
  const pl = loadPipeline(slug);
  return STAGES.find((s) => !['done', 'skipped'].includes(pl.stages[s.id]?.status ?? 'pending') && !s.optional);
}

export function logChecks(c: Checks, verbose = false) {
  for (const f of c.failed) log.err(`${f.id}: ${f.msg}`);
  for (const w of c.warned) log.warn(`${w.id}: ${w.msg}`);
  if (verbose) for (const p of c.list.filter((x) => x.level === 'pass')) log.ok(`${p.id}: ${p.msg}`);
}
