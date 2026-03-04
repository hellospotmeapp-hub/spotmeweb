import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { VERIFICATION_STATUSES } from '@/app/lib/data';
import { FontSize, Spacing, BorderRadius } from '@/app/lib/theme';

interface VerificationBadgeProps {
  status?: string;
  size?: 'sm' | 'md';
}

export default function VerificationBadge({ status = 'approved', size = 'sm' }: VerificationBadgeProps) {
  if (status === 'approved') return null; // Don't show badge for approved (normal state)
  
  const config = VERIFICATION_STATUSES[status as keyof typeof VERIFICATION_STATUSES] || VERIFICATION_STATUSES.pending;
  const iconSize = size === 'md' ? 16 : 12;
  const fontSize = size === 'md' ? FontSize.xs : 10;

  return (
    <View style={[styles.badge, { backgroundColor: config.color + '15', borderColor: config.color + '40' }]}>
      <MaterialIcons name={config.icon as any} size={iconSize} color={config.color} />
      <Text style={[styles.label, { color: config.color, fontSize }]}>{config.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  label: {
    fontWeight: '700',
  },
});
