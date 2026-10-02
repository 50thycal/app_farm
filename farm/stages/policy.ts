/**
 * App Review policy rules that can be decided from the spec alone, before any code exists.
 * Catching these at spec time is far cheaper than a rejection two weeks later.
 */
import { Checks } from '../lib/state.ts';
import type { Spec } from '../schemas/index.ts';

const THIRD_PARTY_LOGIN = ['google', 'facebook'] as const;

export function specPolicyChecks(spec: Spec): Checks {
  const c = new Checks();
  const mvp = spec.features.filter((f) => f.priority === 'mvp');

  c.expect(mvp.length >= 3, 'spec.min-functionality', `${mvp.length} MVP features`,
    `Only ${mvp.length} MVP features — high risk of "minimum functionality" rejection`, '4.2', 'fail');
  c.expect(spec.nativeValue.length >= 2, 'spec.native-value', 'Native value articulated',
    'Explain why this is more than a website (4.2 / 4.2.2)', '4.2');

  if (spec.accounts.required || spec.accounts.methods.some((m) => m !== 'anonymous')) {
    c.expect(spec.accounts.deletionInApp, 'spec.account-deletion', 'In-app account deletion planned',
      'Apps that allow account creation must offer in-app account deletion', '5.1.1(v)');
    c.expect(!!spec.accounts.demoAccount, 'spec.demo-account', 'Demo account defined for App Review',
      'Provide a demo account (or a no-login demo mode) for App Review', '2.1', 'warn');
    if (spec.accounts.required)
      c.warn('spec.login-wall', 'Login is required up-front. Apple prefers letting users use non-account features first', '5.1.1');
  }
  if (spec.accounts.methods.some((m) => (THIRD_PARTY_LOGIN as readonly string[]).includes(m)))
    c.expect(spec.accounts.methods.includes('apple'), 'spec.siwa', 'Sign in with Apple offered alongside third-party login',
      'Third-party/social login requires an equivalent privacy-focused option — offer Sign in with Apple', '4.8');

  const m = spec.monetization;
  if (m.model === 'freemium-iap' || m.model === 'subscription') {
    c.expect(m.products.length > 0, 'spec.iap-products', 'IAP products defined', 'Paid features require StoreKit IAP products', '3.1.1');
    c.expect(m.restorePurchases, 'spec.restore', 'Restore Purchases planned', 'Non-consumables/subscriptions need a Restore Purchases button', '3.1.1');
  }
  if (m.model === 'subscription')
    c.warn('spec.sub-disclosure', 'Subscription screens must show price, period, auto-renew terms + links to Terms (EULA) and Privacy', '3.1.2');

  for (const p of spec.permissions) {
    const vague = /^(this app|we) (needs|need|requires|would like)|access (to )?your \w+\.?$/i.test(p.reason.trim());
    c.expect(!vague, `spec.permission.${p.key}`, `${p.key}: purpose string is specific`,
      `${p.key}: purpose string is vague ("${p.reason}"). Say exactly what feature uses it and why`, '5.1.1(ii)');
  }
  if (spec.privacy.tracking) {
    c.expect(spec.permissions.some((p) => p.key === 'tracking'), 'spec.att', 'ATT permission declared',
      'Tracking declared but no App Tracking Transparency permission', '5.1.2');
  }
  if (spec.privacy.collectsData)
    c.expect(spec.privacy.dataTypes.length > 0, 'spec.privacy-types', 'Privacy data types listed',
      'collectsData=true but no dataTypes — the App Privacy label would be wrong', '5.1.2');

  if (spec.content.userGenerated)
    c.expect(spec.features.some((f) => /report|block|moderat|filter/i.test(f.title + f.description)),
      'spec.ugc', 'UGC moderation features present', 'UGC apps need: filter objectionable content, report, block users, contact info', '1.2');

  const regulated = spec.content.regulated.filter((r) => r !== 'none');
  if (regulated.length)
    c.warn('spec.regulated', `Regulated area(s): ${regulated.join(', ')} — extra review scrutiny, may require an Organization account and licenses`, '1.4 / 3.2.1 / 5.1.1(ix)');
  if (spec.content.regulated.includes('kids'))
    c.warn('spec.kids', 'Kids Category: no third-party analytics/ads, parental gate for links & purchases', '1.3 / 5.1.4');

  if (spec.app.supportsTablet)
    c.warn('spec.ipad', 'supportsTablet=true → iPad layouts, iPad screenshots (13") and iPad review are required. Use false unless intentional', '2.4.1');

  const tabRoutes = spec.screens.filter((s) => s.tab).length;
  c.expect(tabRoutes <= 5, 'spec.tabs', `${tabRoutes} tabs`, 'More than 5 tabs violates the HIG tab bar pattern', 'HIG', 'warn');
  c.expect(spec.screens.some((s) => /setting|profile|account|about/i.test(s.id + s.title)), 'spec.settings-screen',
    'Settings/About screen present (privacy policy link, support, deletion)',
    'Add a Settings/About screen: in-app privacy policy link is required', '5.1.1(i)');

  if (spec.data.storage === 'none' && spec.features.length < 5)
    c.warn('spec.thin', 'No persistence and few features — make sure the core loop is substantial', '4.2');
  return c;
}
