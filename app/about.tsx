import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, BorderRadius, FontSize, Spacing } from '@/app/lib/theme';

export default function AboutScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>About SpotMe</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.logoSection}>
          <View style={styles.logoCircle}><MaterialIcons name="volunteer-activism" size={48} color={Colors.primary} /></View>
          <Text style={styles.appName}>SpotMe</Text>
          <Text style={styles.tagline}>No tragedy. Just life.</Text>
          <Text style={styles.version}>Version 1.1.0</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Our Mission</Text>
          <Text style={styles.cardText}>SpotMe is a micro-giving platform designed for everyday needs — not emergencies or large fundraisers. We believe everyone deserves a little help sometimes, whether it's groceries, a bus pass, school supplies, or a utility bill. SpotMe connects people who need a small spot with people who want to give one.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>How It Works</Text>
          <Text style={styles.cardText}>1. Post a Need — Describe what you need help with (up to $300).</Text>
          <Text style={styles.cardText}>2. Get Spotted — Community members contribute any amount toward your goal.</Text>
          <Text style={styles.cardText}>3. Goal Met — Once your need is funded, request a payout directly to your bank.</Text>
          <Text style={styles.cardText}>4. Say Thanks — Post a thank-you update to show your gratitude.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Platform Details</Text>
          <View style={styles.detailRow}><Text style={styles.detailLabel}>Max goal per need</Text><Text style={styles.detailValue}>$300</Text></View>
          <View style={styles.detailRow}><Text style={styles.detailLabel}>Active needs per user</Text><Text style={styles.detailValue}>4 at a time</Text></View>
          <View style={styles.detailRow}><Text style={styles.detailLabel}>Platform fee</Text><Text style={[styles.detailValue, { color: '#5CB85C' }]}>None (tips optional)</Text></View>

          <View style={styles.detailRow}><Text style={styles.detailLabel}>Payments powered by</Text><Text style={styles.detailValue}>Stripe Connect</Text></View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Contact Us</Text>
          <TouchableOpacity style={styles.contactRow} onPress={() => Linking.openURL('mailto:hellospotme.app@gmail.com')}>
            <MaterialIcons name="email" size={20} color={Colors.primary} />
            <Text style={styles.contactText}>hellospotme.app@gmail.com</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.copyright}>© 2026 SpotMe. All rights reserved.</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.text },
  content: { padding: Spacing.md, paddingBottom: 40 },
  logoSection: { alignItems: 'center', marginBottom: 24 },
  logoCircle: { width: 88, height: 88, borderRadius: 44, backgroundColor: Colors.primary + '15', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  appName: { fontSize: 28, fontWeight: '800', color: Colors.text },
  tagline: { fontSize: 15, color: Colors.textSecondary, fontStyle: 'italic', marginTop: 4 },
  version: { fontSize: 13, color: Colors.textLight, marginTop: 4 },
  card: { backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: 16, borderWidth: 1, borderColor: Colors.border },
  cardTitle: { fontSize: 17, fontWeight: '700', color: Colors.text, marginBottom: 10 },
  cardText: { fontSize: 14, color: Colors.textSecondary, lineHeight: 22, marginBottom: 6 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  detailLabel: { fontSize: 14, color: Colors.textSecondary },
  detailValue: { fontSize: 14, fontWeight: '600', color: Colors.text },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  contactText: { fontSize: 14, color: Colors.primary, fontWeight: '600' },
  copyright: { textAlign: 'center', fontSize: 12, color: Colors.textLight, marginTop: 16 },
});
