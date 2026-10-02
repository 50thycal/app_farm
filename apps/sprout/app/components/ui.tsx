import * as Haptics from 'expo-haptics';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import type { ReactNode } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { useColorScheme } from '@/components/useColorScheme';
import { PLANT_TYPES, type PlantType } from '@/lib/plants';

export const palette = {
  light: { bg: '#F6FAF5', card: '#FFFFFF', text: '#14281D', muted: '#5F7266', line: '#E3ECE4', accent: '#2F9E5B', accentSoft: '#E2F3E8', warn: '#C2410C', warnSoft: '#FDEBDD', water: '#2B8CD6' },
  dark: { bg: '#0B130E', card: '#16211A', text: '#EAF4EC', muted: '#9AB0A1', line: '#243229', accent: '#4CC27E', accentSoft: '#1B3324', warn: '#FB923C', warnSoft: '#3A2416', water: '#5AB0F0' },
};
export function useTheme() {
  return palette[useColorScheme() === 'dark' ? 'dark' : 'light'];
}

const SYMBOLS = {
  drop: { ios: 'drop.fill', android: 'water_drop', web: 'water_drop' },
  leaf: { ios: 'leaf.fill', android: 'eco', web: 'eco' },
  flame: { ios: 'flame.fill', android: 'local_fire_department', web: 'local_fire_department' },
  calendar: { ios: 'calendar', android: 'calendar_month', web: 'calendar_month' },
  plus: { ios: 'plus', android: 'add', web: 'add' },
  check: { ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' },
  trash: { ios: 'trash', android: 'delete', web: 'delete' },
  pencil: { ios: 'pencil', android: 'edit', web: 'edit' },
  chevron: { ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' },
  minus: { ios: 'minus', android: 'remove', web: 'remove' },
  trophy: { ios: 'trophy.fill', android: 'emoji_events', web: 'emoji_events' },
} as const;
export type IconName = keyof typeof SYMBOLS;

export function Icon({ name, size = 20, color }: { name: IconName; size?: number; color: string }) {
  return <SymbolView name={SYMBOLS[name] as SymbolViewProps['name']} size={size} tintColor={color} />;
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  return <View style={[styles.card, { backgroundColor: t.card, borderColor: t.line }, style]}>{children}</View>;
}

export function PlantAvatar({ type, size = 48 }: { type: PlantType; size?: number }) {
  const meta = PLANT_TYPES[type];
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size * 0.32, backgroundColor: meta.tint + '22' }]}>
      <Text style={{ fontSize: size * 0.52 }}>{meta.emoji}</Text>
    </View>
  );
}

export function Pill({ label, tone = 'accent' }: { label: string; tone?: 'accent' | 'warn' | 'muted' }) {
  const t = useTheme();
  const bg = tone === 'warn' ? t.warnSoft : tone === 'accent' ? t.accentSoft : t.line;
  const fg = tone === 'warn' ? t.warn : tone === 'accent' ? t.accent : t.muted;
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <Text style={[styles.pillText, { color: fg }]}>{label}</Text>
    </View>
  );
}

export function Button({ label, onPress, icon, testID, variant = 'primary', style }: {
  label: string; onPress: () => void; icon?: IconName; testID?: string; variant?: 'primary' | 'secondary' | 'danger'; style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  const bg = variant === 'primary' ? t.accent : variant === 'danger' ? t.warnSoft : t.accentSoft;
  const fg = variant === 'primary' ? '#fff' : variant === 'danger' ? t.warn : t.accent;
  return (
    <Pressable accessibilityRole="button" testID={testID} onPress={onPress}
      style={({ pressed }) => [styles.button, { backgroundColor: bg, opacity: pressed ? 0.75 : 1 }, style]}>
      {icon ? <Icon name={icon} size={18} color={fg} /> : null}
      <Text style={[styles.buttonText, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  const t = useTheme();
  return <Text style={[styles.section, { color: t.muted }]}>{children}</Text>;
}

export function tapFeedback(kind: 'light' | 'success' = 'light') {
  if (Platform.OS === 'web') return;
  if (kind === 'success') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

/** Cross-platform destructive confirmation (Alert is a no-op on react-native-web). */
export function confirmDestructive(title: string, message: string, action: string): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(globalThis.confirm ? globalThis.confirm(`${title}\n\n${message}`) : true);
  return new Promise((resolve) =>
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: action, style: 'destructive', onPress: () => resolve(true) },
    ]));
}

const styles = StyleSheet.create({
  card: { borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, padding: 16 },
  avatar: { alignItems: 'center', justifyContent: 'center' },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, alignSelf: 'flex-start' },
  pillText: { fontSize: 13, fontWeight: '600' },
  button: { minHeight: 48, borderRadius: 14, paddingHorizontal: 18, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontSize: 17, fontWeight: '600' },
  section: { fontSize: 13, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', marginTop: 8, marginBottom: 8 },
});
