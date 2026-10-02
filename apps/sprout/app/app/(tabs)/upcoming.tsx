import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Card, PlantAvatar, SectionTitle, useTheme } from '@/components/ui';
import { addDays, dayKey, relativeDay } from '@/lib/dates';
import { isDue, nextDue, type Plant } from '@/lib/plants';
import { usePlants } from '@/lib/store';

export default function UpcomingScreen() {
  const t = useTheme();
  const { plants } = usePlants();
  const today = dayKey();
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i)).map((day, i) => ({
    day,
    plants: plants.filter((p: Plant) => (i === 0 ? isDue(p, today) : nextDue(p) === day && !isDue(p, today))),
  })).filter((d) => d.plants.length > 0);
  const total = days.reduce((n, d) => n + d.plants.length, 0);

  return (
    <ScrollView style={{ backgroundColor: t.bg }} contentContainerStyle={styles.container} testID="upcoming-screen">
      <Text style={[styles.summary, { color: t.muted }]}>
        {total} watering{total === 1 ? '' : 's'} over the next 7 days
      </Text>
      {days.length === 0 ? (
        <Card><Text style={{ color: t.muted, fontSize: 16 }}>Nothing due this week. Enjoy the green.</Text></Card>
      ) : (
        days.map((d) => (
          <View key={d.day} style={styles.day} testID={`day-${d.day}`}>
            <SectionTitle>{relativeDay(d.day, today)}</SectionTitle>
            <Card style={styles.card}>
              {d.plants.map((p, i) => (
                <View key={p.id} style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.line }]}>
                  <PlantAvatar type={p.type} size={40} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.name, { color: t.text }]}>{p.name}</Text>
                    <Text style={[styles.room, { color: t.muted }]}>{p.room} · every {p.intervalDays} days</Text>
                  </View>
                </View>
              ))}
            </Card>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 8, paddingBottom: 40 },
  summary: { fontSize: 15, fontWeight: '500' },
  day: { marginTop: 6 },
  card: { paddingVertical: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  name: { fontSize: 16, fontWeight: '600' },
  room: { fontSize: 13, marginTop: 2 },
});
