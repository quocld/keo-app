import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Brand } from '@/constants/brand';
import { useAuth } from '@/contexts/auth-context';

export default function SettingsScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Cài đặt</Text>
      {user && (
        <View style={styles.card}>
          <Text style={styles.label}>Email</Text>
          <Text style={styles.value}>{user.email}</Text>
          <Text style={[styles.label, styles.labelSpaced]}>Vai trò</Text>
          <Text style={styles.value}>{user.role}</Text>
        </View>
      )}
      <Pressable
        accessibilityRole="button"
        onPress={() => signOut().then(() => router.replace('/(auth)/login'))}
        style={({ pressed }) => [styles.logout, pressed && { opacity: 0.9 }]}>
        <Text style={styles.logoutText}>Đăng xuất</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Brand.surface,
    padding: 24,
    paddingTop: 56,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: Brand.ink,
    marginBottom: 24,
  },
  card: {
    backgroundColor: Brand.surfaceQuiet,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: Brand.inkMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  labelSpaced: {
    marginTop: 16,
  },
  value: {
    fontSize: 17,
    color: Brand.ink,
    marginTop: 4,
    textTransform: 'capitalize',
  },
  logout: {
    backgroundColor: Brand.forest,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  logoutText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
