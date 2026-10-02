import { existsSync } from 'node:fs';
import { appPaths, readJson, readJsonIf, writeJson, ROOT } from './util.ts';
import path from 'node:path';
import { FarmConfig, schemas, formatZodError, type SchemaName } from '../schemas/index.ts';
import type { z } from 'zod';

export type StageStatus = 'pending' | 'in_progress' | 'done' | 'failed' | 'skipped';

export interface Pipeline {
  slug: string;
  createdAt: string;
  source: { type: 'idea' | 'web-url' | 'repo'; value: string };
  stages: Record<string, { status: StageStatus; updatedAt: string; note?: string }>;
  /** Values discovered along the way (App Store Connect app id, EAS project id, last build, ...). */
  release: {
    ascAppId?: string;
    easProjectId?: string;
    lastBuild?: { version: string; buildNumber: string; at: string; testflight?: boolean };
    submittedAt?: string;
  };
  history: { at: string; stage: string; event: string; detail?: string }[];
}

export function loadPipeline(slug: string): Pipeline {
  const p = appPaths(slug).pipeline;
  if (!existsSync(p)) throw new Error(`No app "${slug}". Run: npm run farm -- new "<idea>"`);
  return readJson<Pipeline>(p);
}
export function savePipeline(pl: Pipeline) {
  writeJson(appPaths(pl.slug).pipeline, pl);
}
export function setStage(slug: string, stage: string, status: StageStatus, note?: string) {
  const pl = loadPipeline(slug);
  pl.stages[stage] = { status, updatedAt: new Date().toISOString(), ...(note ? { note } : {}) };
  pl.history.push({ at: new Date().toISOString(), stage, event: status, ...(note ? { detail: note.slice(0, 500) } : {}) });
  savePipeline(pl);
}

export const CONFIG_PATH = path.join(ROOT, 'farm.config.json');
export function loadConfig(): FarmConfig {
  const raw = readJsonIf(CONFIG_PATH) ?? {};
  const env = process.env;
  // Env overrides let CI inject personal details without committing them.
  const merged = {
    ...raw,
    owner: {
      ...raw.owner,
      ...(env.FARM_OWNER_EMAIL && { email: env.FARM_OWNER_EMAIL }),
      ...(env.FARM_OWNER_PHONE && { phone: env.FARM_OWNER_PHONE }),
    },
    apple: { ...raw.apple, ...(env.APPLE_TEAM_ID && { teamId: env.APPLE_TEAM_ID }) },
  };
  return FarmConfig.parse(merged);
}

export function validateFile<N extends SchemaName>(name: N, file: string):
  | { ok: true; data: z.infer<(typeof schemas)[N]> }
  | { ok: false; errors: string[] } {
  if (!existsSync(file)) return { ok: false, errors: [`missing ${path.relative(ROOT, file)}`] };
  let raw: unknown;
  try {
    raw = readJson(file);
  } catch (e) {
    return { ok: false, errors: [`invalid JSON in ${path.relative(ROOT, file)}: ${(e as Error).message}`] };
  }
  const r = schemas[name].safeParse(raw);
  return r.success ? { ok: true, data: r.data as any } : { ok: false, errors: formatZodError(r.error) };
}

// ---------------------------------------------------------------------------
// Checks — the common currency of gates, preflight and playtest
// ---------------------------------------------------------------------------
export type Level = 'pass' | 'warn' | 'fail';
export interface Check { id: string; level: Level; msg: string; ref?: string }
export class Checks {
  list: Check[] = [];
  add(id: string, level: Level, msg: string, ref?: string) { this.list.push({ id, level, msg, ref }); return this; }
  pass(id: string, msg: string, ref?: string) { return this.add(id, 'pass', msg, ref); }
  warn(id: string, msg: string, ref?: string) { return this.add(id, 'warn', msg, ref); }
  fail(id: string, msg: string, ref?: string) { return this.add(id, 'fail', msg, ref); }
  /** pass if cond, else `level` (default fail). */
  expect(cond: boolean, id: string, okMsg: string, badMsg: string, ref?: string, level: Level = 'fail') {
    return cond ? this.pass(id, okMsg, ref) : this.add(id, level, badMsg, ref);
  }
  merge(other: Checks) { this.list.push(...other.list); return this; }
  get failed() { return this.list.filter((c) => c.level === 'fail'); }
  get warned() { return this.list.filter((c) => c.level === 'warn'); }
  get ok() { return this.failed.length === 0; }
  toMarkdown(title: string) {
    const icon = { pass: '✅', warn: '⚠️', fail: '❌' } as const;
    const rows = [...this.failed, ...this.warned, ...this.list.filter((c) => c.level === 'pass')]
      .map((c) => `| ${icon[c.level]} | \`${c.id}\` | ${c.msg.replace(/\|/g, '\\|').replace(/\n/g, ' ')} | ${c.ref ?? ''} |`);
    return [
      `# ${title}`,
      '',
      `**${this.failed.length} fail · ${this.warned.length} warn · ${this.list.length - this.failed.length - this.warned.length} pass** — generated ${new Date().toISOString()}`,
      '',
      '| | Check | Detail | Ref |',
      '|---|---|---|---|',
      ...rows,
      '',
    ].join('\n');
  }
}
