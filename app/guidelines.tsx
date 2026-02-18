import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, BorderRadius, FontSize, Spacing, Shadow } from '@/app/lib/theme';
import { COMMUNITY_GUIDELINES } from '@/app/lib/data';

const GUIDELINE_ICONS = [
  'verified-user',
  'favorite',
  'attach-money',
  'replay',
  'security',
  'flag',
  'do-not-disturb',
  'volunteer-activism',
];

export default function GuidelinesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="close" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Community Guidelines</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <MaterialIcons name="shield" size={40} color={Colors.primary} />
          </View>
          <Text style={styles.heroTitle}>Building Trust Together</Text>
          <Text style={styles.heroSubtitle}>
            SpotMe is built on mutual respect and honesty. These guidelines help keep our community safe, supportive, and genuine.
          </Text>
        </View>

        {/* Guidelines */}
        {COMMUNITY_GUIDELINES.map((guideline, index) => (
          <View key={index} style={styles.guidelineCard}>
            <View style={styles.guidelineHeader}>
              <View style={[styles.guidelineIcon, { backgroundColor: Colors.primary + '15' }]}>
                <MaterialIcons
                  name={GUIDELINE_ICONS[index] as any}
                  size={24}
                  color={Colors.primary}
                />
              </View>
              <Text style={styles.guidelineNumber}>{index + 1}</Text>
            </View>
            <Text style={styles.guidelineTitle}>{guideline.title}</Text>
            <Text style={styles.guidelineDescription}>{guideline.description}</Text>
          </View>
        ))}

        {/* Limits Section */}
        <View style={styles.limitsSection}>
          <Text style={styles.limitsTitle}>Platform Limits</Text>
          <View style={styles.limitRow}>
            <MaterialIcons name="attach-money" size={20} color={Colors.accent} />
            <View style={styles.limitContent}>
              <Text style={styles.limitLabel}>Maximum goal amount</Text>
              <Text style={styles.limitValue}>$300</Text>
            </View>
          </View>
          <View style={styles.limitRow}>
            <MaterialIcons name="timer" size={20} color={Colors.accent} />
            <View style={styles.limitContent}>
              <Text style={styles.limitLabel}>Need duration</Text>
              <Text style={styles.limitValue}>14 days</Text>
            </View>
          </View>
          <View style={styles.limitRow}>
            <MaterialIcons name="post-add" size={20} color={Colors.accent} />
            <View style={styles.limitContent}>
              <Text style={styles.limitLabel}>Active needs per user</Text>
              <Text style={styles.limitValue}>1 at a time</Text>
            </View>
          </View>
          <View style={styles.limitRow}>
            <MaterialIcons name="percent" size={20} color={Colors.accent} />
            <View style={styles.limitContent}>
              <Text style={styles.limitLabel}>Platform fee</Text>
              <Text style={styles.limitValue}>5% on contributions</Text>
            </View>
          </View>
        </View>

        {/* Enforcement */}
        <View style={styles.enforcementCard}>
          <MaterialIcons name="gavel" size={24} color={Colors.error} />
          <Text style={styles.enforcementTitle}>Enforcement</Text>
          <Text style={styles.enforcementText}>
            Violations of these guidelines may result in content removal, account suspension, or permanent ban. We review all reports within 24 hours and take appropriate action to protect our community.
          </Text>
        </View>

        {/* CTA */}
        <View style={styles.ctaSection}>
          <Text style={styles.ctaText}>
            Questions about our guidelines?
          </Text>
          <TouchableOpacity style={styles.ctaButton} onPress={() => router.back()}>
            <MaterialIcons name="chat" size={18} color={Colors.white} />
            <Text style={styles.ctaButtonText}>Contact Support</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: FontSize.lg,
    fontWeight: '800',
    color: Colors.text,
  },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
  },
  hero: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
    gap: Spacing.md,
  },
  heroIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  heroTitle: {
    fontSize: FontSize.xxl,
    fontWeight: '900',
    color: Colors.text,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: Spacing.md,
  },
  guidelineCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    marginBottom: Spacing.md,
    ...Shadow.sm,
  },
  guidelineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  guidelineIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guidelineNumber: {
    fontSize: FontSize.xxl,
    fontWeight: '900',
    color: Colors.borderLight,
  },
  guidelineTitle: {
    fontSize: FontSize.lg,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  guidelineDescription: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  limitsSection: {
    backgroundColor: Colors.accentLight,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    marginTop: Spacing.lg,
    marginBottom: Spacing.lg,
    gap: Spacing.lg,
  },
  limitsTitle: {
    fontSize: FontSize.lg,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  limitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  limitContent: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  limitLabel: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
  },
  limitValue: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.text,
  },
  enforcementCard: {
    backgroundColor: Colors.error + '08',
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.error + '20',
    marginBottom: Spacing.xl,
  },
  enforcementTitle: {
    fontSize: FontSize.lg,
    fontWeight: '800',
    color: Colors.error,
  },
  enforcementText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  ctaSection: {
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.xxl,
  },
  ctaText: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
    ...Shadow.md,
  },
  ctaButtonText: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.white,
  },
});
