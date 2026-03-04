import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, BorderRadius, FontSize, Spacing, Shadow, CategoryColors } from '@/app/lib/theme';
import { useApp } from '@/app/lib/store';
import { CATEGORIES } from '@/app/lib/data';
import NeedCard from '@/components/NeedCard';
import ContributeModal from '@/components/ContributeModal';

type SortOption = 'newest' | 'closest' | 'ending';

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { needs, contribute, currentUser } = useApp();
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [showSort, setShowSort] = useState(false);
  const [contributeModal, setContributeModal] = useState<{ visible: boolean; needId: string; title: string; remaining: number }>({
    visible: false, needId: '', title: '', remaining: 0,
  });

  const filteredNeeds = useMemo(() => {
    let result = needs.filter(n => n.status === 'Collecting');

    if (activeCategory !== 'All') {
      result = result.filter(n => n.category === activeCategory);
    }

    if (query.trim()) {
      const q = query.toLowerCase();
      result = result.filter(n =>
        n.title.toLowerCase().includes(q) ||
        n.message.toLowerCase().includes(q) ||
        (n.userName || '').toLowerCase().includes(q)
      );

    }

    switch (sortBy) {
      case 'newest':
        result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
      case 'closest':
        result.sort((a, b) => (b.raisedAmount / b.goalAmount) - (a.raisedAmount / a.goalAmount));
        break;
      case 'ending':
        result.sort((a, b) => (a.goalAmount - a.raisedAmount) - (b.goalAmount - b.raisedAmount));
        break;
    }

    return result;
  }, [needs, activeCategory, query, sortBy]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { 'All': 0 };
    needs.filter(n => n.status === 'Collecting').forEach(n => {
      counts['All'] = (counts['All'] || 0) + 1;
      counts[n.category] = (counts[n.category] || 0) + 1;
    });
    return counts;
  }, [needs]);

  const handleQuickContribute = (needId: string, amount: number) => {
    const need = needs.find(n => n.id === needId);
    if (need) {
      setContributeModal({
        visible: true,
        needId: need.id,
        title: need.title,
        remaining: need.goalAmount - need.raisedAmount,
      });
    }
  };

  const SORT_OPTIONS: { key: SortOption; label: string; icon: string }[] = [
    { key: 'newest', label: 'Newest First', icon: 'schedule' },
    { key: 'closest', label: 'Closest to Goal', icon: 'trending-up' },
    { key: 'ending', label: 'Smallest Remaining', icon: 'attach-money' },
  ];

  const topPadding = Platform.OS === 'web' ? 0 : insets.top;

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Browse Needs</Text>
        <TouchableOpacity
          style={styles.spreadButton}
          onPress={() => router.push('/spread')}
          activeOpacity={0.8}
        >
          <MaterialIcons name="favorite" size={16} color={Colors.white} />
          <Text style={styles.spreadButtonText}>Spread Love</Text>
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <MaterialIcons name="search" size={22} color={Colors.textLight} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search needs, people, categories..."
            placeholderTextColor={Colors.textLight}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')}>
              <MaterialIcons name="close" size={20} color={Colors.textLight} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={[styles.sortButton, showSort && styles.sortButtonActive]}
          onPress={() => setShowSort(!showSort)}
        >
          <MaterialIcons name="sort" size={22} color={showSort ? Colors.white : Colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Sort Options */}
      {showSort && (
        <View style={styles.sortRow}>
          {SORT_OPTIONS.map(opt => (
            <TouchableOpacity
              key={opt.key}
              style={[styles.sortChip, sortBy === opt.key && styles.sortChipActive]}
              onPress={() => { setSortBy(opt.key); setShowSort(false); }}
              activeOpacity={0.7}
            >
              <MaterialIcons
                name={opt.icon as any}
                size={16}
                color={sortBy === opt.key ? Colors.white : Colors.textSecondary}
              />
              <Text style={[styles.sortChipText, sortBy === opt.key && styles.sortChipTextActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Category Grid */}
        <View style={styles.categoryGrid}>
          {CATEGORIES.map(cat => {
            const isActive = activeCategory === cat.name;
            const color = CategoryColors[cat.name] || Colors.textSecondary;
            const count = categoryCounts[cat.name] || 0;
            return (
              <TouchableOpacity
                key={cat.name}
                style={[
                  styles.categoryCard,
                  isActive && { borderColor: color, borderWidth: 2 },
                ]}
                onPress={() => setActiveCategory(cat.name)}
                activeOpacity={0.7}
              >
                <View style={[styles.categoryIconBg, { backgroundColor: (color) + '20' }]}>
                  <MaterialIcons name={cat.icon as any} size={24} color={color} />
                </View>
                <Text style={[styles.categoryName, isActive && { color, fontWeight: '800' }]}>
                  {cat.name}
                </Text>
                <Text style={styles.categoryCount}>{count}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Spread the Love mini banner */}
        <TouchableOpacity
          style={styles.spreadBanner}
          onPress={() => router.push('/spread')}
          activeOpacity={0.85}
        >
          <View style={styles.spreadBannerIcon}>
            <MaterialIcons name="auto-awesome" size={20} color={Colors.accent} />
          </View>
          <View style={styles.spreadBannerInfo}>
            <Text style={styles.spreadBannerTitle}>Spread the Love</Text>
            <Text style={styles.spreadBannerDesc}>One payment helps multiple people at once</Text>
          </View>
          <MaterialIcons name="arrow-forward-ios" size={16} color={Colors.primary} />
        </TouchableOpacity>

        {/* Results */}
        <View style={styles.resultsHeader}>
          <Text style={styles.resultsTitle}>
            {query ? `Results for "${query}"` : activeCategory === 'All' ? 'All Needs' : activeCategory}
          </Text>
          <Text style={styles.resultsCount}>{filteredNeeds.length} found</Text>
        </View>

        {filteredNeeds.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialIcons name="search-off" size={56} color={Colors.borderLight} />
            <Text style={styles.emptyTitle}>No results found</Text>
            <Text style={styles.emptySubtitle}>Try different keywords or browse categories</Text>
          </View>
        ) : (
          filteredNeeds.map(need => (
            <NeedCard
              key={need.id}
              need={need}
              onContribute={handleQuickContribute}
            />
          ))
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      <ContributeModal
        visible={contributeModal.visible}
        onClose={() => setContributeModal(prev => ({ ...prev, visible: false }))}
        onContribute={(amount, note) => contribute(contributeModal.needId, amount, note)}
        needTitle={contributeModal.title}
        needId={contributeModal.needId}
        remaining={contributeModal.remaining}
        contributorName={currentUser.name}
      />

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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    ...(Platform.OS === 'web' ? { paddingTop: 16 } : {}),
  },
  title: {
    fontSize: FontSize.xxl,
    fontWeight: '900',
    color: Colors.text,
  },
  spreadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    ...Shadow.sm,
  },
  spreadButtonText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.white,
  },
  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.lg,
    height: 48,
    gap: Spacing.sm,
    ...Shadow.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: FontSize.md,
    color: Colors.text,
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' as any } : {}),
  },
  sortButton: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.sm,
  },
  sortButtonActive: {
    backgroundColor: Colors.primary,
  },
  sortRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
    marginBottom: Spacing.md,
    flexWrap: 'wrap',
  },
  sortChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sortChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  sortChipText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  sortChipTextActive: {
    color: Colors.white,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  categoryCard: {
    width: '31%',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    alignItems: 'center',
    gap: Spacing.xs,
    borderWidth: 2,
    borderColor: 'transparent',
    ...Shadow.sm,
  },
  categoryIconBg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryName: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.text,
    textAlign: 'center',
  },
  categoryCount: {
    fontSize: FontSize.xs,
    color: Colors.textLight,
  },
  // Spread banner
  spreadBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.xl,
    backgroundColor: Colors.primaryLight,
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.primary + '25',
  },
  spreadBannerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spreadBannerInfo: {
    flex: 1,
  },
  spreadBannerTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.primary,
  },
  spreadBannerDesc: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.md,
  },
  resultsTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.text,
  },
  resultsCount: {
    fontSize: FontSize.sm,
    color: Colors.textLight,
  },
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
  },
});
