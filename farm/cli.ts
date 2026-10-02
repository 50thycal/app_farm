#!/usr/bin/env -S npx tsx
/**
 * farm — idea → App Store pipeline CLI.  `npm run farm -- help`
 */
import { existsSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { APPS_DIR, appPaths, color, log, readJson, ROOT, slugify, which, writeJson, writeText, chromiumPath } from './lib/util.ts';
import { CONFIG_PATH, loadConfig, loadPipeline, savePipeline, setStage, validateFile, Checks, type Pipeline } from './lib/state.ts';
import { schemas, type SchemaName } from './schemas/index.ts';
import { STAGES, stageById, nextStage, logChecks, type RunOpts } from './stages/index.ts';
import { renderPrompt, runAgent, type AgentKind } from './lib/agent.ts';
import { makeAssets, encodeNativePreview } from './stages/assets.ts';
import { legalDist } from './stages/legal.ts';
import { writeMaestroFlows } from './lib/maestro.ts';
import { renderEasJson } from './stages/scaffold.ts';

const argv = process.argv.slice(2);
const flags: Record<string, string | boolean> = {};
const pos: string[] = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a.startsWith('--')) {
    const [k, v] = a.slice(2).split('=');
    if (v !== undefined) flags[k] = v;
    else if (argv[i + 1] && !argv[i + 1].startsWith('--')) flags[k] = argv[++i];
    else flags[k] = true;
  } else pos.push(a);
}
const [cmd, ...args] = pos;
const opts: RunOpts = { skipBuild: !!flags['skip-build'], force: !!flags.force, fast: !!flags.fast };

const HELP = `
${color.bold('farm')} — idea → App Store pipeline

${color.bold('Setup')}
  init                              create farm.config.json (owner, Apple team, legal site URL)
  doctor                            check tools + credentials available in this environment

${color.bold('Apps')}
  new "<idea>" [--name N] [--url U] [--repo owner/repo]   start an app (idea text, Vercel URL or repo)
  list                              all apps and their current stage
  status <slug>                     stage table for one app

${color.bold('Driving the pipeline')}
  next <slug>                       print the prompt for the next stage (agents: do it, then gate)
  prompt <slug> <stage>             print the prompt for a specific stage
  run <slug> <stage>                run a script stage (scaffold|playtest|listing|assets|legal|preflight) and gate it
  gate <slug> <stage> [--force]     check a stage's exit criteria; marks it done when passing
  auto <slug> [--agent claude|codex] [--until <stage>] [--max-fix 3]
                                    run everything automatable headlessly; stops at CI/human stages
  skip <slug> <stage>               mark a stage skipped
  set <slug> <ascAppId|easProjectId> <value>
  mark-build <slug> <buildNumber> [--testflight]   record a build (used by CI)

${color.bold('Tools')}
  validate <slug> <brief|spec|journeys|shots|listing>
  schema <brief|spec|journeys|shots|listing|config>     JSON Schema
  assets <slug> [--only icons|shots|preview|compose] [--skip-build]
  native-preview <slug> <recording.mov>   encode a simulator recording as the App Preview
  maestro <slug>                    (re)generate Maestro flows from journeys + shots
  legal-dist                        assemble all apps' legal/marketing sites → .legal-dist/
  release-config <slug>             write ascAppId into app/eas.json
  asc <bundle-id|listing|price|attach|submit|status> <slug> [--confirm SUBMIT] [--skip-media]
                                    App Store Connect API (needs ASC_KEY_ID/ASC_ISSUER_ID/ASC_PRIVATE_KEY)
`;

function requireSlug(s?: string) {
  if (!s) throw new Error('missing <slug>');
  if (!existsSync(appPaths(s).pipeline)) throw new Error(`no app "${s}" (have: ${listSlugs().join(', ') || 'none'})`);
  return s;
}
function listSlugs() {
  return existsSync(APPS_DIR) ? readdirSync(APPS_DIR).filter((d) => existsSync(appPaths(d).pipeline)) : [];
}

function statusTable(slug: string) {
  const pl = loadPipeline(slug);
  const next = nextStage(slug);
  console.log(color.bold(`\n${slug}`) + color.gray(`  (${pl.source.type}: ${pl.source.value.slice(0, 70)})`));
  for (const s of STAGES) {
    const st = pl.stages[s.id]?.status ?? 'pending';
    const icon = { done: color.green('✓'), skipped: color.gray('–'), failed: color.red('✗'), in_progress: color.yellow('…'), pending: ' ' }[st];
    const mark = next?.id === s.id ? color.yellow(' ← next') : '';
    console.log(` ${icon} ${s.id.padEnd(10)} ${color.gray(`[${s.owner}/${s.where.join('+')}]`.padEnd(20))} ${s.title}${s.optional ? color.gray(' (optional)') : ''}${mark}`);
  }
  if (pl.release.ascAppId || pl.release.lastBuild) console.log(color.gray(`   release: ${JSON.stringify(pl.release)}`));
}

async function gate(slug: string, stageId: string, quiet = false): Promise<Checks> {
  const stage = stageById(stageId);
  const c = await stage.gate(slug, opts);
  if (!quiet) logChecks(c);
  if (c.ok || flags.force) {
    setStage(slug, stage.id, 'done', c.warned.length ? `${c.warned.length} warnings` : undefined);
    log.ok(`gate ${stage.id}: PASS${c.warned.length ? ` (${c.warned.length} warnings)` : ''}${!c.ok ? ' (forced)' : ''}`);
  } else {
    setStage(slug, stage.id, 'failed', c.failed.map((f) => f.id).join(', '));
    log.err(`gate ${stage.id}: FAIL (${c.failed.length})`);
  }
  return c;
}

async function runStage(slug: string, stageId: string) {
  const stage = stageById(stageId);
  if (!stage.run) throw new Error(`stage ${stage.id} is ${stage.owner}-owned; use \`farm next ${slug}\` / see its playbook`);
  log.step(`${slug} · ${stage.id}: ${stage.title}`);
  setStage(slug, stage.id, 'in_progress');
  try {
    await stage.run(slug, opts);
  } catch (e) {
    setStage(slug, stage.id, 'failed', (e as Error).message.slice(0, 300));
    throw e;
  }
  return gate(slug, stage.id);
}

async function auto(slug: string) {
  const agent = (flags.agent as AgentKind | undefined) ?? (which('claude') ? 'claude' : which('codex') ? 'codex' : undefined);
  const until = flags.until as string | undefined;
  const maxFix = Number(flags['max-fix'] ?? 3);
  for (let guard = 0; guard < 40; guard++) {
    const stage = nextStage(slug);
    if (!stage) return log.ok(`${slug}: pipeline complete`);
    if (stage.owner === 'ci' || stage.owner === 'human') {
      log.warn(`next stage "${stage.id}" is ${stage.owner}-owned — stopping. See playbooks/${stage.playbook} and docs/RUNBOOK.md`);
      return statusTable(slug);
    }
    if (stage.owner === 'script') {
      let c = await runStage(slug, stage.id).catch((e) => new Checks().fail(`${stage.id}.run`, (e as Error).message));
      for (let i = 0; !c.ok && i < maxFix && stage.playbook && agent; i++) {
        log.warn(`${stage.id} failing → agent fix round ${i + 1}/${maxFix}`);
        await runAgent(agent, renderPrompt(slug, stage, c));
        c = await runStage(slug, stage.id).catch((e) => new Checks().fail(`${stage.id}.run`, (e as Error).message));
      }
      if (!c.ok) throw new Error(`${stage.id} still failing; see apps/${slug}/reports`);
    } else {
      if (!agent) throw new Error('no agent CLI (claude/codex) available for agent stages; run them in an interactive session: farm next ' + slug);
      let c = await stage.gate(slug, opts);
      for (let i = 0; !c.ok && i <= maxFix; i++) {
        log.step(`${slug} · ${stage.id} via ${agent} (attempt ${i + 1})`);
        setStage(slug, stage.id, 'in_progress');
        const code = await runAgent(agent, renderPrompt(slug, stage, i === 0 && !existsSync(appPaths(slug).brief) ? undefined : c));
        if (code !== 0) log.warn(`${agent} exited ${code}`);
        c = await gate(slug, stage.id);
        if (stage.id === 'listing' && c.ok) await stage.run?.(slug, opts);
      }
      if (!c.ok) throw new Error(`${stage.id} gate still failing after ${maxFix + 1} attempts`);
    }
    if (until && stage.id === until) return log.ok(`stopped after ${until}`);
  }
}

async function doctor() {
  const c = new Checks();
  const v = process.versions.node.split('.').map(Number);
  c.expect(v[0] >= 20, 'node', `node ${process.versions.node}`, 'node >= 20 required');
  for (const [bin, why, lvl] of [
    ['git', 'version control', 'fail'], ['ffmpeg', 'app preview video', 'fail'], ['ffprobe', 'preview validation', 'fail'],
    ['claude', 'headless agent stages (farm auto)', 'warn'], ['codex', 'alternative agent', 'warn'],
    ['xcodebuild', 'local iOS builds (Mac only)', 'warn'], ['xcrun', 'iOS simulator (Mac only)', 'warn'],
    ['maestro', 'native UI tests (Mac only)', 'warn'], ['fastlane', 'app record + privacy labels (Mac only)', 'warn'], ['eas', 'EAS CLI (npx eas-cli works too)', 'warn'],
  ] as const) c.expect(!!which(bin), `bin.${bin}`, `${bin}: ${which(bin)}`, `${bin} not found — ${why}`, undefined, lvl);
  c.expect(!!chromiumPath() || existsSync(path.join(ROOT, 'node_modules', 'playwright-core')), 'chromium', `chromium: ${chromiumPath() ?? 'playwright cache'}`, 'No Chromium: npx playwright install chromium');
  c.expect(existsSync(CONFIG_PATH), 'config', 'farm.config.json present', 'run: npm run farm -- init');
  if (existsSync(CONFIG_PATH)) {
    try {
      const cfg = loadConfig();
      for (const [k, val] of Object.entries({ ...cfg.owner, teamId: cfg.apple.teamId, bundleIdPrefix: cfg.apple.bundleIdPrefix, legalBaseUrl: cfg.legal.baseUrl }))
        c.expect(!!val, `config.${k}`, `${k} set`, `farm.config.json: ${k} is empty`, undefined, 'warn');
    } catch (e) { c.fail('config.parse', (e as Error).message); }
  }
  for (const [k, why] of [
    ['EXPO_TOKEN', 'EAS build/submit'], ['ASC_KEY_ID', 'App Store Connect API'], ['ASC_ISSUER_ID', 'App Store Connect API'],
    ['ASC_PRIVATE_KEY', 'App Store Connect API (or ASC_PRIVATE_KEY_PATH)'],
  ] as const) c.expect(!!process.env[k] || (k === 'ASC_PRIVATE_KEY' && !!process.env.ASC_PRIVATE_KEY_PATH), `env.${k}`, `${k} set`, `${k} not set here — ${why}. Fine if CI holds it as a GitHub secret.`, undefined, 'warn');
  logChecks(c, true);
  log.info(c.ok ? 'doctor: OK' : 'doctor: problems found');
}

async function main() {
  switch (cmd) {
    case undefined: case 'help': case '--help': console.log(HELP); break;

    case 'init': {
      if (existsSync(CONFIG_PATH) && !flags.force) { log.warn('farm.config.json exists (use --force to overwrite)'); break; }
      writeJson(CONFIG_PATH, {
        owner: { legalName: '', displayName: '', firstName: '', lastName: '', email: '', phone: '', country: 'US', website: '' },
        apple: { teamId: '', teamType: 'INDIVIDUAL', bundleIdPrefix: 'com.yourname' },
        legal: { baseUrl: 'https://app-farm-legal.vercel.app' },
        expo: { owner: '' },
        defaults: { sdk: 'latest', supportsTablet: false },
      });
      log.ok('wrote farm.config.json — fill it in (docs/SETUP.md)');
      break;
    }
    case 'doctor': await doctor(); break;

    case 'new': {
      const idea = args.join(' ').trim();
      const url = flags.url as string | undefined;
      const repo = flags.repo as string | undefined;
      if (!idea && !url && !repo) throw new Error('usage: farm new "<idea>" [--name N] [--url https://x.vercel.app] [--repo owner/repo]');
      let slug = slugify((flags.name as string) ?? (idea ? idea.split(/\s+/).slice(0, 4).join(' ') : (url ?? repo)!.replace(/^https?:\/\//, '').split(/[./]/)[0]));
      while (existsSync(appPaths(slug).dir)) slug = `${slug}-${Math.random().toString(36).slice(2, 5)}`;
      const P = appPaths(slug);
      const source: Pipeline['source'] = url ? { type: 'web-url', value: url } : repo ? { type: 'repo', value: repo } : { type: 'idea', value: idea };
      writeText(P.idea, `# Raw idea\n\n${idea || '(see source)'}\n\n- Source: ${source.type} — ${source.value}\n- Created: ${new Date().toISOString()}\n`);
      const pl: Pipeline = { slug, createdAt: new Date().toISOString(), source, stages: {}, release: {}, history: [] };
      for (const s of STAGES) pl.stages[s.id] = { status: 'pending', updatedAt: pl.createdAt };
      savePipeline(pl);
      log.ok(`created apps/${slug}`);
      log.info(`next: npm run farm -- next ${slug}   (or: npm run farm -- auto ${slug})`);
      break;
    }
    case 'list': for (const s of listSlugs()) statusTable(s); break;
    case 'status': statusTable(requireSlug(args[0])); break;

    case 'next': case 'prompt': {
      const slug = requireSlug(args[0]);
      const stage = cmd === 'next' ? nextStage(slug) : stageById(args[1]);
      if (!stage) { log.ok('pipeline complete'); break; }
      if (stage.owner === 'script' && cmd === 'next') {
        console.log(`Next stage "${stage.id}" is a script stage. Run:\n  npm run farm -- run ${slug} ${stage.id}\nIf its gate fails, fix per: npm run farm -- prompt ${slug} ${stage.id}`);
        break;
      }
      const c = await stage.gate(slug, { ...opts, fast: true }).catch(() => undefined);
      console.log(renderPrompt(slug, stage, c && !c.ok && loadPipeline(slug).stages[stage.id]?.status !== 'pending' ? c : undefined));
      break;
    }
    case 'run': await runStage(requireSlug(args[0]), args[1]); break;
    case 'gate': { const c = await gate(requireSlug(args[0]), args[1]); if (!c.ok && !flags.force) process.exitCode = 1; break; }
    case 'auto': await auto(requireSlug(args[0])); break;
    case 'skip': setStage(requireSlug(args[0]), stageById(args[1]).id, 'skipped', flags.reason as string); log.ok('skipped'); break;
    case 'mark-build': {
      const slug = requireSlug(args[0]);
      const pl = loadPipeline(slug);
      const spec = validateFile('spec', appPaths(slug).spec);
      pl.release.lastBuild = { version: spec.ok ? spec.data.app.version : '?', buildNumber: args[1] ?? 'unknown', at: new Date().toISOString(), testflight: !!flags.testflight };
      savePipeline(pl);
      if (flags.testflight) setStage(slug, 'release', 'done', `build ${args[1]}`);
      log.ok(`recorded build ${args[1]}`);
      break;
    }
    case 'set': {
      const pl = loadPipeline(requireSlug(args[0]));
      if (!['ascAppId', 'easProjectId'].includes(args[1])) throw new Error('key must be ascAppId or easProjectId');
      (pl.release as any)[args[1]] = args[2];
      savePipeline(pl);
      log.ok(`${args[1]} = ${args[2]}`);
      break;
    }
    case 'validate': {
      const slug = requireSlug(args[0]);
      const name = args[1] as SchemaName;
      const P = appPaths(slug) as any;
      const v = validateFile(name, P[name]);
      if (v.ok) log.ok(`${name} valid`); else { v.errors.forEach((e) => log.err(e)); process.exitCode = 1; }
      break;
    }
    case 'schema': {
      const s = schemas[args[0] as SchemaName];
      if (!s) throw new Error(`schemas: ${Object.keys(schemas).join(', ')}`);
      console.log(JSON.stringify(z.toJSONSchema(s, { io: 'input', unrepresentable: 'any' }), null, 2));
      break;
    }
    case 'assets': await makeAssets(requireSlug(args[0]), { skipBuild: opts.skipBuild, only: flags.only as any }); break;
    case 'native-preview': await encodeNativePreview(requireSlug(args[0]), path.resolve(args[1])); break;
    case 'maestro': {
      const slug = requireSlug(args[0]);
      const P = appPaths(slug);
      const spec = validateFile('spec', P.spec);
      const j = validateFile('journeys', P.journeys);
      const sh = validateFile('shots', P.shots);
      if (!spec.ok || !j.ok) throw new Error('spec/journeys invalid');
      log.ok(`flows → ${writeMaestroFlows(slug, spec.data.app.bundleId, spec.data.app.scheme, j.data.journeys, sh.ok ? sh.data.scenes : undefined, sh.ok ? sh.data.preview.steps : undefined)}`);
      break;
    }
    case 'legal-dist': legalDist(args[0] ? path.resolve(args[0]) : undefined); break;
    case 'release-config': {
      const slug = requireSlug(args[0]);
      const P = appPaths(slug);
      const pl = loadPipeline(slug);
      if (!pl.release.ascAppId) throw new Error('ascAppId unknown — `farm set <slug> ascAppId <id>` or `farm asc status <slug>`');
      const eas = renderEasJson(existsSync(P.easJson) ? readJson(P.easJson) : {});
      eas.submit.production.ios.ascAppId = pl.release.ascAppId;
      writeFileSync(P.easJson, JSON.stringify(eas, null, 2) + '\n');
      log.ok(`eas.json submit.production.ios.ascAppId = ${pl.release.ascAppId}`);
      break;
    }
    case 'asc': {
      const ops = await import('./asc/ops.ts');
      const slug = requireSlug(args[1]);
      const op = args[0];
      if (op === 'bundle-id') await ops.ensureBundleId(slug);
      else if (op === 'listing') { await ops.pushListing(slug, { skipMedia: !!flags['skip-media'] }); setStage(slug, 'store', 'done'); }
      else if (op === 'price') await ops.setFree(slug);
      else if (op === 'attach') await ops.attachBuild(slug, { waitMin: Number(flags.wait ?? 30) });
      else if (op === 'submit') await ops.submitForReview(slug, { confirm: flags.confirm as string });
      else if (op === 'status') await ops.status(slug);
      else throw new Error('asc ops: bundle-id | listing | price | attach | submit | status');
      break;
    }
    default: throw new Error(`unknown command "${cmd}"\n${HELP}`);
  }
}

main().catch((e) => {
  log.err((e as Error).message);
  if (process.env.FARM_DEBUG) console.error(e);
  process.exit(1);
});
