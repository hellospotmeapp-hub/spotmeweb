import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, BorderRadius, FontSize, Spacing } from '@/app/lib/theme';

interface StatusBadgeProps {
  status: 'Collecting' | 'Goal Met' | 'Payout Requested' | 'Paid';
}

const STATUS_CONFIG = {
  'Collecting': { color: Colors.primary, icon: 'trending-up', bg: Colors.primaryLight },
  'Goal Met': { color: Colors.success, icon: 'celebration', bg: '#E8F5E8' },
  'Payout Requested': { color: Colors.accent, icon: 'schedule', bg: Colors.accentLight },
  'Paid': { color: Colors.secondary, icon: 'check-circle', bg: Colors.secondaryLight },
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];

  return (
    <View style={[styles.badge, { backgroundColor: config.bg }]}>
      <MaterialIcons name={config.icon as any} size={14} color={config.color} />
      <Text style={[styles.text, { color: config.color }]}>{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    gap: 4,
  },
  text: {
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
});
