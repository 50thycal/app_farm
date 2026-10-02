import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon, PlantAvatar, Pill, tapFeedback, useTheme } from '@/components/ui';
import { daysUntilDue, dueLabel, isDue, type Plant } from '@/lib/plants';

export function PlantRow({ plant, onWater }: { plant: Plant; onWater?: () => void }) {
  const t = useTheme();
  const n = daysUntilDue(plant);
  const due = isDue(plant);
  return (
    <View style={[styles.row, { backgroundColor: t.card, borderColor: t.line }]}>
      <Link href={{ pathname: '/plant/[id]', params: { id: plant.id } }} asChild>
        <Pressable accessibilityRole="button" testID={`plant-${plant.id}`} style={styles.main}>
          <PlantAvatar type={plant.type} />
          <View style={styles.text}>
            <Text numberOfLines={1} style={[styles.name, { color: t.text }]}>{plant.name}</Text>
            <View style={styles.meta}>
              <Pill label={dueLabel(plant)} tone={due && n < 0 ? 'warn' : due ? 'accent' : 'muted'} />
              <Text style={[styles.room, { color: t.muted }]} numberOfLines={1}>{plant.room}</Text>
            </View>
          </View>
        </Pressable>
      </Link>
      {onWater && due ? (
        <Pressable accessibilityRole="button" accessibilityLabel={`Water ${plant.name}`} testID={`water-${plant.id}`}
          onPress={() => { tapFeedback('success'); onWater(); }}
          style={({ pressed }) => [styles.water, { backgroundColor: t.water, opacity: pressed ? 0.7 : 1 }]}>
          <Icon name="drop" size={18} color="#fff" />
          <Text style={styles.waterText}>Water</Text>
        </Pressable>
      ) : (
        <Icon name="chevron" size={16} color={t.muted} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, paddingRight: 14, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 },
  text: { flex: 1, gap: 6 },
  name: { fontSize: 17, fontWeight: '600' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  room: { fontSize: 13, flexShrink: 1 },
  water: { flexDirection: 'row', gap: 6, alignItems: 'center', paddingHorizontal: 14, minHeight: 44, borderRadius: 14 },
  waterText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
