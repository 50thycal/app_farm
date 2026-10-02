import { z } from 'zod';

// ---------------------------------------------------------------------------
// Shared enums
// ---------------------------------------------------------------------------
export const AppStoreCategory = z.enum([
  'BOOKS', 'BUSINESS', 'DEVELOPER_TOOLS', 'EDUCATION', 'ENTERTAINMENT', 'FINANCE', 'FOOD_AND_DRINK',
  'GAMES', 'GRAPHICS_AND_DESIGN', 'HEALTH_AND_FITNESS', 'LIFESTYLE', 'MAGAZINES_AND_NEWSPAPERS', 'MEDICAL',
  'MUSIC', 'NAVIGATION', 'NEWS', 'PHOTO_AND_VIDEO', 'PRODUCTIVITY', 'REFERENCE', 'SHOPPING',
  'SOCIAL_NETWORKING', 'SPORTS', 'STICKERS', 'TRAVEL', 'UTILITIES', 'WEATHER',
]);

export const Permission = z.enum([
  'camera', 'photos', 'photosAddOnly', 'microphone', 'location', 'locationAlways', 'contacts', 'calendar',
  'reminders', 'notifications', 'tracking', 'faceId', 'motion', 'health', 'bluetooth', 'speechRecognition', 'localNetwork',
]);

/** Apple App Privacy ("nutrition label") data types. Mirrors fastlane's upload_app_privacy_details categories. */
export const PrivacyDataType = z.enum([
  'NAME', 'EMAIL_ADDRESS', 'PHONE_NUMBER', 'PHYSICAL_ADDRESS', 'OTHER_CONTACT_INFO',
  'HEALTH', 'FITNESS', 'PAYMENT_INFORMATION', 'CREDIT_AND_FRAUD', 'OTHER_FINANCIAL_INFO',
  'PRECISE_LOCATION', 'COARSE_LOCATION', 'SENSITIVE_INFO', 'CONTACTS', 'EMAILS_OR_TEXT_MESSAGES',
  'PHOTOS_OR_VIDEOS', 'AUDIO', 'GAMEPLAY_CONTENT', 'CUSTOMER_SUPPORT', 'OTHER_USER_CONTENT',
  'BROWSING_HISTORY', 'SEARCH_HISTORY', 'USER_ID', 'DEVICE_ID', 'PURCHASE_HISTORY',
  'PRODUCT_INTERACTION', 'ADVERTISING_DATA', 'OTHER_USAGE_DATA', 'CRASH_DATA', 'PERFORMANCE_DATA',
  'OTHER_DIAGNOSTIC_DATA', 'ENVIRONMENT_SCANNING', 'HANDS', 'HEAD', 'OTHER_DATA_TYPES',
]);
export const PrivacyPurpose = z.enum([
  'THIRD_PARTY_ADVERTISING', 'DEVELOPERS_ADVERTISING', 'ANALYTICS', 'PRODUCT_PERSONALIZATION',
  'APP_FUNCTIONALITY', 'OTHER_PURPOSES',
]);

// ---------------------------------------------------------------------------
// Stage 1 — brief (intake)
// ---------------------------------------------------------------------------
export const Brief = z.object({
  workingName: z.string().min(2).max(30),
  nameAlternatives: z.array(z.string().max(30)).min(2),
  oneLiner: z.string().min(10).max(120),
  problem: z.string().min(20),
  audience: z.string().min(10),
  coreLoop: z.string().min(20).describe('What the user does every session, in one paragraph'),
  differentiator: z.string().min(10),
  mvpFeatures: z.array(z.string()).min(3),
  laterFeatures: z.array(z.string()).default([]),
  category: AppStoreCategory,
  monetization: z.enum(['free', 'paid', 'freemium-iap', 'subscription', 'ads']),
  needsBackend: z.boolean(),
  needsAccounts: z.boolean(),
  source: z.object({
    type: z.enum(['idea', 'web-url', 'repo']),
    value: z.string(),
    notes: z.string().optional(),
  }),
  risks: z.array(z.object({ risk: z.string(), guideline: z.string().optional(), mitigation: z.string() })).default([]),
  openQuestions: z.array(z.string()).default([]),
});
export type Brief = z.infer<typeof Brief>;

// ---------------------------------------------------------------------------
// Stage 2 — spec
// ---------------------------------------------------------------------------
export const Spec = z.object({
  app: z.object({
    name: z.string().min(2).max(30),
    subtitle: z.string().max(30),
    slug: z.string().regex(/^[a-z0-9-]+$/),
    bundleId: z.string().regex(/^[A-Za-z0-9-]+(\.[A-Za-z0-9-]+){2,}$/),
    scheme: z.string().regex(/^[a-z][a-z0-9+.-]*$/),
    version: z.string().regex(/^\d+\.\d+\.\d+$/).default('1.0.0'),
    primaryCategory: AppStoreCategory,
    secondaryCategory: AppStoreCategory.optional(),
    supportsTablet: z.boolean().default(false),
    orientation: z.enum(['portrait', 'landscape', 'default']).default('portrait'),
    userInterfaceStyle: z.enum(['light', 'dark', 'automatic']).default('automatic'),
    locale: z.string().default('en-US'),
  }),
  pitch: z.object({ oneLiner: z.string(), audience: z.string(), coreLoop: z.string(), differentiator: z.string() }),
  features: z.array(z.object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    title: z.string(),
    description: z.string(),
    priority: z.enum(['mvp', 'later']),
    acceptance: z.array(z.string()).min(1),
  })).min(3),
  screens: z.array(z.object({
    id: z.string(),
    route: z.string().startsWith('/'),
    file: z.string().describe('Expo Router file relative to app/, e.g. app/(tabs)/index.tsx'),
    title: z.string(),
    purpose: z.string(),
    features: z.array(z.string()).default([]),
    tab: z.boolean().default(false),
  })).min(2),
  journeys: z.array(z.object({ id: z.string(), title: z.string(), steps: z.array(z.string()).min(2) })).min(2),
  data: z.object({
    storage: z.enum(['local', 'cloud', 'hybrid', 'none']),
    backend: z.string().nullable().describe('Base URL / service of an existing backend (e.g. the Vercel app API), or null'),
    entities: z.array(z.object({ name: z.string(), fields: z.array(z.string()) })).default([]),
  }),
  accounts: z.object({
    required: z.boolean(),
    methods: z.array(z.enum(['email', 'apple', 'google', 'facebook', 'phone', 'anonymous'])).default([]),
    deletionInApp: z.boolean().describe('Guideline 5.1.1(v): must be true whenever accounts can be created'),
    demoAccount: z.object({ username: z.string(), password: z.string() }).optional(),
  }),
  monetization: z.object({
    model: z.enum(['free', 'paid', 'freemium-iap', 'subscription', 'ads']),
    products: z.array(z.object({
      productId: z.string(), type: z.enum(['consumable', 'non-consumable', 'auto-renewable', 'non-renewing']),
      price: z.string(), description: z.string(),
    })).default([]),
    restorePurchases: z.boolean().default(false),
  }),
  permissions: z.array(z.object({ key: Permission, reason: z.string().min(25) })).default([]),
  privacy: z.object({
    collectsData: z.boolean(),
    tracking: z.boolean().describe('Cross-app tracking (requires ATT prompt)'),
    thirdPartySdks: z.array(z.string()).default([]),
    dataTypes: z.array(z.object({
      type: PrivacyDataType,
      purposes: z.array(PrivacyPurpose).min(1),
      linkedToUser: z.boolean(),
      usedForTracking: z.boolean(),
    })).default([]),
  }),
  content: z.object({
    userGenerated: z.boolean().describe('UGC requires report/block/filter (Guideline 1.2)'),
    externalLinks: z.boolean().default(false),
    regulated: z.array(z.enum(['medical', 'financial', 'gambling', 'crypto', 'vpn', 'kids', 'alcohol', 'dating', 'none'])).default(['none']),
  }),
  design: z.object({
    primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    backgroundColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    textColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    tone: z.string(),
  }),
  nativeValue: z.array(z.string()).min(2).describe('Guideline 4.2: concrete reasons this is more than a repackaged website (native features, offline, widgets, haptics, notifications, etc.)'),
});
export type Spec = z.infer<typeof Spec>;

// ---------------------------------------------------------------------------
// Journeys / scenes — a tiny step DSL that runs on the web build (Playwright)
// AND compiles to Maestro flows for the native simulator.
// ---------------------------------------------------------------------------
export const Target = z.union([
  z.strictObject({ id: z.string() }).describe('testID on the RN element'),
  z.strictObject({ text: z.string() }).describe('Visible text (exact substring)'),
]);
export type Target = z.infer<typeof Target>;
export const Step = z.union([
  z.strictObject({ open: z.string().startsWith('/') }),
  z.strictObject({ tap: Target }),
  z.strictObject({ type: z.strictObject({ target: Target, text: z.string() }) }),
  z.strictObject({ expect: Target }),
  z.strictObject({ expectNot: Target }),
  z.strictObject({ back: z.literal(true) }),
  z.strictObject({ wait: z.number().int().min(0).max(10000) }),
  z.strictObject({ scroll: z.enum(['up', 'down']) }),
  z.strictObject({ screenshot: z.string() }),
]);
export type Step = z.infer<typeof Step>;

export const Journeys = z.object({
  journeys: z.array(z.object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    title: z.string(),
    critical: z.boolean().default(true),
    demo: z.boolean().default(true).describe('Start with ?farmDemo=1 (seeded demo data)'),
    steps: z.array(Step).min(2),
  })).min(2),
});
export type Journeys = z.infer<typeof Journeys>;

export const Shots = z.object({
  scenes: z.array(z.object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    caption: z.string().min(3).max(40),
    subcaption: z.string().max(60).optional(),
    demo: z.boolean().default(true),
    steps: z.array(Step).min(1),
  })).min(3).max(10),
  preview: z.object({
    steps: z.array(Step).min(4),
    stepDelayMs: z.number().int().min(300).max(5000).default(1400),
  }),
});
export type Shots = z.infer<typeof Shots>;

// ---------------------------------------------------------------------------
// Stage — listing (App Store metadata)
// ---------------------------------------------------------------------------
const AgeLevel = z.enum(['NONE', 'INFREQUENT_OR_MILD', 'FREQUENT_OR_INTENSE']);
export const Listing = z.object({
  locale: z.string().default('en-US'),
  name: z.string().min(2).max(30),
  subtitle: z.string().max(30),
  promotionalText: z.string().max(170),
  description: z.string().min(200).max(4000),
  keywords: z.string().max(100),
  whatsNew: z.string().max(4000).optional(),
  supportUrl: z.url(),
  marketingUrl: z.url().optional(),
  privacyPolicyUrl: z.url(),
  copyright: z.string().regex(/^\d{4} .+/),
  primaryCategory: AppStoreCategory,
  secondaryCategory: AppStoreCategory.optional(),
  review: z.object({
    notes: z.string().max(4000),
    demoAccountRequired: z.boolean(),
    demoAccountName: z.string().optional(),
    demoAccountPassword: z.string().optional(),
  }),
  /** Sent verbatim as ageRatingDeclaration attributes (App Store Connect API). Unknown keys are reported by the API. */
  ageRating: z.object({
    alcoholTobaccoOrDrugUseOrReferences: AgeLevel,
    contests: AgeLevel,
    gamblingSimulated: AgeLevel,
    horrorOrFearThemes: AgeLevel,
    matureOrSuggestiveThemes: AgeLevel,
    medicalOrTreatmentInformation: AgeLevel,
    profanityOrCrudeHumor: AgeLevel,
    sexualContentGraphicAndNudity: AgeLevel,
    sexualContentOrNudity: AgeLevel,
    violenceCartoonOrFantasy: AgeLevel,
    violenceRealistic: AgeLevel,
    violenceRealisticProlongedGraphicOrSadistic: AgeLevel,
    gambling: z.boolean(),
    unrestrictedWebAccess: z.boolean(),
  }).catchall(z.union([z.string(), z.boolean(), z.null()])),
  brand: z.object({
    background: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    backgroundEnd: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    text: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    font: z.string().default('-apple-system, "SF Pro Display", Inter, "Helvetica Neue", Arial, sans-serif'),
  }),
});
export type Listing = z.infer<typeof Listing>;

// ---------------------------------------------------------------------------
// Repo-level owner config (farm.config.json)
// ---------------------------------------------------------------------------
export const FarmConfig = z.object({
  owner: z.object({
    legalName: z.string(),
    displayName: z.string(),
    firstName: z.string(),
    lastName: z.string(),
    email: z.string(),
    phone: z.string(),
    country: z.string().default('US'),
    website: z.string().optional(),
  }),
  apple: z.object({
    teamId: z.string(),
    teamType: z.enum(['INDIVIDUAL', 'COMPANY_OR_ORGANIZATION']).default('INDIVIDUAL'),
    bundleIdPrefix: z.string(),
  }),
  legal: z.object({ baseUrl: z.string().describe('Where apps/*/site is deployed, e.g. https://app-farm-legal.vercel.app') }),
  expo: z.object({ owner: z.string().optional().describe('Expo account/org slug') }).default({}),
  defaults: z.object({ sdk: z.string().default('latest'), supportsTablet: z.boolean().default(false) }).default({ sdk: 'latest', supportsTablet: false }),
});
export type FarmConfig = z.infer<typeof FarmConfig>;

export const schemas = { brief: Brief, spec: Spec, journeys: Journeys, shots: Shots, listing: Listing, config: FarmConfig } as const;
export type SchemaName = keyof typeof schemas;

export function formatZodError(e: z.ZodError): string[] {
  return e.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`);
}
