import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PlantRow } from '@/components/PlantRow';
import { Button, Card, Icon, SectionTitle, useTheme } from '@/components/ui';
import { dayKey, longDate } from '@/lib/dates';
import { daysUntilDue, dueLabel, isDue, sortByUrgency } from '@/lib/plants';
import { usePlants } from '@/lib/store';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

export default function TodayScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { plants, streak, water, ready } = usePlants();
  const today = dayKey();
  const sorted = sortByUrgency(plants, today);
  const due = sorted.filter((p) => isDue(p, today));
  const next = sorted.filter((p) => !isDue(p, today) && daysUntilDue(p, today) > 0).slice(0, 3);

  if (!ready) return <View style={[styles.fill, { backgroundColor: t.bg }]} />;

  return (
    <ScrollView style={{ backgroundColor: t.bg }} contentContainerStyle={[styles.container, { paddingTop: insets.top + 20 }]} testID="today-screen">
      <View>
        <Text style={[styles.date, { color: t.muted }]}>{longDate(today)}</Text>
        <Text style={[styles.hello, { color: t.text }]}>{greeting()}</Text>
      </View>

      <Card style={styles.streakCard}>
        <View style={[styles.streakIcon, { backgroundColor: t.warnSoft }]}>
          <Icon name="flame" size={26} color={t.warn} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.streakNumber, { color: t.text }]} testID="streak-count">
            {streak.current} day{streak.current === 1 ? '' : 's'}
          </Text>
          <Text style={[styles.streakLabel, { color: t.muted }]}>Care streak · best {streak.best}</Text>
        </View>
        <View style={styles.dueBadge}>
          <Text style={[styles.dueNumber, { color: due.length ? t.water : t.accent }]} testID="due-count">{due.length}</Text>
          <Text style={[styles.streakLabel, { color: t.muted }]}>to water</Text>
        </View>
      </Card>

      {plants.length === 0 ? (
        <Card style={styles.empty}>
          <Text style={styles.emptyEmoji}>🪴</Text>
          <Text style={[styles.emptyTitle, { color: t.text }]}>Start your jungle</Text>
          <Text style={[styles.emptyBody, { color: t.muted }]}>Add your first plant and Sprout will tell you exactly when it needs water.</Text>
          <Button testID="empty-add-plant" label="Add your first plant" icon="plus" onPress={() => router.push('/plant/new')} />
        </Card>
      ) : due.length === 0 ? (
        <Card style={styles.empty} >
          <Icon name="check" size={44} color={t.accent} />
          <Text style={[styles.emptyTitle, { color: t.text }]} testID="all-done">All plants are happy</Text>
          <Text style={[styles.emptyBody, { color: t.muted }]}>
            {next[0] ? `Next up: ${next[0].name} — ${dueLabel(next[0], today).toLowerCase()}.` : 'Nothing to water right now.'}
          </Text>
        </Card>
      ) : (
        <View style={styles.list}>
          <SectionTitle>Needs water</SectionTitle>
          {due.map((p) => <PlantRow key={p.id} plant={p} onWater={() => water(p.id)} />)}
        </View>
      )}

      {next.length > 0 && due.length > 0 ? (
        <View style={styles.list}>
          <SectionTitle>Coming up</SectionTitle>
          {next.map((p) => <PlantRow key={p.id} plant={p} />)}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  container: { padding: 16, gap: 16, paddingBottom: 40 },
  date: { fontSize: 15, fontWeight: '500' },
  hello: { fontSize: 30, fontWeight: '800', letterSpacing: -0.5 },
  streakCard: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  streakIcon: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  streakNumber: { fontSize: 22, fontWeight: '800' },
  streakLabel: { fontSize: 13, fontWeight: '500' },
  dueBadge: { alignItems: 'center', minWidth: 60 },
  dueNumber: { fontSize: 26, fontWeight: '800' },
  list: { gap: 10 },
  empty: { alignItems: 'center', gap: 10, paddingVertical: 28 },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { fontSize: 20, fontWeight: '700' },
  emptyBody: { fontSize: 15, textAlign: 'center', lineHeight: 21, marginBottom: 8 },
});
