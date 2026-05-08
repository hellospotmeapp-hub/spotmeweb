import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, BorderRadius, FontSize, Spacing } from '@/app/lib/theme';

interface StatusBadgeProps {
  status: string;
  onDark?: boolean;
}


const STATUS_CONFIG: Record<string, { color: string; icon: string; bg: string }> = {
  'Collecting': { color: Colors.primary, icon: 'trending-up', bg: Colors.primaryLight },
  'Goal Met': { color: Colors.success, icon: 'celebration', bg: '#E8F5E8' },
  'Payout Requested': { color: Colors.accent, icon: 'schedule', bg: Colors.accentLight },
  'Paid': { color: Colors.secondary, icon: 'check-circle', bg: Colors.secondaryLight },
  'Expired': { color: '#A9A29B', icon: 'timer-off', bg: '#F0EDE9' },
};

export default function StatusBadge({ status, onDark }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG['Collecting'];
  const bg = onDark ? 'rgba(255,255,255,0.22)' : config.bg;
  const color = onDark ? Colors.white : config.color;

  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <MaterialIcons name={config.icon as any} size={14} color={color} />
      <Text style={[styles.text, { color }]}>{status}</Text>
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
