import React, { useState, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Platform,
  Pressable,
  Keyboard,
} from 'react-native';

import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, BorderRadius, FontSize, Spacing, Shadow } from '@/app/lib/theme';
import { Need } from '@/app/lib/data';
import GracefulImage from './GracefulImage';
import ProgressBar from './ProgressBar';

interface HomeSearchBarProps {
  needs: Need[];
}

const DEFAULT_AVATAR = 'https://d64gsuwffb70l.cloudfront.net/698fe0b37fe9438e65b48d58_1771037056297_f9a83069.png';

export default function HomeSearchBar({ needs }: HomeSearchBarProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const searchResults = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase().trim();
    
    // Search by user name, also include title for convenience
    const results = needs.filter((n) => {
      const nameMatch = (n.userName || '').toLowerCase().includes(q);
      const titleMatch = (n.title || '').toLowerCase().includes(q);
      return nameMatch || titleMatch;
    });

    // Sort: name matches first, then title-only matches
    results.sort((a, b) => {
      const aName = (a.userName || '').toLowerCase().includes(q) ? 0 : 1;
      const bName = (b.userName || '').toLowerCase().includes(q) ? 0 : 1;
      return aName - bName;
    });

    return results.slice(0, 8); // Limit to 8 results
  }, [needs, query]);

  // Group results by user for a cleaner display
  const groupedResults = useMemo(() => {
    const groups: { userId: string; userName: string; userAvatar: string; userCity: string; needs: Need[] }[] = [];
    const userMap = new Map<string, number>();

    searchResults.forEach((need) => {
      const existingIdx = userMap.get(need.userId);
      if (existingIdx !== undefined) {
        groups[existingIdx].needs.push(need);
      } else {
        userMap.set(need.userId, groups.length);
        groups.push({
          userId: need.userId,
          userName: need.userName,
          userAvatar: need.userAvatar,
          userCity: need.userCity,
          needs: [need],
        });
      }
    });

    return groups;
  }, [searchResults]);

  const showResults = isFocused && query.trim().length > 0;

  const handleSelectNeed = (needId: string) => {
    setQuery('');
    setIsFocused(false);
    Keyboard.dismiss();
    router.push(`/need/${needId}`);
  };

  const handleSelectUser = (userId: string) => {
    setQuery('');
    setIsFocused(false);
    Keyboard.dismiss();
    router.push(`/user/${userId}`);
  };

  const handleClear = () => {
    setQuery('');
    inputRef.current?.focus();
  };

  const handleDismiss = () => {
    setQuery('');
    setIsFocused(false);
    Keyboard.dismiss();
  };

  // Highlight matching text
  const highlightText = (text: string, highlight: string) => {
    if (!highlight.trim()) return <Text>{text}</Text>;
    const idx = text.toLowerCase().indexOf(highlight.toLowerCase());
    if (idx === -1) return <Text>{text}</Text>;
    return (
      <Text>
        {text.substring(0, idx)}
        <Text style={styles.highlightText}>{text.substring(idx, idx + highlight.length)}</Text>
        {text.substring(idx + highlight.length)}
      </Text>
    );
  };

  return (
    <View style={styles.wrapper}>
      {/* Search Input */}
      <View style={[styles.searchContainer, isFocused && styles.searchContainerFocused]}>
        <MaterialIcons name="search" size={22} color={isFocused ? Colors.primary : Colors.textLight} />
        <TextInput
          ref={inputRef}
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            // Delay to allow tapping results
            setTimeout(() => setIsFocused(false), 200);
          }}
          placeholder="Search by name or need..."
          placeholderTextColor={Colors.textLight}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={handleClear} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <MaterialIcons name="close" size={20} color={Colors.textLight} />
          </TouchableOpacity>
        )}
      </View>

      {/* Results Dropdown */}
      {showResults && (
        <>
          {/* Backdrop to dismiss */}
          {Platform.OS !== 'web' && (
            <Pressable style={styles.backdrop} onPress={handleDismiss} />
          )}

          <View style={styles.resultsContainer}>
            {groupedResults.length === 0 ? (
              <View style={styles.noResults}>
                <MaterialIcons name="search-off" size={28} color={Colors.textLight} />
                <Text style={styles.noResultsText}>No results for "{query}"</Text>
                <Text style={styles.noResultsHint}>Try searching by first or last name</Text>
              </View>
            ) : (
              <>
                <View style={styles.resultsHeader}>
                  <MaterialIcons name="people" size={16} color={Colors.textSecondary} />
                  <Text style={styles.resultsHeaderText}>
                    {searchResults.length} {searchResults.length === 1 ? 'result' : 'results'} found
                  </Text>
                </View>

                {groupedResults.map((group) => (
                  <View key={group.userId} style={styles.userGroup}>
                    {/* User Header */}
                    <TouchableOpacity
                      style={styles.userHeader}
                      onPress={() => handleSelectUser(group.userId)}
                      activeOpacity={0.7}
                    >
                      <GracefulImage
                        uri={group.userAvatar || DEFAULT_AVATAR}
                        type="avatar"
                        style={styles.userAvatar}
                      />
                      <View style={styles.userInfo}>
                        <Text style={styles.userName}>
                          {highlightText(group.userName, query)}
                        </Text>
                        {group.userCity ? (
                          <View style={styles.cityRow}>
                            <MaterialIcons name="place" size={11} color={Colors.textLight} />
                            <Text style={styles.cityText}>{group.userCity}</Text>
                          </View>
                        ) : null}
                      </View>
                      <View style={styles.viewProfileBadge}>
                        <Text style={styles.viewProfileText}>Profile</Text>
                        <MaterialIcons name="chevron-right" size={14} color={Colors.primary} />
                      </View>
                    </TouchableOpacity>

                    {/* User's Needs */}
                    {group.needs.map((need) => (
                      <TouchableOpacity
                        key={need.id}
                        style={styles.needItem}
                        onPress={() => handleSelectNeed(need.id)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.needDot} />
                        <View style={styles.needContent}>
                          <Text style={styles.needTitle} numberOfLines={1}>
                            {highlightText(need.title, query)}
                          </Text>
                          <View style={styles.needMeta}>
                            <View style={styles.needProgressMini}>
                              <ProgressBar
                                progress={need.raisedAmount / (need.goalAmount || 1)}
                                height={4}
                              />
                            </View>
                            <Text style={styles.needAmount}>
                              ${need.raisedAmount}/${need.goalAmount}
                            </Text>
                            <View style={[
                              styles.statusDot,
                              { backgroundColor: need.status === 'Collecting' ? Colors.success : need.status === 'Goal Met' ? Colors.accent : Colors.textLight }
                            ]} />
                            <Text style={styles.needStatus}>{need.status}</Text>
                          </View>
                        </View>
                        <MaterialIcons name="arrow-forward-ios" size={12} color={Colors.textLight} />
                      </TouchableOpacity>
                    ))}
                  </View>
                ))}

                {/* Browse all link */}
                <TouchableOpacity
                  style={styles.browseAll}
                  onPress={() => {
                    setQuery('');
                    setIsFocused(false);
                    Keyboard.dismiss();
                    router.push('/(tabs)/search');
                  }}
                  activeOpacity={0.7}
                >
                  <MaterialIcons name="manage-search" size={18} color={Colors.primary} />
                  <Text style={styles.browseAllText}>Browse all needs</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    zIndex: 100,
    position: 'relative',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.lg,
    height: 48,
    gap: Spacing.sm,
    borderWidth: 1.5,
    borderColor: Colors.border,
    ...Shadow.sm,
  },
  searchContainerFocused: {
    borderColor: Colors.primary,
    ...Shadow.md,
  },
  searchInput: {
    flex: 1,
    fontSize: FontSize.md,
    color: Colors.text,
    paddingVertical: 0,
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' as any } : {}),
  },
  backdrop: {
    position: 'absolute',
    top: 56,
    left: -Spacing.lg,
    right: -Spacing.lg,
    bottom: -500,
    zIndex: 98,
  },
  resultsContainer: {
    position: 'absolute',
    top: 56,
    left: 0,
    right: 0,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    ...Shadow.lg,
    zIndex: 99,
    maxHeight: 420,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  resultsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  resultsHeaderText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  noResults: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
    gap: Spacing.sm,
  },
  noResultsText: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  noResultsHint: {
    fontSize: FontSize.sm,
    color: Colors.textLight,
  },
  userGroup: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.surfaceAlt,
  },
  userAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: Colors.primaryLight,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.text,
  },
  highlightText: {
    backgroundColor: Colors.accentLight,
    color: Colors.primary,
    fontWeight: '800',
  },
  cityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 1,
  },
  cityText: {
    fontSize: FontSize.xs,
    color: Colors.textLight,
  },
  viewProfileBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primaryLight,
  },
  viewProfileText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.primary,
  },
  needItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingLeft: Spacing.lg + 18 + Spacing.md, // Align with user name (avatar width + gap)
    paddingVertical: Spacing.sm,
  },
  needDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.primary,
    opacity: 0.5,
  },
  needContent: {
    flex: 1,
    gap: 3,
  },
  needTitle: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
  },
  needMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  needProgressMini: {
    width: 50,
  },
  needAmount: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  needStatus: {
    fontSize: FontSize.xs,
    color: Colors.textLight,
  },
  browseAll: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.primaryLight,
    borderBottomLeftRadius: BorderRadius.xl,
    borderBottomRightRadius: BorderRadius.xl,
  },
  browseAllText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.primary,
  },
});
