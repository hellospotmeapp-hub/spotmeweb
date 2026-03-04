import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { TRUST_LEVELS } from '@/app/lib/data';
import { FontSize, Spacing, BorderRadius } from '@/app/lib/theme';

interface TrustBadgeProps {
  level?: string;
  score?: number;
  size?: 'sm' | 'md' | 'lg';
  showScore?: boolean;
}

export default function TrustBadge({ level = 'new', score, size = 'sm', showScore = false }: TrustBadgeProps) {
  const config = TRUST_LEVELS[level as keyof typeof TRUST_LEVELS] || TRUST_LEVELS.new;
  const iconSize = size === 'lg' ? 18 : size === 'md' ? 14 : 12;
  const fontSize = size === 'lg' ? FontSize.sm : size === 'md' ? FontSize.xs : 10;

  return (
    <View style={[styles.badge, { backgroundColor: config.color + '18', borderColor: config.color + '40' }]}>
      <MaterialIcons name={config.icon as any} size={iconSize} color={config.color} />
      <Text style={[styles.label, { color: config.color, fontSize }]}>{config.label}</Text>
      {showScore && score !== undefined && (
        <Text style={[styles.score, { color: config.color, fontSize }]}>{score}</Text>
      )}
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
  score: {
    fontWeight: '800',
  },
});
