import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, BorderRadius, FontSize, Spacing, Shadow, CategoryColors } from '@/app/lib/theme';
import { SplitAllocation, SplitResult } from '@/app/lib/smartSplit';


interface SpreadPreviewProps {
  result: SplitResult;
  isAnonymous: boolean;
}

function AllocationCard({ allocation, index }: { allocation: SplitAllocation; index: number }) {
  const progressBefore = allocation.raisedBefore / allocation.goalAmount;
  const progressAfter = allocation.raisedAfter / allocation.goalAmount;
  const catColor = CategoryColors[allocation.category] || Colors.textSecondary;

  return (
    <View style={styles.allocationCard}>
      <View style={styles.allocationHeader}>
        <View style={styles.allocationLeft}>
          <Image source={{ uri: allocation.userAvatar }} style={styles.allocationAvatar} />
          <View style={styles.allocationInfo}>
            <Text style={styles.allocationName} numberOfLines={1}>{allocation.userName}</Text>
            <Text style={styles.allocationTitle} numberOfLines={1}>{allocation.needTitle}</Text>
          </View>
        </View>
        <View style={styles.allocationAmountContainer}>
          <Text style={styles.allocationAmount}>${allocation.amount.toFixed(2)}</Text>
          {allocation.willComplete && (
            <View style={styles.completeBadge}>
              <MaterialIcons name="check-circle" size={12} color={Colors.success} />
              <Text style={styles.completeText}>Completes goal</Text>
            </View>
          )}
        </View>
      </View>

      {/* Progress visualization */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBarWrapper}>
          <View style={[styles.progressTrack, { height: 8, borderRadius: 4 }]}>
            {/* Before amount (existing) */}
            <View
              style={[
                styles.progressFillBefore,
                {
                  width: `${progressBefore * 100}%`,
                  backgroundColor: Colors.border,
                },
              ]}
            />
            {/* After amount (with contribution) */}
            <View
              style={[
                styles.progressFillAfter,
                {
                  width: `${progressAfter * 100}%`,
                  backgroundColor: allocation.willComplete ? Colors.success : Colors.primary,
                },
              ]}
            />
          </View>
        </View>
        <View style={styles.progressLabels}>
          <Text style={styles.progressLabel}>
            ${allocation.raisedBefore} <Text style={{ color: Colors.primary, fontWeight: '700' }}>+ ${allocation.amount.toFixed(0)}</Text>
          </Text>
          <Text style={styles.progressLabel}>${allocation.goalAmount}</Text>
        </View>
      </View>

      {/* Category badge */}
      <View style={styles.allocationFooter}>
        <View style={[styles.categoryDot, { backgroundColor: catColor }]} />
        <Text style={[styles.categoryLabel, { color: catColor }]}>{allocation.category}</Text>
        {allocation.userCity && (
          <>
            <Text style={styles.dotSeparator}>·</Text>
            <MaterialIcons name="place" size={12} color={Colors.textLight} />
            <Text style={styles.cityLabel}>{allocation.userCity}</Text>
          </>
        )}
      </View>
    </View>
  );
}

export default function SpreadPreview({ result, isAnonymous }: SpreadPreviewProps) {
  if (result.allocations.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <MaterialIcons name="search-off" size={48} color={Colors.borderLight} />
        <Text style={styles.emptyTitle}>No eligible needs found</Text>
        <Text style={styles.emptySubtitle}>Try a different category or spread mode</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Impact Summary */}
      <View style={styles.impactCard}>
        <View style={styles.impactRow}>
          <View style={styles.impactItem}>
            <Text style={styles.impactNumber}>{result.totalPeople}</Text>
            <Text style={styles.impactLabel}>{result.totalPeople === 1 ? 'Person' : 'People'}</Text>
          </View>
          <View style={styles.impactDivider} />
          <View style={styles.impactItem}>
            <Text style={styles.impactNumber}>${result.totalAmount}</Text>
            <Text style={styles.impactLabel}>Total</Text>
          </View>
          <View style={styles.impactDivider} />
          <View style={styles.impactItem}>
            <Text style={[styles.impactNumber, result.goalsCompleted > 0 && { color: Colors.success }]}>
              {result.goalsCompleted}
            </Text>
            <Text style={styles.impactLabel}>Goals Met</Text>
          </View>
        </View>
      </View>

      {/* Allocation Cards */}
      <Text style={styles.sectionTitle}>Here's how your love spreads</Text>
      {result.allocations.map((allocation, index) => (
        <AllocationCard key={allocation.needId} allocation={allocation} index={index} />
      ))}

      {/* Fee Transparency */}
      <View style={styles.feeCard}>
        <View style={styles.feeRow}>
          <Text style={styles.feeLabel}>Your contribution</Text>
          <Text style={styles.feeValue}>${result.totalAmount.toFixed(2)}</Text>
        </View>
        <View style={styles.feeRow}>
          <Text style={styles.feeLabel}>Platform fee (5%)</Text>
          <Text style={styles.feeValue}>${result.fee.toFixed(2)}</Text>
        </View>
        <View style={[styles.feeRow, styles.feeRowTotal]}>
          <Text style={styles.feeLabelBold}>Total charge</Text>
          <Text style={styles.feeValueBold}>${(result.totalAmount + result.fee).toFixed(2)}</Text>
        </View>
        <View style={styles.feeRow}>
          <Text style={styles.feeLabel}>Creators receive</Text>
          <Text style={[styles.feeValue, { color: Colors.success, fontWeight: '700' }]}>
            ${result.netAmount.toFixed(2)}
          </Text>
        </View>
      </View>

      {/* Anonymous note */}
      {isAnonymous && (
        <View style={styles.anonymousNote}>
          <MaterialIcons name="visibility-off" size={16} color={Colors.textSecondary} />
          <Text style={styles.anonymousText}>
            Your contributions will appear as "A kind stranger"
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.lg,
  },
  impactCard: {
    backgroundColor: Colors.primaryLight,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.primary + '30',
  },
  impactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  impactItem: {
    alignItems: 'center',
  },
  impactNumber: {
    fontSize: FontSize.xxl,
    fontWeight: '900',
    color: Colors.primary,
  },
  impactLabel: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
    fontWeight: '600',
  },
  impactDivider: {
    width: 1,
    height: 36,
    backgroundColor: Colors.primary + '30',
  },
  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: '800',
    color: Colors.text,
  },
  allocationCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    gap: Spacing.md,
    ...Shadow.sm,
  },
  allocationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  allocationLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flex: 1,
  },
  allocationAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.borderLight,
  },
  allocationInfo: {
    flex: 1,
  },
  allocationName: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.text,
  },
  allocationTitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  allocationAmountContainer: {
    alignItems: 'flex-end',
    gap: 4,
  },
  allocationAmount: {
    fontSize: FontSize.xl,
    fontWeight: '900',
    color: Colors.primary,
  },
  completeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#E8F5E8',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  completeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.success,
  },
  progressContainer: {
    gap: Spacing.xs,
  },
  progressBarWrapper: {
    width: '100%',
  },
  progressTrack: {
    width: '100%',
    backgroundColor: Colors.borderLight,
    overflow: 'hidden',
    position: 'relative',
  },
  progressFillBefore: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 4,
    zIndex: 1,
  },
  progressFillAfter: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 4,
    zIndex: 2,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressLabel: {
    fontSize: FontSize.xs,
    color: Colors.textLight,
  },
  allocationFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  categoryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  categoryLabel: {
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  dotSeparator: {
    color: Colors.textLight,
    marginHorizontal: 2,
  },
  cityLabel: {
    fontSize: FontSize.xs,
    color: Colors.textLight,
  },
  feeCard: {
    backgroundColor: Colors.surfaceAlt,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    gap: Spacing.xs,
  },
  feeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  feeRowTotal: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.sm,
    marginTop: Spacing.xs,
  },
  feeLabel: {
    fontSize: FontSize.sm,
    color: Colors.textLight,
  },
  feeValue: {
    fontSize: FontSize.sm,
    color: Colors.textLight,
  },
  feeLabelBold: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.text,
  },
  feeValueBold: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.text,
  },
  anonymousNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surfaceAlt,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  anonymousText: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.huge,
    gap: Spacing.md,
  },
  emptyTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  emptySubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textLight,
  },
});
