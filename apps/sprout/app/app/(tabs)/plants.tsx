import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { PlantRow } from '@/components/PlantRow';
import { Button, Icon, SectionTitle, useTheme } from '@/components/ui';
import { ROOMS } from '@/lib/plants';
import { usePlants } from '@/lib/store';

export default function PlantsScreen() {
  const t = useTheme();
  const { plants } = usePlants();
  const rooms = [...new Set([...ROOMS, ...plants.map((p) => p.room)])].filter((r) => plants.some((p) => p.room === r));

  return (
    <View style={[styles.fill, { backgroundColor: t.bg }]}>
      <ScrollView contentContainerStyle={styles.container} testID="plants-screen">
        <Text style={[styles.count, { color: t.muted }]}>
          {plants.length} plant{plants.length === 1 ? '' : 's'} in {rooms.length} room{rooms.length === 1 ? '' : 's'}
        </Text>
        {plants.length === 0 ? (
          <View style={styles.empty}>
            <Text style={[styles.emptyText, { color: t.muted }]}>No plants yet. Add one to get watering reminders on your Today screen.</Text>
            <Button testID="plants-empty-add" label="Add a plant" icon="plus" onPress={() => router.push('/plant/new')} />
          </View>
        ) : (
          rooms.map((room) => (
            <View key={room} style={styles.group}>
              <SectionTitle>{room}</SectionTitle>
              {plants.filter((p) => p.room === room).sort((a, b) => a.name.localeCompare(b.name)).map((p) => <PlantRow key={p.id} plant={p} />)}
            </View>
          ))
        )}
      </ScrollView>
      <Pressable accessibilityRole="button" accessibilityLabel="Add plant" testID="add-plant" onPress={() => router.push('/plant/new')}
        style={({ pressed }) => [styles.fab, { backgroundColor: t.accent, opacity: pressed ? 0.8 : 1 }]}>
        <Icon name="plus" size={26} color="#fff" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  container: { padding: 16, gap: 8, paddingBottom: 110 },
  count: { fontSize: 15, fontWeight: '500' },
  group: { gap: 10, marginTop: 8 },
  empty: { gap: 16, marginTop: 40, alignItems: 'center' },
  emptyText: { fontSize: 16, textAlign: 'center', lineHeight: 22 },
  fab: { position: 'absolute', right: 20, bottom: 24, width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
});
