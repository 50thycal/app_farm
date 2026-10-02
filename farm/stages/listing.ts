/** App Store metadata checks + exports (fastlane deliver layout, App Privacy JSON). */
import { readdirSync, existsSync, copyFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { appPaths, ensureDir, log, writeJson, writeText } from '../lib/util.ts';
import { Checks, loadConfig } from '../lib/state.ts';
import { LIMITS, PLACEHOLDER_RE, RISKY_METADATA, DEVICES } from '../lib/apple.ts';
import { legalUrls } from './scaffold.ts';
import type { Listing, Spec } from '../schemas/index.ts';

export function listingChecks(l: Listing, spec: Spec): Checks {
  const c = new Checks();
  const kwBytes = Buffer.byteLength(l.keywords, 'utf8');
  c.expect(kwBytes <= LIMITS.keywordsBytes, 'listing.keywords.bytes', `keywords ${kwBytes}/100 bytes`, `keywords are ${kwBytes} bytes (max 100)`);
  if (/,\s/.test(l.keywords)) c.warn('listing.keywords.spaces', 'Remove spaces after commas in keywords — they waste characters');
  const nameWords = new Set(l.name.toLowerCase().split(/\W+/).filter(Boolean));
  const kws = l.keywords.toLowerCase().split(',').map((k) => k.trim()).filter(Boolean);
  const dupes = kws.filter((k) => nameWords.has(k));
  if (dupes.length) c.warn('listing.keywords.dupe-name', `Keywords repeat words already in the name: ${dupes.join(', ')} (wasted — name is indexed)`);
  if (new Set(kws).size !== kws.length) c.warn('listing.keywords.dupes', 'Duplicate keywords');

  for (const [field, text] of [['name', l.name], ['subtitle', l.subtitle], ['keywords', l.keywords]] as const)
    for (const r of RISKY_METADATA)
      if (r.re.test(text)) c.add(`listing.${field}.risky`, r.ref === '2.3.10' ? 'fail' : 'warn', `${field}: ${r.why} ("${text.match(r.re)?.[0]}")`, r.ref);
  for (const [field, text] of [['description', l.description], ['promotionalText', l.promotionalText], ['review.notes', l.review.notes]] as const) {
    if (PLACEHOLDER_RE.test(text)) c.fail(`listing.${field}.placeholder`, `${field} contains placeholder text ("${text.match(PLACEHOLDER_RE)?.[0]}")`, '2.1');
    if (/\b(android|google play)\b/i.test(text)) c.fail(`listing.${field}.platform`, `${field} mentions another platform`, '2.3.10');
  }
  c.expect(l.name.toLowerCase().startsWith(spec.app.name.toLowerCase().slice(0, 12)) || spec.app.name.toLowerCase().startsWith(l.name.toLowerCase().slice(0, 12)),
    'listing.name.match', 'Store name matches the app name', `Store name "${l.name}" differs from app name "${spec.app.name}" — keep them closely related`, '2.3.8', 'warn');
  c.expect(l.subtitle.toLowerCase() !== l.name.toLowerCase(), 'listing.subtitle', 'Subtitle adds information', 'Subtitle repeats the name');
  c.expect(l.review.notes.length >= 80, 'listing.review-notes', 'Review notes explain how to test',
    'Write App Review notes: what the app does, how to reach each feature, any non-obvious behavior', '2.1');
  const needsDemo = spec.accounts.required;
  if (needsDemo) c.expect(l.review.demoAccountRequired && !!l.review.demoAccountName && !!l.review.demoAccountPassword,
    'listing.demo-account', 'Demo account provided', 'Login required but no demo account for App Review', '2.1');
  c.expect(l.copyright.startsWith(String(new Date().getFullYear())), 'listing.copyright', 'Copyright year current', `Copyright "${l.copyright}" should start with ${new Date().getFullYear()}`, undefined, 'warn');
  for (const [k, u] of [['supportUrl', l.supportUrl], ['privacyPolicyUrl', l.privacyPolicyUrl], ['marketingUrl', l.marketingUrl]] as const)
    if (u) c.expect(u.startsWith('https://'), `listing.${k}.https`, `${k} is https`, `${k} must be https`);
  const urls = legalUrls(loadConfig(), spec.app.slug);
  c.expect(l.privacyPolicyUrl === urls.privacyUrl, 'listing.privacy-url', 'Privacy URL matches the in-app link',
    `privacyPolicyUrl (${l.privacyPolicyUrl}) ≠ in-app privacy link (${urls.privacyUrl})`, '5.1.1(i)', 'warn');
  c.expect(l.primaryCategory === spec.app.primaryCategory, 'listing.category', 'Category matches spec', 'Category differs from spec', undefined, 'warn');
  return c;
}

/** fastlane `upload_app_privacy_details_to_app_store` JSON (App Privacy cannot be set via the App Store Connect API). */
export function appPrivacyJson(spec: Spec) {
  if (!spec.privacy.collectsData || spec.privacy.dataTypes.length === 0) return [{ data_protections: ['DATA_NOT_COLLECTED'] }];
  return spec.privacy.dataTypes.map((t) => ({
    category: t.type,
    purposes: t.purposes,
    data_protections: [
      ...(t.usedForTracking ? ['DATA_USED_TO_TRACK_YOU'] : []),
      t.linkedToUser ? 'DATA_LINKED_TO_YOU' : 'DATA_NOT_LINKED_TO_YOU',
    ],
  }));
}

/** fastlane deliver layout — lets a Mac push everything with `fastlane deliver` as an alternative to `farm asc`. */
export function exportFastlane(slug: string, l: Listing) {
  const P = appPaths(slug);
  const cfg = loadConfig();
  const loc = path.join(P.fastlaneMeta, l.locale);
  const files: Record<string, string | undefined> = {
    'name.txt': l.name, 'subtitle.txt': l.subtitle, 'description.txt': l.description, 'keywords.txt': l.keywords,
    'promotional_text.txt': l.promotionalText, 'release_notes.txt': l.whatsNew, 'support_url.txt': l.supportUrl,
    'marketing_url.txt': l.marketingUrl, 'privacy_url.txt': l.privacyPolicyUrl,
  };
  for (const [f, v] of Object.entries(files)) if (v !== undefined) writeText(path.join(loc, f), v + '\n');
  writeText(path.join(P.fastlaneMeta, 'copyright.txt'), l.copyright + '\n');
  writeText(path.join(P.fastlaneMeta, 'primary_category.txt'), l.primaryCategory + '\n');
  if (l.secondaryCategory) writeText(path.join(P.fastlaneMeta, 'secondary_category.txt'), l.secondaryCategory + '\n');
  const rv = path.join(P.fastlaneMeta, 'review_information');
  const review: Record<string, string> = {
    'first_name.txt': cfg.owner.firstName, 'last_name.txt': cfg.owner.lastName, 'email_address.txt': cfg.owner.email,
    'phone_number.txt': cfg.owner.phone, 'notes.txt': l.review.notes,
    'demo_user.txt': l.review.demoAccountName ?? '', 'demo_password.txt': l.review.demoAccountPassword ?? '',
  };
  for (const [f, v] of Object.entries(review)) writeText(path.join(rv, f), v + '\n');
  // Screenshots: fastlane infers display type from pixel size.
  const shotOut = path.join(P.store, 'fastlane', 'screenshots', l.locale);
  rmSync(shotOut, { recursive: true, force: true });
  ensureDir(shotOut);
  for (const dev of Object.keys(DEVICES)) {
    const dir = path.join(P.screenshots, dev);
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.png'))) copyFileSync(path.join(dir, f), path.join(shotOut, `${dev}-${f}`));
  }
  writeJson(path.join(P.store, 'fastlane', 'age_rating.json'), l.ageRating);
  log.ok(`fastlane metadata → apps/${slug}/store/fastlane`);
}

export function writeAppPrivacy(slug: string, spec: Spec) {
  writeJson(appPaths(slug).appPrivacy, appPrivacyJson(spec));
}
