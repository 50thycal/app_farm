/**
 * Compile the step DSL (e2e/journeys.json, store/shots.json) into Maestro flows for the iOS simulator.
 * Maestro: https://maestro.mobile.dev — runs on macOS (local Mac or the macOS GitHub Actions runner).
 */
import path from 'node:path';
import { appPaths, ensureDir, writeText } from './util.ts';
import type { Step, Target } from '../schemas/index.ts';

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const q = (s: string) => JSON.stringify(s);
const sel = (t: Target) => ('id' in t ? `{ id: ${q(t.id)} }` : `{ text: ${q(`.*${esc(t.text)}.*`)} }`);

export function stepsToMaestro(steps: Step[], o: { appId: string; scheme: string; demo: boolean; name: string; shotsDir?: string }): string {
  const out: string[] = [`appId: ${o.appId}`, `name: ${q(o.name)}`, '---', '- clearState'];
  let opened = false;
  for (const s of steps) {
    if ('open' in s) {
      const route = s.open.replace(/^\//, '');
      const demo = o.demo && !opened ? (route.includes('?') ? '&' : '?') + 'farmDemo=1' : '';
      out.push(`- openLink: ${q(`${o.scheme}://${route}${demo}`)}`, '- waitForAnimationToEnd');
      opened = true;
    } else if ('tap' in s) out.push(`- tapOn: ${sel(s.tap)}`);
    else if ('type' in s) out.push(`- tapOn: ${sel(s.type.target)}`, `- inputText: ${q(s.type.text)}`, '- hideKeyboard');
    else if ('expect' in s) out.push(`- extendedWaitUntil:\n    visible: ${sel(s.expect)}\n    timeout: 8000`);
    else if ('expectNot' in s) out.push(`- assertNotVisible: ${sel(s.expectNot)}`);
    else if ('back' in s) out.push('- swipe:\n    start: 2%, 50%\n    end: 85%, 50%'); // iOS edge-swipe back
    else if ('wait' in s) out.push(`- waitForAnimationToEnd:\n    timeout: ${s.wait}`);
    else if ('scroll' in s) out.push(s.scroll === 'down' ? '- scroll' : '- swipe:\n    direction: DOWN');
    else if ('screenshot' in s) out.push(`- takeScreenshot: ${q(path.join(o.shotsDir ?? '.', s.screenshot))}`);
    if (!('wait' in s) && !('open' in s)) out.push('- waitForAnimationToEnd');
  }
  return out.join('\n') + '\n';
}

/** Writes app/.maestro/{journeys,shots,preview}/*.yaml. Returns the directory. */
export function writeMaestroFlows(slug: string, appId: string, scheme: string, journeys: { id: string; title: string; demo: boolean; steps: Step[] }[], scenes?: { id: string; demo: boolean; steps: Step[] }[], preview?: Step[]) {
  const P = appPaths(slug);
  const root = ensureDir(path.join(P.app, '.maestro'));
  for (const j of journeys)
    writeText(path.join(root, 'journeys', `${j.id}.yaml`), stepsToMaestro(j.steps, { appId, scheme, demo: j.demo, name: j.title }));
  for (const s of scenes ?? [])
    writeText(path.join(root, 'shots', `${s.id}.yaml`),
      stepsToMaestro([...s.steps, { wait: 800 }, { screenshot: s.id }], { appId, scheme, demo: s.demo, name: `shot ${s.id}`, shotsDir: '../store/raw/native' /* resolved from app/ — maestro runs with cwd=app */ }));
  if (preview) writeText(path.join(root, 'preview', 'preview.yaml'), stepsToMaestro(preview.flatMap((s) => [s, { wait: 900 } as Step]), { appId, scheme, demo: true, name: 'app preview' }));
  return root;
}
