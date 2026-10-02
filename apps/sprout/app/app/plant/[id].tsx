import { router, Stack, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, Card, Icon, PlantAvatar, Pill, SectionTitle, confirmDestructive, tapFeedback, useTheme } from '@/components/ui';
import { dayKey, relativeDay, longDate } from '@/lib/dates';
import { PLANT_TYPES, dueLabel, isDue, lastWatered, nextDue } from '@/lib/plants';
import { usePlants } from '@/lib/store';

export default function PlantDetail() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getPlant, water, deletePlant } = usePlants();
  const plant = getPlant(String(id));
  const today = dayKey();

  if (!plant) {
    return (
      <View style={[styles.missing, { backgroundColor: t.bg }]}>
        <Stack.Screen options={{ title: 'Plant' }} />
        <Text style={{ color: t.muted, fontSize: 16 }}>This plant no longer exists.</Text>
      </View>
    );
  }
  const due = isDue(plant, today);
  const last = lastWatered(plant);

  const onDelete = async () => {
    if (await confirmDestructive(`Delete ${plant.name}?`, 'Its watering history will be removed.', 'Delete')) {
      await deletePlant(plant.id);
      router.back();
    }
  };

  return (
    <ScrollView style={{ backgroundColor: t.bg }} contentContainerStyle={styles.container} testID="plant-detail">
      <Stack.Screen options={{ title: plant.name, headerStyle: { backgroundColor: t.bg }, headerTintColor: t.accent, headerTitleStyle: { color: t.text } }} />
      <View style={styles.hero}>
        <PlantAvatar type={plant.type} size={88} />
        <Text style={[styles.name, { color: t.text }]}>{plant.name}</Text>
        <Text style={[styles.sub, { color: t.muted }]}>{PLANT_TYPES[plant.type].label} · {plant.room}</Text>
        <View style={{ alignItems: 'center' }}><Pill label={dueLabel(plant, today)} tone={due ? 'warn' : 'accent'} /></View>
      </View>

      <View style={styles.stats}>
        <Card style={styles.stat}>
          <Icon name="calendar" color={t.accent} />
          <Text style={[styles.statValue, { color: t.text }]} testID="next-due">{relativeDay(nextDue(plant), today)}</Text>
          <Text style={[styles.statLabel, { color: t.muted }]}>Next watering</Text>
        </Card>
        <Card style={styles.stat}>
          <Icon name="drop" color={t.water} />
          <Text style={[styles.statValue, { color: t.text }]}>Every {plant.intervalDays}d</Text>
          <Text style={[styles.statLabel, { color: t.muted }]}>Schedule</Text>
        </Card>
      </View>

      {last !== today ? (
        <Button testID="water-now" label="Water now" icon="drop" onPress={() => { tapFeedback('success'); water(plant.id); }} />
      ) : (
        <Card style={styles.done}><Icon name="check" color={t.accent} /><Text style={{ color: t.text, fontSize: 16, fontWeight: '600' }}>Watered today</Text></Card>
      )}

      <View>
        <SectionTitle>History</SectionTitle>
        <Card style={{ paddingVertical: 4 }} >
          {plant.waterings.length === 0 ? (
            <Text style={[styles.historyText, { color: t.muted, paddingVertical: 12 }]}>No waterings logged yet.</Text>
          ) : (
            plant.waterings.slice(0, 12).map((d, i) => (
              <View key={d + i} testID={i === 0 ? 'history-latest' : undefined}
                style={[styles.history, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.line }]}>
                <Icon name="drop" size={16} color={t.water} />
                <Text style={[styles.historyText, { color: t.text }]}>{longDate(d)}</Text>
              </View>
            ))
          )}
        </Card>
      </View>

      <View style={styles.actions}>
        <Button testID="edit-plant" variant="secondary" icon="pencil" label="Edit" style={{ flex: 1 }}
          onPress={() => router.push({ pathname: '/plant/new', params: { id: plant.id } })} />
        <Button testID="delete-plant" variant="danger" icon="trash" label="Delete" style={{ flex: 1 }} onPress={onDelete} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { padding: 16, gap: 18, paddingBottom: 48 },
  hero: { alignItems: 'center', gap: 8, marginTop: 8 },
  name: { fontSize: 28, fontWeight: '800', textAlign: 'center' },
  sub: { fontSize: 15 },
  stats: { flexDirection: 'row', gap: 12 },
  stat: { flex: 1, gap: 6 },
  statValue: { fontSize: 20, fontWeight: '700' },
  statLabel: { fontSize: 13 },
  done: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  history: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  historyText: { fontSize: 15 },
  actions: { flexDirection: 'row', gap: 12 },
});
