import { cpSync, existsSync, rmSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { appPaths, log, readJson, run, TEMPLATES_DIR, writeJson, writeText } from '../lib/util.ts';
import { loadConfig, validateFile } from '../lib/state.ts';
import type { FarmConfig, Spec } from '../schemas/index.ts';

/** Info.plist purpose-string keys required by each permission. */
export const PERMISSION_PLIST: Record<string, string[]> = {
  camera: ['NSCameraUsageDescription'],
  photos: ['NSPhotoLibraryUsageDescription'],
  photosAddOnly: ['NSPhotoLibraryAddUsageDescription'],
  microphone: ['NSMicrophoneUsageDescription'],
  location: ['NSLocationWhenInUseUsageDescription'],
  locationAlways: ['NSLocationWhenInUseUsageDescription', 'NSLocationAlwaysAndWhenInUseUsageDescription'],
  contacts: ['NSContactsUsageDescription'],
  calendar: ['NSCalendarsFullAccessUsageDescription', 'NSCalendarsUsageDescription'],
  reminders: ['NSRemindersFullAccessUsageDescription', 'NSRemindersUsageDescription'],
  tracking: ['NSUserTrackingUsageDescription'],
  faceId: ['NSFaceIDUsageDescription'],
  motion: ['NSMotionUsageDescription'],
  health: ['NSHealthShareUsageDescription', 'NSHealthUpdateUsageDescription'],
  bluetooth: ['NSBluetoothAlwaysUsageDescription'],
  speechRecognition: ['NSSpeechRecognitionUsageDescription'],
  localNetwork: ['NSLocalNetworkUsageDescription'],
  notifications: [],
};

export function legalUrls(cfg: FarmConfig, slug: string) {
  const base = cfg.legal.baseUrl.replace(/\/$/, '');
  return {
    privacyUrl: `${base}/${slug}/privacy`,
    termsUrl: `${base}/${slug}/terms`,
    supportUrl: `${base}/${slug}/support`,
    marketingUrl: `${base}/${slug}`,
  };
}

/** Build the expo config (app.json → expo) from the spec, preserving anything the template/agent added. */
export function renderExpoConfig(spec: Spec, cfg: FarmConfig, existing: any = {}) {
  const urls = legalUrls(cfg, spec.app.slug);
  const infoPlist: Record<string, unknown> = {
    // Expo's template allows arbitrary HTTP loads; production apps should be HTTPS-only (ATS).
    // Local networking stays allowed so dev builds can reach Metro.
    NSAppTransportSecurity: { NSAllowsArbitraryLoads: false, NSAllowsLocalNetworking: true },
    ...(existing.ios?.infoPlist ?? {}),
  };
  for (const p of spec.permissions) for (const key of PERMISSION_PLIST[p.key] ?? []) infoPlist[key] = p.reason;
  const plugins: any[] = (existing.plugins ?? ['expo-router']).filter((p: any) => (Array.isArray(p) ? p[0] : p) !== 'expo-splash-screen');
  plugins.push(['expo-splash-screen', { image: './assets/images/splash-icon.png', resizeMode: 'contain', imageWidth: 200, backgroundColor: spec.design.backgroundColor }]);
  if (spec.accounts.methods.includes('apple') && !plugins.includes('expo-apple-authentication')) plugins.push('expo-apple-authentication');

  return {
    ...existing,
    name: spec.app.name,
    slug: spec.app.slug,
    ...(cfg.expo.owner ? { owner: cfg.expo.owner } : {}),
    version: spec.app.version,
    orientation: spec.app.orientation,
    icon: './assets/images/icon.png',
    scheme: spec.app.scheme,
    userInterfaceStyle: spec.app.userInterfaceStyle,
    ios: {
      ...(existing.ios ?? {}),
      bundleIdentifier: spec.app.bundleId,
      buildNumber: existing.ios?.buildNumber ?? '1',
      supportsTablet: spec.app.supportsTablet,
      ...(spec.accounts.methods.includes('apple') ? { usesAppleSignIn: true } : {}),
      config: { ...(existing.ios?.config ?? {}), usesNonExemptEncryption: false },
      infoPlist,
      privacyManifests: existing.ios?.privacyManifests ?? {
        NSPrivacyTracking: spec.privacy.tracking,
        NSPrivacyAccessedAPITypes: [
          // AsyncStorage persists through NSUserDefaults-backed APIs; CA92.1 = app's own data.
          { NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryUserDefaults', NSPrivacyAccessedAPITypeReasons: ['CA92.1'] },
        ],
      },
    },
    android: { ...(existing.android ?? {}), adaptiveIcon: { ...(existing.android?.adaptiveIcon ?? {}), backgroundColor: spec.design.backgroundColor } },
    web: { ...(existing.web ?? {}), bundler: 'metro', output: 'static', favicon: './assets/images/favicon.png' },
    plugins,
    experiments: { ...(existing.experiments ?? {}), typedRoutes: true },
    extra: {
      ...(existing.extra ?? {}),
      farm: {
        appName: spec.app.name,
        privacyUrl: urls.privacyUrl,
        termsUrl: urls.termsUrl,
        supportUrl: urls.supportUrl,
        supportEmail: cfg.owner.email,
        accounts: spec.accounts.required || spec.accounts.methods.some((m) => m !== 'anonymous'),
      },
    },
  };
}

export function renderEasJson(existing: any = {}) {
  return {
    cli: { version: '>= 16.0.0', appVersionSource: 'remote', ...(existing.cli ?? {}) },
    build: {
      development: { developmentClient: true, distribution: 'internal', ios: { simulator: true } },
      preview: { distribution: 'internal' },
      production: { autoIncrement: true },
      ...(existing.build ?? {}),
    },
    submit: {
      production: {
        ios: {
          // Filled from pipeline.json release.ascAppId by `farm release-config`; key comes from CI env.
          ascAppId: existing.submit?.production?.ios?.ascAppId ?? 'SET_BY_FARM',
        },
      },
    },
  };
}

function colorsTs(spec: Spec) {
  return `// Generated from spec.design by the farm scaffolder — safe to edit.
const tintColorLight = '${spec.design.primaryColor}';
const tintColorDark = '#ffffff';

export default {
  light: {
    text: '${spec.design.textColor}',
    background: '${spec.design.backgroundColor}',
    tint: tintColorLight,
    tabIconDefault: '#c7c7cc',
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#ffffff',
    background: '#000000',
    tint: tintColorDark,
    tabIconDefault: '#636366',
    tabIconSelected: tintColorDark,
  },
};
`;
}

export async function scaffold(slug: string, opts: { force?: boolean } = {}) {
  const P = appPaths(slug);
  const v = validateFile('spec', P.spec);
  if (!v.ok) throw new Error(`spec.json invalid:\n  ${v.errors.join('\n  ')}`);
  const spec = v.data;
  const cfg = loadConfig();

  if (existsSync(path.join(P.app, 'package.json')) && !opts.force) {
    log.warn('app/ already exists — re-rendering config only (use --force to recreate).');
  } else {
    if (existsSync(P.app)) rmSync(P.app, { recursive: true, force: true });
    const sdk = cfg.defaults.sdk === 'latest' ? 'tabs' : `tabs@sdk-${cfg.defaults.sdk}`;
    log.info(`create-expo-app (${sdk})`);
    const r = await run('npx', ['--yes', 'create-expo-app@latest', 'app', '--template', sdk, '--no-install', '--yes'], { cwd: P.dir });
    if (r.code !== 0) throw new Error('create-expo-app failed');
    rmSync(path.join(P.app, '.git'), { recursive: true, force: true });
    // Remove template demo content (it would trip the placeholder scan and App Review).
    for (const f of ['app/(tabs)/two.tsx', 'app/modal.tsx', 'components/EditScreenInfo.tsx'])
      rmSync(path.join(P.app, f), { force: true });
    cpSync(path.join(TEMPLATES_DIR, 'expo-app', 'overlay'), P.app, { recursive: true });

    log.info('installing dependencies');
    if ((await run('npm', ['install', '--no-audit', '--no-fund'], { cwd: P.app })).code !== 0) throw new Error('npm install failed');
    const extra = ['@react-native-async-storage/async-storage', 'expo-haptics', 'expo-store-review', 'expo-web-browser'];
    if (spec.accounts.methods.includes('apple')) extra.push('expo-apple-authentication');
    if (spec.monetization.model === 'freemium-iap' || spec.monetization.model === 'subscription')
      log.warn('IAP: add react-native-iap or expo-iap during build (requires a dev build, not Expo Go).');
    const ei = await run('npx', ['expo', 'install', ...extra], { cwd: P.app, env: { EXPO_OFFLINE: '1' } });
    if (ei.code !== 0) throw new Error('expo install failed');
  }

  const appJson = existsSync(P.appJson) ? readJson(P.appJson) : { expo: {} };
  writeJson(P.appJson, { expo: renderExpoConfig(spec, cfg, appJson.expo) });
  writeJson(P.easJson, renderEasJson(existsSync(P.easJson) ? readJson(P.easJson) : {}));
  writeText(path.join(P.app, 'constants', 'Colors.ts'), colorsTs(spec));

  // package.json conveniences used by the pipeline
  const pkgPath = path.join(P.app, 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  pkg.name = slug;
  pkg.scripts = {
    ...pkg.scripts,
    typecheck: 'tsc --noEmit',
    'export:web': 'expo export -p web --output-dir dist-web',
    'export:ios': 'expo export -p ios --output-dir dist-ios',
  };
  writeJson(pkgPath, pkg);

  if (!existsSync(P.journeys)) {
    writeJson(P.journeys, {
      journeys: [
        { id: 'settings-legal', title: 'Settings shows legal links', critical: true, demo: true, steps: [
          { open: '/settings' }, { expect: { id: 'settings-privacy' } }, { expect: { id: 'settings-terms' } }, { expect: { id: 'settings-support' } },
        ] },
        { id: 'tabs', title: 'Tab bar navigation works', critical: true, demo: true, steps: [
          { open: '/' }, { tap: { id: 'tab-settings' } }, { expect: { id: 'settings-version' } }, { tap: { id: 'tab-home' } },
        ] },
      ],
    });
  }
  log.ok(`scaffolded ${path.relative(process.cwd(), P.app)}`);
}
