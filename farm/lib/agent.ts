/**
 * Renders stage playbooks into self-contained prompts and (optionally) runs them headlessly with
 * Claude Code (`claude -p`) or Codex (`codex exec`). In an interactive Claude Code session the
 * agent simply reads the prompt from `farm next <slug>` and does the work itself.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { appPaths, PLAYBOOKS_DIR, ROOT, run, which } from './util.ts';
import { loadPipeline, type Checks } from './state.ts';
import { schemas } from '../schemas/index.ts';
import type { Stage } from '../stages/index.ts';

const STAGE_SCHEMAS: Record<string, (keyof typeof schemas)[]> = {
  intake: ['brief'], spec: ['spec'], build: ['journeys'], listing: ['listing', 'shots'],
};

export function renderPrompt(slug: string, stage: Stage, failures?: Checks): string {
  const P = appPaths(slug);
  const rel = (p: string) => path.relative(ROOT, p);
  const pl = loadPipeline(slug);
  const vars: Record<string, string> = {
    slug, appDir: rel(P.dir), app: rel(P.app), idea: rel(P.idea), brief: rel(P.brief), spec: rel(P.spec), specMd: rel(P.specMd),
    journeys: rel(P.journeys), listing: rel(P.listing), shots: rel(P.shots), iconSvg: rel(P.iconSvg), reports: rel(P.reports),
    sourceType: pl.source.type, sourceValue: pl.source.value,
  };
  const pb = stage.playbook ? readFileSync(path.join(PLAYBOOKS_DIR, stage.playbook), 'utf8') : `Complete stage "${stage.id}": ${stage.title}.`;
  const body = pb.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? `{{${k}}}`);
  const parts = [
    `# app_farm — stage \`${stage.id}\` for app \`${slug}\``,
    'You are an autonomous agent operating the app_farm pipeline (read CLAUDE.md / AGENTS.md at the repo root for the rules).',
    `Repo root: ${ROOT}. All paths below are relative to it.`,
    '',
    body,
  ];
  for (const s of STAGE_SCHEMAS[stage.id] ?? [])
    parts.push(`\n## JSON Schema: ${s}\n\n\`\`\`json\n${JSON.stringify(z.toJSONSchema(schemas[s], { io: 'input', unrepresentable: 'any' }), null, 1)}\n\`\`\``);
  if (failures && !failures.ok) {
    parts.push('\n## The gate for this stage is currently FAILING — fix these first\n');
    for (const f of failures.failed) parts.push(`- ❌ \`${f.id}\`: ${f.msg}${f.ref ? ` (Guideline ${f.ref})` : ''}`);
    for (const w of failures.warned) parts.push(`- ⚠️ \`${w.id}\`: ${w.msg}${w.ref ? ` (Guideline ${w.ref})` : ''}`);
  }
  parts.push(`\n## Done when\n\n\`npm run farm -- gate ${slug} ${stage.id}\` passes. Run it yourself before finishing.`);
  return parts.join('\n');
}

export type AgentKind = 'claude' | 'codex';
export async function runAgent(kind: AgentKind, prompt: string): Promise<number> {
  if (kind === 'claude') {
    if (!which('claude')) throw new Error('claude CLI not found (npm i -g @anthropic-ai/claude-code)');
    const mode = process.env.FARM_CLAUDE_PERMISSION_MODE ?? 'acceptEdits';
    const args = ['-p', prompt, '--permission-mode', mode, '--allowedTools', 'Bash Read Write Edit Glob Grep WebFetch WebSearch'];
    if (process.env.FARM_CLAUDE_MODEL) args.push('--model', process.env.FARM_CLAUDE_MODEL);
    return (await run('claude', args, { cwd: ROOT })).code;
  }
  if (!which('codex')) throw new Error('codex CLI not found (npm i -g @openai/codex)');
  return (await run('codex', ['exec', '--full-auto', '-C', ROOT, prompt], { cwd: ROOT })).code;
}

export function hasPlaybook(stage: Stage) {
  return !!stage.playbook && existsSync(path.join(PLAYBOOKS_DIR, stage.playbook));
}
