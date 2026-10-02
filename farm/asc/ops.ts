/**
 * High-level App Store Connect operations used by the pipeline:
 *   bundle-id  register the bundle identifier
 *   listing    push metadata, categories, age rating, review info, screenshots, previews
 *   price      set the app to Free (base territory USA)
 *   attach     attach the newest processed build of this version
 *   submit     submit the version for App Review (requires explicit confirmation)
 *   status     summarize app / version / builds / review state
 * Note: App Store Connect apps cannot be *created* through the public API — see docs/HUMAN_STEPS.md.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { Asc } from './client.ts';
import { appPaths, log } from '../lib/util.ts';
import { loadConfig, loadPipeline, savePipeline, validateFile } from '../lib/state.ts';
import { DEVICES, type DeviceId } from '../lib/apple.ts';

const EDITABLE = ['PREPARE_FOR_SUBMISSION', 'DEVELOPER_REJECTED', 'REJECTED', 'METADATA_REJECTED', 'INVALID_BINARY'];

function ctx(slug: string) {
  const P = appPaths(slug);
  const spec = validateFile('spec', P.spec);
  if (!spec.ok) throw new Error('spec.json invalid');
  return { P, spec: spec.data, asc: new Asc() };
}

export async function findApp(asc: Asc, bundleId: string) {
  const r = await asc.get(`/v1/apps?filter[bundleId]=${encodeURIComponent(bundleId)}&limit=5`);
  return (r.data as any[]).find((a) => a.attributes.bundleId === bundleId);
}

export async function ensureBundleId(slug: string) {
  const { spec, asc } = ctx(slug);
  const r = await asc.get(`/v1/bundleIds?filter[identifier]=${encodeURIComponent(spec.app.bundleId)}&limit=20`);
  const hit = (r.data as any[]).find((b) => b.attributes.identifier === spec.app.bundleId);
  if (hit) return log.ok(`bundle id ${spec.app.bundleId} already registered (${hit.id})`);
  const created = await asc.post('/v1/bundleIds', {
    data: { type: 'bundleIds', attributes: { identifier: spec.app.bundleId, name: spec.app.name.replace(/[^A-Za-z0-9 ]/g, ''), platform: 'IOS' } },
  });
  log.ok(`registered bundle id ${spec.app.bundleId} (${created.data.id})`);
  if (spec.accounts.methods.includes('apple'))
    log.warn('Enable the "Sign in with Apple" capability for this bundle id (EAS does this automatically when ios.usesAppleSignIn=true).');
}

async function resolveApp(slug: string) {
  const c = ctx(slug);
  const pl = loadPipeline(slug);
  let app = pl.release.ascAppId ? (await c.asc.get(`/v1/apps/${pl.release.ascAppId}`)).data : await findApp(c.asc, c.spec.app.bundleId);
  if (!app) throw new Error(`No App Store Connect app for ${c.spec.app.bundleId}. Create the app record first (docs/HUMAN_STEPS.md §3).`);
  if (pl.release.ascAppId !== app.id) { pl.release.ascAppId = app.id; savePipeline(pl); }
  return { ...c, app, pl };
}

async function editableVersion(asc: Asc, appId: string, versionString: string, copyright?: string) {
  const r = await asc.get(`/v1/apps/${appId}/appStoreVersions?filter[platform]=IOS&limit=20`);
  const versions = r.data as any[];
  const state = (v: any) => v.attributes.appVersionState ?? v.attributes.appStoreState;
  let v = versions.find((x) => EDITABLE.includes(state(x)));
  if (!v) {
    v = (await asc.post('/v1/appStoreVersions', {
      data: { type: 'appStoreVersions', attributes: { platform: 'IOS', versionString, releaseType: 'AFTER_APPROVAL', ...(copyright ? { copyright } : {}) },
        relationships: { app: { data: { type: 'apps', id: appId } } } },
    })).data;
    log.ok(`created version ${versionString}`);
  } else {
    await asc.patch(`/v1/appStoreVersions/${v.id}`, { data: { type: 'appStoreVersions', id: v.id,
      attributes: { ...(v.attributes.versionString !== versionString ? { versionString } : {}), ...(copyright ? { copyright } : {}) } } });
  }
  const isFirst = !versions.some((x) => ['READY_FOR_SALE', 'READY_FOR_DISTRIBUTION', 'REPLACED_WITH_NEW_VERSION', 'REMOVED_FROM_SALE'].includes(state(x)));
  return { version: v, isFirst };
}

async function editableAppInfo(asc: Asc, appId: string) {
  const infos = (await asc.get(`/v1/apps/${appId}/appInfos`)).data as any[];
  const st = (i: any) => i.attributes.state ?? i.attributes.appStoreState;
  return infos.find((i) => !['READY_FOR_DISTRIBUTION', 'READY_FOR_SALE', 'REPLACED_WITH_NEW_INFO'].includes(st(i))) ?? infos[0];
}

async function upsertLocalization(asc: Asc, listPath: string, type: string, parentRel: string, parentType: string, parentId: string, locale: string, attributes: Record<string, unknown>) {
  const existing = ((await asc.get(listPath)).data as any[]).find((l) => l.attributes.locale === locale);
  const clean = Object.fromEntries(Object.entries(attributes).filter(([, v]) => v !== undefined));
  if (existing) {
    await asc.patch(`/v1/${type}/${existing.id}`, { data: { type, id: existing.id, attributes: clean } });
    return existing.id as string;
  }
  const r = await asc.post(`/v1/${type}`, { data: { type, attributes: { locale, ...clean }, relationships: { [parentRel]: { data: { type: parentType, id: parentId } } } } });
  return r.data.id as string;
}

export async function pushListing(slug: string, opts: { skipMedia?: boolean } = {}) {
  const { P, spec, asc, app } = await resolveApp(slug);
  const lv = validateFile('listing', P.listing);
  if (!lv.ok) throw new Error(`listing.json invalid: ${lv.errors.join('; ')}`);
  const L = lv.data;
  const cfg = loadConfig();

  const { version, isFirst } = await editableVersion(asc, app.id, spec.app.version, L.copyright);
  log.ok(`version ${spec.app.version} (${version.id})${isFirst ? ' — first release' : ''}`);

  // App info: categories + name/subtitle/privacy URL
  const info = await editableAppInfo(asc, app.id);
  await asc.patch(`/v1/appInfos/${info.id}`, { data: { type: 'appInfos', id: info.id, relationships: {
    primaryCategory: { data: { type: 'appCategories', id: L.primaryCategory } },
    ...(L.secondaryCategory ? { secondaryCategory: { data: { type: 'appCategories', id: L.secondaryCategory } } } : {}),
  } } });
  await upsertLocalization(asc, `/v1/appInfos/${info.id}/appInfoLocalizations`, 'appInfoLocalizations', 'appInfo', 'appInfos', info.id, L.locale,
    { name: L.name, subtitle: L.subtitle, privacyPolicyUrl: L.privacyPolicyUrl });
  log.ok('app info: name, subtitle, privacy URL, categories');

  // Version localization
  const locId = await upsertLocalization(asc, `/v1/appStoreVersions/${version.id}/appStoreVersionLocalizations`, 'appStoreVersionLocalizations',
    'appStoreVersion', 'appStoreVersions', version.id, L.locale, {
      description: L.description, keywords: L.keywords, promotionalText: L.promotionalText,
      supportUrl: L.supportUrl, marketingUrl: L.marketingUrl, ...(isFirst ? {} : { whatsNew: L.whatsNew ?? 'Bug fixes and improvements.' }),
    });
  log.ok('version localization: description, keywords, promo text, URLs');

  // Age rating
  const ar = await asc.get(`/v1/appInfos/${info.id}/ageRatingDeclaration`);
  if (ar.data?.id) {
    await asc.patch(`/v1/ageRatingDeclarations/${ar.data.id}`, { data: { type: 'ageRatingDeclarations', id: ar.data.id, attributes: L.ageRating } });
    log.ok('age rating declaration');
  }

  // Review details
  const reviewAttrs = {
    contactFirstName: cfg.owner.firstName, contactLastName: cfg.owner.lastName, contactEmail: cfg.owner.email, contactPhone: cfg.owner.phone,
    demoAccountRequired: L.review.demoAccountRequired, demoAccountName: L.review.demoAccountName ?? '', demoAccountPassword: L.review.demoAccountPassword ?? '',
    notes: L.review.notes,
  };
  let rd: any;
  try { rd = (await asc.get(`/v1/appStoreVersions/${version.id}/appStoreReviewDetail`)).data; } catch { rd = undefined; }
  if (rd?.id) await asc.patch(`/v1/appStoreReviewDetails/${rd.id}`, { data: { type: 'appStoreReviewDetails', id: rd.id, attributes: reviewAttrs } });
  else await asc.post('/v1/appStoreReviewDetails', { data: { type: 'appStoreReviewDetails', attributes: reviewAttrs,
    relationships: { appStoreVersion: { data: { type: 'appStoreVersions', id: version.id } } } } });
  log.ok('app review contact + notes');

  if (opts.skipMedia) return;
  // Screenshots
  for (const dev of Object.keys(DEVICES) as DeviceId[]) {
    const dir = path.join(P.screenshots, dev);
    if (!existsSync(dir)) continue;
    const files = readdirSync(dir).filter((f) => f.endsWith('.png')).sort();
    if (!files.length) continue;
    const displayType = DEVICES[dev].displayType;
    const sets = (await asc.get(`/v1/appStoreVersionLocalizations/${locId}/appScreenshotSets`)).data as any[];
    let set = sets.find((s) => s.attributes.screenshotDisplayType === displayType);
    if (!set) set = (await asc.post('/v1/appScreenshotSets', { data: { type: 'appScreenshotSets', attributes: { screenshotDisplayType: displayType },
      relationships: { appStoreVersionLocalization: { data: { type: 'appStoreVersionLocalizations', id: locId } } } } })).data;
    for (const old of (await asc.get(`/v1/appScreenshotSets/${set.id}/appScreenshots`)).data as any[]) await asc.del(`/v1/appScreenshots/${old.id}`);
    const ids: string[] = [];
    for (const f of files) ids.push(await asc.uploadAsset('appScreenshots', { type: 'appScreenshotSets', id: set.id }, f, readFileSync(path.join(dir, f))));
    await asc.patch(`/v1/appScreenshotSets/${set.id}/relationships/appScreenshots`, { data: ids.map((id) => ({ type: 'appScreenshots', id })) });
    log.ok(`screenshots ${displayType}: ${files.length}`);
  }
  // App previews
  for (const dev of Object.keys(DEVICES) as DeviceId[]) {
    const file = path.join(P.previews, dev, 'preview.mp4');
    if (!existsSync(file)) continue;
    const previewType = DEVICES[dev].previewType;
    const sets = (await asc.get(`/v1/appStoreVersionLocalizations/${locId}/appPreviewSets`)).data as any[];
    let set = sets.find((s) => s.attributes.previewType === previewType);
    if (!set) set = (await asc.post('/v1/appPreviewSets', { data: { type: 'appPreviewSets', attributes: { previewType },
      relationships: { appStoreVersionLocalization: { data: { type: 'appStoreVersionLocalizations', id: locId } } } } })).data;
    for (const old of (await asc.get(`/v1/appPreviewSets/${set.id}/appPreviews`)).data as any[]) await asc.del(`/v1/appPreviews/${old.id}`);
    await asc.uploadAsset('appPreviews', { type: 'appPreviewSets', id: set.id }, 'preview.mp4', readFileSync(file), { mimeType: 'video/mp4' });
    log.ok(`app preview ${previewType}`);
  }
}

export async function setFree(slug: string) {
  const { asc, app } = await resolveApp(slug);
  const points = (await asc.get(`/v1/apps/${app.id}/appPricePoints?filter[territory]=USA&limit=200`)).data as any[];
  const free = points.find((p) => Number(p.attributes.customerPrice) === 0);
  if (!free) throw new Error('could not find the $0 price point');
  await asc.req('POST', '/v1/appPriceSchedules', {
    data: { type: 'appPriceSchedules', relationships: {
      app: { data: { type: 'apps', id: app.id } },
      baseTerritory: { data: { type: 'territories', id: 'USA' } },
      manualPrices: { data: [{ type: 'appPrices', id: '${price0}' }] },
    } },
    included: [{ type: 'appPrices', id: '${price0}', attributes: { startDate: null },
      relationships: { appPricePoint: { data: { type: 'appPricePoints', id: free.id } } } }],
  });
  log.ok('price set to Free');
}

export async function attachBuild(slug: string, opts: { waitMin?: number } = {}) {
  const { spec, asc, app, pl } = await resolveApp(slug);
  const { version } = await editableVersion(asc, app.id, spec.app.version);
  const deadline = Date.now() + (opts.waitMin ?? 30) * 60_000;
  for (;;) {
    const builds = (await asc.get(`/v1/builds?filter[app]=${app.id}&filter[preReleaseVersion.version]=${spec.app.version}&sort=-uploadedDate&limit=10`)).data as any[];
    const valid = builds.find((b) => b.attributes.processingState === 'VALID' && !b.attributes.expired);
    if (valid) {
      await asc.patch(`/v1/appStoreVersions/${version.id}/relationships/build`, { data: { type: 'builds', id: valid.id } });
      pl.release.lastBuild = { version: spec.app.version, buildNumber: valid.attributes.version, at: new Date().toISOString(), testflight: true };
      savePipeline(pl);
      return log.ok(`attached build ${spec.app.version} (${valid.attributes.version}) to the App Store version`);
    }
    const processing = builds.find((b) => b.attributes.processingState === 'PROCESSING');
    if (!processing || Date.now() > deadline) throw new Error(processing ? 'build still processing — try again later' : `no uploaded build for version ${spec.app.version}; run the release workflow first`);
    log.info('build processing… waiting 60s');
    await new Promise((r) => setTimeout(r, 60_000));
  }
}

export async function submitForReview(slug: string, opts: { confirm?: string }) {
  if (opts.confirm !== 'SUBMIT') throw new Error('Refusing to submit without --confirm SUBMIT (this sends the app to Apple App Review).');
  const { spec, asc, app, pl } = await resolveApp(slug);
  const { version } = await editableVersion(asc, app.id, spec.app.version);
  const build = await asc.get(`/v1/appStoreVersions/${version.id}/build`).catch(() => ({ data: null }));
  if (!build.data) throw new Error('No build attached — run `farm asc attach <slug>` first');
  const open = (await asc.get(`/v1/reviewSubmissions?filter[app]=${app.id}&filter[state]=READY_FOR_REVIEW&limit=5`)).data as any[];
  const sub = open[0] ?? (await asc.post('/v1/reviewSubmissions', { data: { type: 'reviewSubmissions', attributes: { platform: 'IOS' },
    relationships: { app: { data: { type: 'apps', id: app.id } } } } })).data;
  await asc.post('/v1/reviewSubmissionItems', { data: { type: 'reviewSubmissionItems', relationships: {
    reviewSubmission: { data: { type: 'reviewSubmissions', id: sub.id } },
    appStoreVersion: { data: { type: 'appStoreVersions', id: version.id } },
  } } }).catch((e) => { if (!/already|ENTITY_ERROR.RELATIONSHIP.INVALID|duplicate/i.test(String(e))) throw e; });
  await asc.patch(`/v1/reviewSubmissions/${sub.id}`, { data: { type: 'reviewSubmissions', id: sub.id, attributes: { submitted: true } } });
  pl.release.submittedAt = new Date().toISOString();
  savePipeline(pl);
  log.ok(`submitted ${spec.app.name} ${spec.app.version} for App Review (submission ${sub.id})`);
}

export async function status(slug: string) {
  const { spec, asc, app } = await resolveApp(slug);
  const versions = (await asc.get(`/v1/apps/${app.id}/appStoreVersions?limit=5`)).data as any[];
  const builds = (await asc.get(`/v1/builds?filter[app]=${app.id}&sort=-uploadedDate&limit=5`)).data as any[];
  console.log(JSON.stringify({
    app: { id: app.id, name: app.attributes.name, bundleId: app.attributes.bundleId, sku: app.attributes.sku },
    specVersion: spec.app.version,
    versions: versions.map((v) => ({ id: v.id, version: v.attributes.versionString, state: v.attributes.appVersionState ?? v.attributes.appStoreState })),
    builds: builds.map((b) => ({ id: b.id, build: b.attributes.version, state: b.attributes.processingState, uploaded: b.attributes.uploadedDate })),
  }, null, 2));
}
