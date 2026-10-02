import { StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';

// FARM_PLACEHOLDER — the build stage replaces this screen with the real home screen.
// Preflight fails while this marker exists anywhere in the app.
export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Home</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: 'bold' },
});
