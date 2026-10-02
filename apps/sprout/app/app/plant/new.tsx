import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button, Icon, SectionTitle, tapFeedback, useTheme } from '@/components/ui';
import { PLANT_TYPES, ROOMS, type PlantType } from '@/lib/plants';
import { usePlants } from '@/lib/store';

function Chip({ label, selected, onPress, testID }: { label: string; selected: boolean; onPress: () => void; testID: string }) {
  const t = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected }} testID={testID} onPress={onPress}
      style={[styles.chip, { backgroundColor: selected ? t.accent : t.card, borderColor: selected ? t.accent : t.line }]}>
      <Text style={[styles.chipText, { color: selected ? '#fff' : t.text }]}>{label}</Text>
    </Pressable>
  );
}

export default function PlantForm() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { getPlant, savePlant } = usePlants();
  const existing = id ? getPlant(String(id)) : undefined;

  const [name, setName] = useState(existing?.name ?? '');
  const [room, setRoom] = useState<string>(existing?.room ?? ROOMS[0]);
  const [type, setType] = useState<PlantType>(existing?.type ?? 'tropical');
  const [interval, setInterval] = useState(existing?.intervalDays ?? PLANT_TYPES.tropical.interval);
  const [error, setError] = useState('');

  const pickType = (k: PlantType) => {
    setType(k);
    setInterval(PLANT_TYPES[k].interval);
    tapFeedback();
  };
  const step = (d: number) => {
    setInterval((v) => Math.min(60, Math.max(1, v + d)));
    tapFeedback();
  };
  const save = async () => {
    if (!name.trim()) return setError('Give your plant a name');
    const p = await savePlant({ id: existing?.id, name: name.trim(), room, type, intervalDays: interval });
    tapFeedback('success');
    if (existing) router.back();
    else router.replace({ pathname: '/plant/[id]', params: { id: p.id } });
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: existing ? 'Edit Plant' : 'Add Plant' }} />
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" testID="plant-form">
        <SectionTitle>Name</SectionTitle>
        <TextInput testID="plant-name" value={name} onChangeText={(v) => { setName(v); setError(''); }} placeholder="e.g. Monstera by the window"
          placeholderTextColor={t.muted} autoFocus={!existing} returnKeyType="done"
          style={[styles.input, { color: t.text, backgroundColor: t.card, borderColor: error ? t.warn : t.line }]} />
        {error ? <Text style={{ color: t.warn, marginTop: 6 }} testID="name-error">{error}</Text> : null}

        <SectionTitle>Room</SectionTitle>
        <View style={styles.chips}>
          {ROOMS.map((r) => <Chip key={r} label={r} selected={room === r} onPress={() => setRoom(r)} testID={`room-${r.toLowerCase().replace(/\s+/g, '-')}`} />)}
        </View>

        <SectionTitle>Plant type</SectionTitle>
        <View style={styles.chips}>
          {(Object.keys(PLANT_TYPES) as PlantType[]).map((k) => (
            <Chip key={k} label={`${PLANT_TYPES[k].emoji} ${PLANT_TYPES[k].label}`} selected={type === k} onPress={() => pickType(k)} testID={`type-${k}`} />
          ))}
        </View>

        <SectionTitle>Water every</SectionTitle>
        <View style={[styles.stepper, { backgroundColor: t.card, borderColor: t.line }]}>
          <Pressable accessibilityRole="button" accessibilityLabel="Fewer days" testID="interval-minus" onPress={() => step(-1)} style={styles.stepBtn}>
            <Icon name="minus" color={t.accent} size={22} />
          </Pressable>
          <Text style={[styles.stepValue, { color: t.text }]} testID="interval-value">{interval} day{interval === 1 ? '' : 's'}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="More days" testID="interval-plus" onPress={() => step(1)} style={styles.stepBtn}>
            <Icon name="plus" color={t.accent} size={22} />
          </Pressable>
        </View>
        <Text style={[styles.hint, { color: t.muted }]}>
          {PLANT_TYPES[type].label} plants usually need water every {PLANT_TYPES[type].interval} days. Adjust for your light and pot size.
        </Text>

        <Button testID="save-plant" label={existing ? 'Save changes' : 'Add plant'} icon="check" onPress={save} style={{ marginTop: 20 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 48 },
  input: { fontSize: 17, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, minHeight: 50 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, minHeight: 40, justifyContent: 'center', borderRadius: 999, borderWidth: 1 },
  chipText: { fontSize: 15, fontWeight: '500' },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 14, borderWidth: 1, padding: 4 },
  stepBtn: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  stepValue: { fontSize: 20, fontWeight: '700' },
  hint: { fontSize: 14, marginTop: 8, lineHeight: 20 },
});
