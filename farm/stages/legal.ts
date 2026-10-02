/**
 * Generates each app's public web presence — required by App Review:
 *   /<slug>/            marketing page (Marketing URL)
 *   /<slug>/privacy     privacy policy (Privacy Policy URL, also linked in-app — 5.1.1(i))
 *   /<slug>/terms       terms of use / EULA (required for subscriptions — 3.1.2)
 *   /<slug>/support     support page with a working contact method (Support URL — 1.5)
 * `farm legal-dist` assembles all apps into .legal-dist/ for one static deploy (Vercel or GitHub Pages).
 */
import { cpSync, existsSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { APPS_DIR, appPaths, ensureDir, log, ROOT, writeJson, writeText } from '../lib/util.ts';
import { loadConfig, validateFile } from '../lib/state.ts';
import { legalUrls } from './scaffold.ts';
import type { FarmConfig, Listing, Spec } from '../schemas/index.ts';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const human = (s: string) => s.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

function page(title: string, spec: Spec, body: string) {
  const d = spec.design;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><link rel="icon" href="icon.png">
<style>
:root{--bg:#ffffff;--fg:#1d1d1f;--muted:#6e6e73;--accent:${d.primaryColor};--card:#f5f5f7}
@media (prefers-color-scheme:dark){:root{--bg:#000;--fg:#f5f5f7;--muted:#a1a1a6;--card:#1c1c1e}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:17px/1.55 -apple-system,BlinkMacSystemFont,"SF Pro Text",Inter,"Segoe UI",sans-serif}
main{max-width:760px;margin:0 auto;padding:48px 20px 80px}h1{font-size:34px;line-height:1.15;margin:0 0 8px}h2{margin-top:36px;font-size:22px}
a{color:var(--accent)}.muted{color:var(--muted)}nav{display:flex;gap:16px;flex-wrap:wrap;margin-bottom:32px;font-size:15px}
.hero{display:flex;gap:20px;align-items:center}.hero img{width:96px;height:96px;border-radius:22px}
.shots{display:flex;gap:12px;overflow-x:auto;padding:8px 0}.shots img{height:420px;border-radius:18px}
.card{background:var(--card);border-radius:16px;padding:20px;margin:16px 0}table{border-collapse:collapse;width:100%}td,th{text-align:left;padding:8px;border-bottom:1px solid #8883;font-size:15px}
</style></head><body><main>
<nav><a href="./">${esc(spec.app.name)}</a><a href="support">Support</a><a href="privacy">Privacy</a><a href="terms">Terms</a></nav>
${body}
<p class="muted" style="margin-top:56px;font-size:14px">© ${new Date().getFullYear()} ${esc(spec.app.name)}</p>
</main></body></html>`;
}

export function privacyHtml(spec: Spec, cfg: FarmConfig) {
  const p = spec.privacy;
  const updated = new Date().toISOString().slice(0, 10);
  const rows = p.dataTypes.map((t) => `<tr><td>${human(t.type)}</td><td>${t.purposes.map(human).join(', ')}</td><td>${t.linkedToUser ? 'Yes' : 'No'}</td><td>${t.usedForTracking ? 'Yes' : 'No'}</td></tr>`).join('');
  const storage = {
    local: 'Your content is stored on your device. We do not operate servers that receive it.',
    none: 'The app does not store personal content.',
    cloud: 'Your content is stored on our servers so it can sync and be restored.',
    hybrid: 'Your content is stored on your device and synced to our servers so it can be restored.',
  }[spec.data.storage];
  const body = `<h1>Privacy Policy</h1><p class="muted">Last updated ${updated}</p>
<p>This policy explains how ${esc(spec.app.name)} (“the app”), published by ${esc(cfg.owner.legalName)}, handles your information.</p>
<h2>Summary</h2><div class="card">${p.collectsData
    ? `<p>The app collects only the data listed below, for the purposes listed. We do not sell your personal information.${p.tracking ? ' With your permission (App Tracking Transparency), some data may be used to track you across apps and websites owned by other companies.' : ' We do not track you across apps or websites owned by other companies.'}</p>`
    : '<p><strong>The app does not collect any data from you.</strong> We do not track you, and we do not sell or share personal information.</p>'}
<p>${storage}</p></div>
${p.collectsData && rows ? `<h2>Data we collect</h2><table><tr><th>Data</th><th>Purpose</th><th>Linked to you</th><th>Used to track</th></tr>${rows}</table>` : ''}
${spec.permissions.length ? `<h2>Device permissions</h2><p>The app asks for permission before accessing:</p><ul>${spec.permissions.map((x) => `<li><strong>${human(x.key)}</strong> — ${esc(x.reason)}</li>`).join('')}</ul><p>You can change these at any time in iOS Settings.</p>` : ''}
${p.thirdPartySdks.length ? `<h2>Third-party services</h2><p>The app uses the following services, which process data under their own privacy policies:</p><ul>${p.thirdPartySdks.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>` : ''}
${spec.monetization.model !== 'free' && spec.monetization.model !== 'ads' ? '<h2>Purchases</h2><p>Payments are processed by Apple through the App Store. We never receive your payment card details.</p>' : ''}
<h2>Retention and deletion</h2><p>${spec.accounts.deletionInApp ? 'You can delete your account and associated data at any time in the app under Settings → Delete Account. ' : ''}Data stored on your device is removed when you delete the app. To request deletion of any data we hold, email <a href="mailto:${esc(cfg.owner.email)}">${esc(cfg.owner.email)}</a>; we respond within 30 days.</p>
<h2>Children</h2><p>The app is not directed to children under 13${spec.content.regulated.includes('kids') ? ', except as permitted in the App Store Kids Category with verifiable parental consent' : ''}, and we do not knowingly collect personal information from children.</p>
<h2>Your rights</h2><p>Depending on where you live (for example under the GDPR or CCPA/CPRA) you may have rights to access, correct, delete or port your data and to object to processing. Contact us to exercise them.</p>
<h2>Changes</h2><p>We will post any changes on this page and update the date above.</p>
<h2>Contact</h2><p>${esc(cfg.owner.legalName)} · <a href="mailto:${esc(cfg.owner.email)}">${esc(cfg.owner.email)}</a></p>`;
  return page(`Privacy Policy — ${spec.app.name}`, spec, body);
}

export function termsHtml(spec: Spec, cfg: FarmConfig) {
  const sub = spec.monetization.model === 'subscription';
  const body = `<h1>Terms of Use</h1><p class="muted">Last updated ${new Date().toISOString().slice(0, 10)}</p>
<p>${esc(spec.app.name)} is licensed to you under Apple’s <a href="https://www.apple.com/legal/internet-services/itunes/dev/stdeula/">Standard Licensed Application End User License Agreement</a> (EULA), supplemented by these terms. ${esc(cfg.owner.legalName)} is the licensor.</p>
${sub ? `<h2>Subscriptions</h2><p>Subscriptions are billed through your Apple Account and renew automatically unless cancelled at least 24 hours before the end of the current period. Your account is charged for renewal within 24 hours prior to the end of the current period. Manage or cancel in iOS Settings → your name → Subscriptions. Any unused portion of a free trial is forfeited when you purchase a subscription.</p>` : ''}
${spec.content.userGenerated ? '<h2>User content</h2><p>You are responsible for content you post. There is no tolerance for objectionable content or abusive users. We may remove content and suspend accounts that violate these terms. You can report content or block users from within the app.</p>' : ''}
<h2>Acceptable use</h2><p>Do not misuse the app, attempt to disrupt it, or use it for unlawful purposes.</p>
<h2>Disclaimer</h2><p>The app is provided “as is”. ${spec.content.regulated.includes('medical') ? 'It does not provide medical advice; consult a qualified professional. ' : ''}${spec.content.regulated.includes('financial') ? 'It does not provide financial advice. ' : ''}To the extent permitted by law, the licensor is not liable for indirect or consequential damages.</p>
<h2>Contact</h2><p><a href="mailto:${esc(cfg.owner.email)}">${esc(cfg.owner.email)}</a></p>`;
  return page(`Terms of Use — ${spec.app.name}`, spec, body);
}

export function supportHtml(spec: Spec, cfg: FarmConfig) {
  const faq = spec.features.filter((f) => f.priority === 'mvp').slice(0, 6)
    .map((f) => `<h3>How do I use ${esc(f.title.toLowerCase())}?</h3><p>${esc(f.description)}</p>`).join('');
  const body = `<h1>${esc(spec.app.name)} Support</h1>
<div class="card"><p><strong>Contact us:</strong> <a href="mailto:${esc(cfg.owner.email)}?subject=${encodeURIComponent(spec.app.name + ' support')}">${esc(cfg.owner.email)}</a><br><span class="muted">We usually reply within 2 business days.</span></p></div>
<h2>Frequently asked questions</h2>${faq}
${spec.accounts.deletionInApp ? '<h3>How do I delete my account?</h3><p>Open Settings in the app and tap Delete Account. This permanently removes your account and data.</p>' : ''}
${spec.monetization.restorePurchases ? '<h3>How do I restore purchases?</h3><p>Open Settings in the app and tap Restore Purchases while signed in to the same Apple Account.</p>' : ''}
<h3>How do I report a bug?</h3><p>Email us with your iOS version, the app version (shown in Settings) and what happened.</p>`;
  return page(`Support — ${spec.app.name}`, spec, body);
}

export function indexHtml(spec: Spec, listing?: Listing, shots: string[] = []) {
  const body = `<div class="hero"><img src="icon.png" alt=""><div><h1>${esc(spec.app.name)}</h1><p class="muted" style="margin:0">${esc(listing?.subtitle ?? spec.app.subtitle)}</p></div></div>
${shots.length ? `<div class="shots">${shots.map((s) => `<img src="${s}" alt="">`).join('')}</div>` : ''}
${(listing?.description ?? spec.pitch.oneLiner).split(/\n{2,}/).map((para) => `<p>${esc(para).replace(/\n/g, '<br>')}</p>`).join('')}`;
  return page(spec.app.name, spec, body);
}

export function buildSite(slug: string) {
  const P = appPaths(slug);
  const spec = validateFile('spec', P.spec);
  if (!spec.ok) throw new Error('spec.json invalid');
  const cfg = loadConfig();
  const listing = validateFile('listing', P.listing);
  ensureDir(P.site);
  if (existsSync(P.iconPng)) cpSync(P.iconPng, path.join(P.site, 'icon.png'));
  const shotSrc = path.join(P.screenshots, 'iphone-6.9');
  const shots: string[] = [];
  if (existsSync(shotSrc)) {
    ensureDir(path.join(P.site, 'shots'));
    for (const f of readdirSync(shotSrc).filter((x) => x.endsWith('.png')).sort()) {
      cpSync(path.join(shotSrc, f), path.join(P.site, 'shots', f));
      shots.push(`shots/${f}`);
    }
  }
  writeText(path.join(P.site, 'index.html'), indexHtml(spec.data, listing.ok ? listing.data : undefined, shots));
  writeText(path.join(P.site, 'privacy.html'), privacyHtml(spec.data, cfg));
  writeText(path.join(P.site, 'terms.html'), termsHtml(spec.data, cfg));
  writeText(path.join(P.site, 'support.html'), supportHtml(spec.data, cfg));
  const urls = legalUrls(cfg, slug);
  log.ok(`site → apps/${slug}/site  (will serve at ${urls.marketingUrl})`);
  return urls;
}

/** Assemble every app's site into one static deploy root. */
export function legalDist(outDir = path.join(ROOT, '.legal-dist')) {
  rmSync(outDir, { recursive: true, force: true });
  ensureDir(outDir);
  const apps = existsSync(APPS_DIR) ? readdirSync(APPS_DIR).filter((s) => existsSync(path.join(appPaths(s).site, 'privacy.html'))) : [];
  for (const s of apps) cpSync(appPaths(s).site, path.join(outDir, s), { recursive: true });
  writeText(path.join(outDir, 'index.html'), `<!doctype html><meta charset="utf-8"><title>Apps</title><ul>${apps.map((s) => `<li><a href="/${s}/">${s}</a></li>`).join('')}</ul>`);
  writeJson(path.join(outDir, 'vercel.json'), { cleanUrls: true, trailingSlash: false });
  writeText(path.join(outDir, '.nojekyll'), '');
  log.ok(`legal dist → ${path.relative(process.cwd(), outDir)} (${apps.length} app(s))`);
  return outDir;
}
