import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, CategoryColors, BorderRadius, FontSize, Spacing } from '@/app/lib/theme';

interface CategoryBadgeProps {
  category: string;
  size?: 'sm' | 'md' | 'lg';
  onPress?: () => void;
  selected?: boolean;
}

const CATEGORY_ICONS: Record<string, string> = {
  'All': 'apps',
  'Bills': 'receipt',
  'Kids': 'child-care',
  'Groceries': 'shopping-cart',
  'Health/Fitness': 'fitness-center',
  'Transportation': 'directions-car',
  'Other': 'more-horiz',
};

export default function CategoryBadge({ category, size = 'sm', onPress, selected }: CategoryBadgeProps) {
  const color = CategoryColors[category] || Colors.textSecondary;
  const iconName = CATEGORY_ICONS[category] || 'label';
  
  const isSmall = size === 'sm';
  const isMedium = size === 'md';
  const isLarge = size === 'lg';

  const content = (
    <View style={[
      styles.badge,
      { backgroundColor: selected ? color : color + '18' },
      isSmall && styles.badgeSm,
      isMedium && styles.badgeMd,
      isLarge && styles.badgeLg,
    ]}>
      <MaterialIcons
        name={iconName as any}
        size={isSmall ? 12 : isMedium ? 16 : 20}
        color={selected ? Colors.white : color}
      />
      <Text style={[
        styles.text,
        { color: selected ? Colors.white : color },
        isSmall && styles.textSm,
        isMedium && styles.textMd,
        isLarge && styles.textLg,
      ]}>
        {category}
      </Text>
    </View>
  );

  if (onPress) {
    return <TouchableOpacity onPress={onPress} activeOpacity={0.7}>{content}</TouchableOpacity>;
  }

  return content;
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.full,
  },
  badgeSm: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    gap: 3,
  },
  badgeMd: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    gap: Spacing.xs,
  },
  badgeLg: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  text: {
    fontWeight: '600',
  },
  textSm: {
    fontSize: FontSize.xs,
  },
  textMd: {
    fontSize: FontSize.sm,
  },
  textLg: {
    fontSize: FontSize.md,
  },
});
