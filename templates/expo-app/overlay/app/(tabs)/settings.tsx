import Constants from 'expo-constants';
import * as StoreReview from 'expo-store-review';
import * as WebBrowser from 'expo-web-browser';
import { Alert, Linking, Pressable, ScrollView, StyleSheet } from 'react-native';

import { Text, View, useThemeColor } from '@/components/Themed';
import { deleteAccount } from '@/lib/farm/account';
import { farm } from '@/lib/farm/config';

function Row({ label, onPress, testID, destructive }: { label: string; onPress: () => void; testID: string; destructive?: boolean }) {
  const tint = useThemeColor({}, 'tint');
  return (
    <Pressable accessibilityRole="button" testID={testID} onPress={onPress} style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}>
      <Text style={[styles.rowLabel, { color: destructive ? '#d92d20' : tint }]}>{label}</Text>
    </Pressable>
  );
}

export default function SettingsScreen() {
  const version = `${Constants.expoConfig?.version ?? ''}`;

  const confirmDelete = () =>
    Alert.alert('Delete account?', 'This permanently deletes your account and all associated data. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteAccount() },
    ]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.section}>
        <Text style={styles.header}>Support</Text>
        <Row testID="settings-support" label="Help & Support" onPress={() => WebBrowser.openBrowserAsync(farm.supportUrl)} />
        <Row testID="settings-contact" label="Contact Us" onPress={() => Linking.openURL(`mailto:${farm.supportEmail}`)} />
        <Row testID="settings-rate" label="Rate the App" onPress={() => StoreReview.requestReview()} />
      </View>
      <View style={styles.section}>
        <Text style={styles.header}>Legal</Text>
        <Row testID="settings-privacy" label="Privacy Policy" onPress={() => WebBrowser.openBrowserAsync(farm.privacyUrl)} />
        <Row testID="settings-terms" label="Terms of Use" onPress={() => WebBrowser.openBrowserAsync(farm.termsUrl)} />
      </View>
      {farm.accounts ? (
        <View style={styles.section}>
          <Text style={styles.header}>Account</Text>
          <Row testID="delete-account" label="Delete Account" destructive onPress={confirmDelete} />
        </View>
      ) : null}
      <Text style={styles.version} testID="settings-version">
        {farm.appName} {version}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 24 },
  section: { gap: 4 },
  header: { fontSize: 13, opacity: 0.6, textTransform: 'uppercase', marginBottom: 4 },
  row: { paddingVertical: 14, minHeight: 44, justifyContent: 'center' },
  rowLabel: { fontSize: 17 },
  version: { textAlign: 'center', opacity: 0.5, fontSize: 13 },
});
