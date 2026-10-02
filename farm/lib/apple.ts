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
