/**
 * App Store asset + metadata specifications (as of the 2025–2026 App Store Connect requirements).
 * One source of truth used by asset generation, preflight and the App Store Connect uploader.
 */
export const DEVICES = {
  'iphone-6.9': {
    out: [1320, 2868] as const,
    accepted: [[1320, 2868], [1290, 2796], [1260, 2736]] as [number, number][],
    viewport: [440, 956] as const,
    dpr: 3,
    statusPt: 62,
    homePt: 34,
    displayType: 'APP_IPHONE_67',
    previewType: 'IPHONE_67',
    preview: [886, 1920] as const,
    frame: { deviceW: 1080, bezel: 24, radius: 150, top: 640 },
  },
  'ipad-13': {
    out: [2064, 2752] as const,
    accepted: [[2064, 2752], [2048, 2732]] as [number, number][],
    viewport: [1032, 1376] as const,
    dpr: 2,
    statusPt: 24,
    homePt: 20,
    displayType: 'APP_IPAD_PRO_3GEN_129',
    previewType: 'IPAD_PRO_3GEN_129',
    preview: [1200, 1600] as const,
    frame: { deviceW: 1640, bezel: 30, radius: 70, top: 560 },
  },
} as const;
export type DeviceId = keyof typeof DEVICES;

export type Orientation = 'portrait' | 'landscape' | 'default';
export interface DeviceSpec {
  out: readonly [number, number];
  accepted: [number, number][];
  viewport: readonly [number, number];
  dpr: number;
  statusPt: number;
  homePt: number;
  displayType: string;
  previewType: string;
  preview: readonly [number, number];
  frame: { deviceW: number; bezel: number; radius: number; top: number };
}

/**
 * Landscape variants. App Store Connect uses the SAME display/preview types for both orientations (an
 * APP_IPHONE_67 set accepts 2868×1320 as well as 1320×2868), so the screenshot directories stay
 * `store/screenshots/<device>/`; only pixel sizes, capture viewport and framing change.
 * In landscape iOS hides the status bar (statusPt 0) and the home indicator sits in a 21pt bottom inset.
 * `frame.top` is the caption band height; `frame.deviceW` is the device's outer width.
 */
export const DEVICES_LANDSCAPE: Record<'iphone-6.9', DeviceSpec> = {
  'iphone-6.9': {
    out: [2868, 1320] as const,
    accepted: [[2868, 1320], [2796, 1290], [2736, 1260]],
    viewport: [956, 440] as const,
    dpr: 3,
    statusPt: 0,
    homePt: 0,
    displayType: 'APP_IPHONE_67',
    previewType: 'IPHONE_67',
    preview: [1920, 886] as const,
    frame: { deviceW: 2100, bezel: 26, radius: 120, top: 270 },
  },
};

/** Devices to render for an app: iPhone always, iPad only when the spec supports tablets. */
export function devicesFor(spec: { app: { supportsTablet: boolean } }): DeviceId[] {
  return spec.app.supportsTablet ? ['iphone-6.9', 'ipad-13'] : ['iphone-6.9'];
}

/**
 * The asset spec for a device in the app's orientation. Portrait (and 'default', which ships portrait
 * screenshots) returns DEVICES[dev] unchanged, so existing portrait apps behave exactly as before.
 */
export function deviceSpec(dev: DeviceId, orientation: Orientation = 'portrait'): DeviceSpec {
  if (orientation !== 'landscape') return DEVICES[dev] as unknown as DeviceSpec;
  const l = (DEVICES_LANDSCAPE as Record<string, DeviceSpec>)[dev];
  if (!l) throw new Error(`no landscape asset spec for ${dev} (landscape iPad is not supported yet — keep supportsTablet false)`);
  return l;
}

export const PREVIEW = { minSec: 15, maxSec: 30, fps: 30, maxBytes: 500 * 1024 * 1024 };
export const SCREENSHOTS = { min: 1, recommendedMin: 3, max: 10 };
export const LIMITS = { name: 30, subtitle: 30, promotionalText: 170, description: 4000, keywordsBytes: 100, whatsNew: 4000, reviewNotes: 4000 };

/** Words that commonly trigger metadata rejections (2.3.x) when used in name/subtitle/keywords. */
export const RISKY_METADATA = [
  { re: /\b(android|google play|play store|windows phone|blackberry)\b/i, why: 'Mentions another platform', ref: '2.3.10' },
  { re: /\b(beta|test ?flight|demo version|trial version|coming soon)\b/i, why: 'Pre-release / incomplete wording', ref: '2.2 / 2.3.1' },
  { re: /\b(#1|number one|best|top[- ]rated|free)\b/i, why: 'Unverifiable superlative or price claim in name/subtitle/keywords', ref: '2.3.7' },
  { re: /\b(iphone|ipad|apple|siri|facetime|app store)\b/i, why: 'Apple trademark in name/keywords (allowed only in limited descriptive use)', ref: '2.3.7 / Apple trademark guidelines' },
];

export const PLACEHOLDER_RE = /\b(lorem ipsum|dolor sit amet|FARM_PLACEHOLDER|TODO|FIXME|XXX|placeholder text|example\.com|test@test|asdf)\b/i;
