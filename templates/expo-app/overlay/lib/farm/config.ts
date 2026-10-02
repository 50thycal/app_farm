import Constants from 'expo-constants';

/** Values injected by the farm scaffolder into app.json → expo.extra.farm. */
type FarmExtra = {
  appName: string;
  privacyUrl: string;
  termsUrl: string;
  supportUrl: string;
  supportEmail: string;
  accounts: boolean;
};

const extra = (Constants.expoConfig?.extra?.farm ?? {}) as Partial<FarmExtra>;

export const farm: FarmExtra = {
  appName: extra.appName ?? Constants.expoConfig?.name ?? '',
  privacyUrl: extra.privacyUrl ?? '',
  termsUrl: extra.termsUrl ?? '',
  supportUrl: extra.supportUrl ?? '',
  supportEmail: extra.supportEmail ?? '',
  accounts: extra.accounts ?? false,
};
