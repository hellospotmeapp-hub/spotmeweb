import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Image, Platform, ActivityIndicator, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, BorderRadius, FontSize, Spacing, Shadow } from '@/app/lib/theme';
import { Need } from '@/app/lib/data';
import ExpirationTimer from './ExpirationTimer';

interface BulkNeedManagerProps {
  visible: boolean;
  onClose: () => void;
  needs: Need[];
  onDeleteNeed: (needId: string) => Promise<{ success: boolean; error?: string }>;
  onEditNeed: (need: Need) => void;
}

type SortMode = 'newest' | 'oldest' | 'amount_high' | 'amount_low' | 'expiring_soon';
type FilterMode = 'all' | 'collecting' | 'completed' | 'expired';

export default function BulkNeedManager({ visible, onClose, needs, onDeleteNeed, onEditNeed }: BulkNeedManagerProps) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortMode, setSortMode] = useState<SortMode>('newest');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [deleteSuccess, setDeleteSuccess] = useState('');
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  // Filter needs
  const filteredNeeds = useMemo(() => {
    let result = [...needs];

    switch (filterMode) {
      case 'collecting':
        result = result.filter(n => n.status === 'Collecting');
        break;
      case 'completed':
        result = result.filter(n => n.status === 'Goal Met' || n.status === 'Paid' || n.status === 'Payout Requested');
        break;
      case 'expired':
        result = result.filter(n => n.status === 'Expired');
        break;
    }

    switch (sortMode) {
      case 'newest':
        result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
      case 'oldest':
        result.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        break;
      case 'amount_high':
        result.sort((a, b) => b.raisedAmount - a.raisedAmount);
        break;
      case 'amount_low':
        result.sort((a, b) => a.raisedAmount - b.raisedAmount);
        break;
      case 'expiring_soon':
        result.sort((a, b) => {
          const aExp = a.expiresAt || new Date(new Date(a.createdAt).getTime() + 14 * 24 * 60 * 60 * 1000).toISOString();
          const bExp = b.expiresAt || new Date(new Date(b.createdAt).getTime() + 14 * 24 * 60 * 60 * 1000).toISOString();
          return new Date(aExp).getTime() - new Date(bExp).getTime();
        });
        break;
    }

    return result;
  }, [needs, filterMode, sortMode]);

  const toggleSelect = (needId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(needId)) {
        next.delete(needId);
      } else {
        next.add(needId);
      }
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === filteredNeeds.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredNeeds.map(n => n.id)));
    }
  };

  // Check which selected needs can be deleted (no contributions)
  const deletableIds = useMemo(() => {
    return Array.from(selectedIds).filter(id => {
      const need = needs.find(n => n.id === id);
      return need && need.raisedAmount === 0;
    });
  }, [selectedIds, needs]);

  const nonDeletableCount = selectedIds.size - deletableIds.length;

  const handleBulkDelete = async () => {
    if (deletableIds.length === 0) return;
    setShowConfirmDelete(false);
    setIsDeleting(true);
    setDeleteError('');
    setDeleteSuccess('');

    let successCount = 0;
    let failCount = 0;
    const errors: string[] = [];

    for (const id of deletableIds) {
      try {
        const result = await onDeleteNeed(id);
        if (result.success) {
          successCount++;
          setSelectedIds(prev => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
        } else {
          failCount++;
          errors.push(result.error || 'Unknown error');
        }
      } catch (err: any) {
        failCount++;
        errors.push(err.message || 'Delete failed');
      }
    }

    setIsDeleting(false);

    if (successCount > 0) {
      setDeleteSuccess(`${successCount} need${successCount > 1 ? 's' : ''} deleted successfully.`);
      setTimeout(() => setDeleteSuccess(''), 4000);
    }
    if (failCount > 0) {
      setDeleteError(`${failCount} deletion${failCount > 1 ? 's' : ''} failed: ${errors[0]}`);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Collecting': return Colors.primary;
      case 'Goal Met': return Colors.success;
      case 'Payout Requested': return Colors.secondary;
      case 'Paid': return Colors.secondaryDark;
      case 'Expired': return Colors.textLight;
      default: return Colors.textSecondary;
    }
  };

  const getProgressPercent = (need: Need) => {
    return Math.min(100, Math.round((need.raisedAmount / need.goalAmount) * 100));
  };

  const filters: { key: FilterMode; label: string; icon: string }[] = [
    { key: 'all', label: 'All', icon: 'apps' },
    { key: 'collecting', label: 'Active', icon: 'hourglass-top' },
    { key: 'completed', label: 'Completed', icon: 'check-circle' },
    { key: 'expired', label: 'Expired', icon: 'timer-off' },
  ];

  const sorts: { key: SortMode; label: string }[] = [
    { key: 'newest', label: 'Newest' },
    { key: 'oldest', label: 'Oldest' },
    { key: 'amount_high', label: 'Most Raised' },
    { key: 'amount_low', label: 'Least Raised' },
    { key: 'expiring_soon', label: 'Expiring Soon' },
  ];

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>Manage Needs</Text>
              <Text style={styles.headerSubtitle}>
                {needs.length} total {selectedIds.size > 0 ? `(${selectedIds.size} selected)` : ''}
              </Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <MaterialIcons name="close" size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Bulk Action Bar */}
          {selectedIds.size > 0 && (
            <View style={styles.actionBar}>
              <View style={styles.actionBarLeft}>
                <View style={styles.selectedBadge}>
                  <Text style={styles.selectedBadgeText}>{selectedIds.size}</Text>
                </View>
                <Text style={styles.actionBarText}>selected</Text>
              </View>
              <View style={styles.actionBarRight}>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.actionBtnDelete]}
                  onPress={() => {
                    if (deletableIds.length > 0) {
                      setShowConfirmDelete(true);
                    } else {
                      setDeleteError('Selected needs have contributions and cannot be deleted.');
                      setTimeout(() => setDeleteError(''), 4000);
                    }
                  }}
                  disabled={isDeleting}
                  activeOpacity={0.7}
                >
                  {isDeleting ? (
                    <ActivityIndicator size="small" color={Colors.white} />
                  ) : (
                    <>
                      <MaterialIcons name="delete-outline" size={16} color={Colors.white} />
                      <Text style={styles.actionBtnDeleteText}>
                        Delete{deletableIds.length > 0 ? ` (${deletableIds.length})` : ''}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionBtnClear}
                  onPress={() => setSelectedIds(new Set())}
                  activeOpacity={0.7}
                >
                  <MaterialIcons name="deselect" size={16} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Filters */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterRow}>
            {filters.map(f => (
              <TouchableOpacity
                key={f.key}
                style={[styles.filterChip, filterMode === f.key && styles.filterChipActive]}
                onPress={() => setFilterMode(f.key)}
                activeOpacity={0.7}
              >
                <MaterialIcons name={f.icon as any} size={14} color={filterMode === f.key ? Colors.white : Colors.textSecondary} />
                <Text style={[styles.filterChipText, filterMode === f.key && styles.filterChipTextActive]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            ))}
            <View style={styles.filterDivider} />
            {sorts.map(s => (
              <TouchableOpacity
                key={s.key}
                style={[styles.sortChip, sortMode === s.key && styles.sortChipActive]}
                onPress={() => setSortMode(s.key)}
                activeOpacity={0.7}
              >
                <Text style={[styles.sortChipText, sortMode === s.key && styles.sortChipTextActive]}>
                  {s.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Error/Success Banners */}
          {deleteError ? (
            <View style={styles.errorBanner}>
              <MaterialIcons name="error-outline" size={14} color={Colors.error} />
              <Text style={styles.errorText}>{deleteError}</Text>
              <TouchableOpacity onPress={() => setDeleteError('')}>
                <MaterialIcons name="close" size={14} color={Colors.error} />
              </TouchableOpacity>
            </View>
          ) : null}

          {deleteSuccess ? (
            <View style={styles.successBanner}>
              <MaterialIcons name="check-circle" size={14} color={Colors.success} />
              <Text style={styles.successText}>{deleteSuccess}</Text>
            </View>
          ) : null}

          {/* Select All */}
          {filteredNeeds.length > 0 && (
            <TouchableOpacity style={styles.selectAllRow} onPress={selectAll} activeOpacity={0.7}>
              <View style={[styles.checkbox, selectedIds.size === filteredNeeds.length && styles.checkboxChecked]}>
                {selectedIds.size === filteredNeeds.length && (
                  <MaterialIcons name="check" size={14} color={Colors.white} />
                )}
              </View>
              <Text style={styles.selectAllText}>
                {selectedIds.size === filteredNeeds.length ? 'Deselect All' : 'Select All'}
              </Text>
              <Text style={styles.needCountText}>{filteredNeeds.length} needs</Text>
            </TouchableOpacity>
          )}

          {/* Need List */}
          <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
            {filteredNeeds.length === 0 ? (
              <View style={styles.emptyState}>
                <MaterialIcons name="inbox" size={48} color={Colors.borderLight} />
                <Text style={styles.emptyTitle}>No needs found</Text>
                <Text style={styles.emptySubtitle}>
                  {filterMode !== 'all' ? 'Try a different filter' : 'Create your first need to get started'}
                </Text>
              </View>
            ) : (
              filteredNeeds.map(need => {
                const isSelected = selectedIds.has(need.id);
                const canDelete = need.raisedAmount === 0;
                const progress = getProgressPercent(need);

                return (
                  <TouchableOpacity
                    key={need.id}
                    style={[styles.needRow, isSelected && styles.needRowSelected]}
                    onPress={() => toggleSelect(need.id)}
                    activeOpacity={0.7}
                  >
                    {/* Checkbox */}
                    <View style={[styles.checkbox, isSelected && styles.checkboxChecked]}>
                      {isSelected && <MaterialIcons name="check" size={14} color={Colors.white} />}
                    </View>

                    {/* Photo */}
                    {need.photo ? (
                      <Image source={{ uri: need.photo }} style={styles.needPhoto} />
                    ) : (
                      <View style={[styles.needPhoto, styles.needPhotoPlaceholder]}>
                        <MaterialIcons name="image" size={20} color={Colors.textLight} />
                      </View>
                    )}

                    {/* Content */}
                    <View style={styles.needContent}>
                      <Text style={styles.needTitle} numberOfLines={1}>{need.title}</Text>
                      <View style={styles.needMeta}>
                        <View style={[styles.statusDot, { backgroundColor: getStatusColor(need.status) }]} />
                        <Text style={styles.needStatus}>{need.status}</Text>
                        <Text style={styles.needAmount}>${need.raisedAmount}/${need.goalAmount}</Text>
                      </View>
                      {/* Mini progress bar */}
                      <View style={styles.miniProgressTrack}>
                        <View style={[styles.miniProgressFill, { width: `${progress}%` }]} />
                      </View>
                      {/* Expiration badge for collecting needs */}
                      {need.status === 'Collecting' && (
                        <View style={styles.needTimerRow}>
                          <ExpirationTimer
                            expiresAt={need.expiresAt}
                            createdAt={need.createdAt}
                            status={need.status}
                            compact
                          />
                          <Text style={styles.needContributors}>
                            {need.contributorCount} contributor{need.contributorCount !== 1 ? 's' : ''}
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Actions */}
                    <View style={styles.needActions}>
                      <TouchableOpacity
                        style={styles.needActionBtn}
                        onPress={(e) => {
                          e.stopPropagation?.();
                          onEditNeed(need);
                        }}
                        activeOpacity={0.7}
                      >
                        <MaterialIcons name="edit" size={16} color={Colors.primary} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.needActionBtn}
                        onPress={(e) => {
                          e.stopPropagation?.();
                          router.push(`/need/${need.id}`);
                          onClose();
                        }}
                        activeOpacity={0.7}
                      >
                        <MaterialIcons name="visibility" size={16} color={Colors.textSecondary} />
                      </TouchableOpacity>
                      {!canDelete && (
                        <View style={styles.lockIcon}>
                          <MaterialIcons name="lock" size={12} color={Colors.textLight} />
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
            <View style={{ height: 20 }} />
          </ScrollView>

          {/* Confirm Delete Modal */}
          {showConfirmDelete && (
            <View style={styles.confirmOverlay}>
              <View style={styles.confirmCard}>
                <View style={styles.confirmIconWrap}>
                  <MaterialIcons name="delete-forever" size={32} color={Colors.error} />
                </View>
                <Text style={styles.confirmTitle}>Delete {deletableIds.length} Need{deletableIds.length > 1 ? 's' : ''}?</Text>
                <Text style={styles.confirmSubtitle}>
                  This action cannot be undone. Only needs with no contributions can be deleted.
                </Text>
                {nonDeletableCount > 0 && (
                  <View style={styles.confirmWarning}>
                    <MaterialIcons name="info-outline" size={14} color={Colors.accent} />
                    <Text style={styles.confirmWarningText}>
                      {nonDeletableCount} need{nonDeletableCount > 1 ? 's have' : ' has'} contributions and will be skipped.
                    </Text>
                  </View>
                )}
                <View style={styles.confirmActions}>
                  <TouchableOpacity
                    style={styles.confirmCancelBtn}
                    onPress={() => setShowConfirmDelete(false)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.confirmCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.confirmDeleteBtn}
                    onPress={handleBulkDelete}
                    activeOpacity={0.7}
                  >
                    <MaterialIcons name="delete" size={16} color={Colors.white} />
                    <Text style={styles.confirmDeleteText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: BorderRadius.xxl,
    borderTopRightRadius: BorderRadius.xxl,
    maxHeight: '92%',
    flex: 1,
    ...(Platform.OS === 'web' ? {
      maxWidth: 560,
      alignSelf: 'center' as any,
      width: '100%',
      borderRadius: BorderRadius.xxl,
      marginVertical: 20,
      maxHeight: '90%',
    } : {}),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  headerTitle: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    color: Colors.text,
  },
  headerSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Action Bar
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.primaryLight,
    borderBottomWidth: 1,
    borderBottomColor: Colors.primary + '20',
  },
  actionBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  selectedBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: '800',
    color: Colors.white,
  },
  actionBarText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.primary,
  },
  actionBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
  },
  actionBtnDelete: {
    backgroundColor: Colors.error,
  },
  actionBtnDeleteText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.white,
  },
  actionBtnClear: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Filters
  filterScroll: {
    maxHeight: 44,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  filterRow: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
    alignItems: 'center',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surfaceAlt,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
  },
  filterChipText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  filterChipTextActive: {
    color: Colors.white,
  },
  filterDivider: {
    width: 1,
    height: 20,
    backgroundColor: Colors.border,
    marginHorizontal: Spacing.xs,
  },
  sortChip: {
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: Spacing.xs + 2,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surfaceAlt,
  },
  sortChipActive: {
    backgroundColor: Colors.secondaryLight,
  },
  sortChipText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  sortChipTextActive: {
    color: Colors.secondaryDark,
  },

  // Error/Success
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.sm,
    padding: Spacing.sm,
    backgroundColor: '#FFF0F0',
    borderRadius: BorderRadius.md,
  },
  errorText: {
    flex: 1,
    fontSize: FontSize.xs,
    color: Colors.error,
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.sm,
    padding: Spacing.sm,
    backgroundColor: '#E8F5E8',
    borderRadius: BorderRadius.md,
  },
  successText: {
    flex: 1,
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.success,
  },

  // Select All
  selectAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  selectAllText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
    flex: 1,
  },
  needCountText: {
    fontSize: FontSize.xs,
    color: Colors.textLight,
  },

  // Checkbox
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  checkboxChecked: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },

  // Need List
  list: {
    flex: 1,
  },
  needRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  needRowSelected: {
    backgroundColor: Colors.primaryLight + '50',
  },
  needPhoto: {
    width: 52,
    height: 52,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surfaceAlt,
  },
  needPhotoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  needContent: {
    flex: 1,
    gap: 3,
  },
  needTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.text,
  },
  needMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  needStatus: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  needAmount: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.text,
  },
  miniProgressTrack: {
    height: 3,
    backgroundColor: Colors.borderLight,
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 2,
  },
  miniProgressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 2,
  },
  needTimerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: 2,
  },
  needContributors: {
    fontSize: FontSize.xs,
    color: Colors.textLight,
  },
  needActions: {
    flexDirection: 'column',
    gap: Spacing.xs,
    alignItems: 'center',
  },
  needActionBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockIcon: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.huge * 2,
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
    textAlign: 'center',
  },

  // Confirm Delete
  confirmOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    borderRadius: BorderRadius.xxl,
  },
  confirmCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xxl,
    padding: Spacing.xxl,
    marginHorizontal: Spacing.xxl,
    alignItems: 'center',
    maxWidth: 340,
    width: '100%',
    ...Shadow.lg,
  },
  confirmIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFF0F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  confirmTitle: {
    fontSize: FontSize.lg,
    fontWeight: '800',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  confirmSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: Spacing.md,
  },
  confirmWarning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.xs,
    backgroundColor: Colors.accentLight,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
    width: '100%',
  },
  confirmWarningText: {
    flex: 1,
    fontSize: FontSize.xs,
    color: '#8B7A2E',
    lineHeight: 16,
  },
  confirmActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    width: '100%',
  },
  confirmCancelBtn: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.surfaceAlt,
    alignItems: 'center',
  },
  confirmCancelText: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  confirmDeleteBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.error,
  },
  confirmDeleteText: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.white,
  },
});
