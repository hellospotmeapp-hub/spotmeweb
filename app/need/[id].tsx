import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Share, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, BorderRadius, FontSize, Spacing, Shadow } from '@/app/lib/theme';
import { useApp } from '@/app/lib/store';
import ProgressBar from '@/components/ProgressBar';
import CategoryBadge from '@/components/CategoryBadge';
import StatusBadge from '@/components/StatusBadge';
import ContributeModal from '@/components/ContributeModal';
import ReportModal from '@/components/ReportModal';

function getTimeAgo(dateStr: string): string {
  const now = new Date('2026-02-14T02:40:00Z');
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'yesterday';
  return `${diffDays}d ago`;
}

export default function NeedDetailScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { needs, contribute, reportNeed, blockUser, requestPayout, currentUser } = useApp();
  
  const [showContribute, setShowContribute] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showAllContributors, setShowAllContributors] = useState(false);

  const need = needs.find(n => n.id === id);
  const topPadding = Platform.OS === 'web' ? 16 : insets.top;

  if (!need) {
    return (
      <View style={[styles.container, { paddingTop: topPadding }]}>
        <View style={styles.notFound}>
          <MaterialIcons name="error-outline" size={64} color={Colors.borderLight} />
          <Text style={styles.notFoundTitle}>Need not found</Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.notFoundLink}>Go back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const progress = need.raisedAmount / need.goalAmount;
  const remaining = need.goalAmount - need.raisedAmount;
  const isOwner = need.userId === currentUser.id || need.userId === 'current';
  const isComplete = need.status !== 'Collecting';

  const handleContribute = (amount: number, note?: string) => {
    contribute(need.id, amount, note);
  };

  const handleShare = async () => {
    try {
      if (Platform.OS === 'web' && navigator.share) {
        await navigator.share({
          title: `Help ${need.userName} on SpotMe`,
          text: `Help ${need.userName} with "${need.title}" on SpotMe! They need $${remaining} more.`,
          url: window.location.href,
        });
      } else {
        await Share.share({
          message: `Help ${need.userName} with "${need.title}" on SpotMe! They need $${remaining} more to reach their goal of $${need.goalAmount}.`,
        });
      }
    } catch (e) {}
  };

  const handleReport = (reason: string) => {
    reportNeed(need.id, reason);
  };

  const handleBlock = () => {
    blockUser(need.userId);
    router.back();
  };

  const displayedContributions = showAllContributors
    ? need.contributions
    : need.contributions.slice(0, 5);

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerBtn} onPress={handleShare}>
            <MaterialIcons name="share" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
          {!isOwner && (
            <TouchableOpacity style={styles.headerBtn} onPress={() => setShowReport(true)}>
              <MaterialIcons name="more-vert" size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {need.photo && (
          <Image source={{ uri: need.photo }} style={styles.photo} />
        )}

        <View style={styles.content}>
          <View style={styles.badgeRow}>
            <CategoryBadge category={need.category} size="md" />
            <StatusBadge status={need.status} />
          </View>

          <Text style={styles.title}>{need.title}</Text>

          <View style={styles.userRow}>
            <Image source={{ uri: need.userAvatar }} style={styles.avatar} />
            <View style={styles.userInfo}>
              <Text style={styles.userName}>{need.userName}</Text>
              <View style={styles.metaRow}>
                <MaterialIcons name="place" size={14} color={Colors.textLight} />
                <Text style={styles.metaText}>{need.userCity}</Text>
                <Text style={styles.metaDot}>·</Text>
                <Text style={styles.metaText}>{getTimeAgo(need.createdAt)}</Text>
              </View>
            </View>
          </View>

          <View style={styles.messageCard}>
            <Text style={styles.message}>{need.message}</Text>
          </View>

          <View style={styles.progressSection}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressTitle}>Progress</Text>
              <Text style={styles.progressPercent}>{Math.round(progress * 100)}%</Text>
            </View>
            <ProgressBar progress={progress} height={14} showGlow />
            <View style={styles.progressStats}>
              <View>
                <Text style={styles.raisedAmount}>${need.raisedAmount}</Text>
                <Text style={styles.raisedLabel}>raised of ${need.goalAmount}</Text>
              </View>
              <View style={styles.progressRight}>
                <Text style={styles.contributorCount}>{need.contributorCount}</Text>
                <Text style={styles.contributorLabel}>supporters</Text>
              </View>
              {!isComplete && (
                <View style={styles.progressRight}>
                  <Text style={styles.remainingAmount}>${remaining}</Text>
                  <Text style={styles.remainingLabel}>to go</Text>
                </View>
              )}
            </View>
          </View>

          {need.status === 'Goal Met' && (
            <View style={styles.goalMetBanner}>
              <MaterialIcons name="celebration" size={28} color={Colors.success} />
              <View>
                <Text style={styles.goalMetTitle}>Goal Met!</Text>
                <Text style={styles.goalMetSubtitle}>This need has been fully funded by the community.</Text>
              </View>
            </View>
          )}

          {isOwner && need.status === 'Goal Met' && (
            <TouchableOpacity style={styles.payoutBtn} onPress={() => requestPayout(need.id)} activeOpacity={0.8}>
              <MaterialIcons name="account-balance-wallet" size={20} color={Colors.white} />
              <Text style={styles.payoutBtnText}>Request Payout</Text>
            </TouchableOpacity>
          )}

          {!isComplete && !isOwner && (
            <View style={styles.contributeSection}>
              <Text style={styles.contributeSectionTitle}>Spot this need</Text>
              <View style={styles.contributeGrid}>
                {[1, 5, 10, 25].map(amount => (
                  <TouchableOpacity key={amount} style={styles.contributeBtn} onPress={() => setShowContribute(true)} activeOpacity={0.7}>
                    <MaterialIcons name="favorite" size={16} color={Colors.primary} />
                    <Text style={styles.contributeBtnText}>${amount}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity style={styles.customContributeBtn} onPress={() => setShowContribute(true)} activeOpacity={0.8}>
                <MaterialIcons name="favorite" size={20} color={Colors.white} />
                <Text style={styles.customContributeBtnText}>Spot Custom Amount</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.contributorSection}>
            <Text style={styles.contributorSectionTitle}>Supporters ({need.contributions.length})</Text>
            {displayedContributions.map(contrib => (
              <View key={contrib.id} style={styles.contributorRow}>
                <Image source={{ uri: contrib.userAvatar }} style={styles.contributorAvatar} />
                <View style={styles.contributorInfo}>
                  <View style={styles.contributorNameRow}>
                    <Text style={styles.contributorName}>{contrib.userName}</Text>
                    <Text style={styles.contributorAmount}>spotted ${contrib.amount}</Text>
                  </View>
                  {contrib.note && <Text style={styles.contributorNote}>"{contrib.note}"</Text>}
                  <Text style={styles.contributorTime}>{getTimeAgo(contrib.timestamp)}</Text>
                </View>
              </View>
            ))}
            {need.contributions.length > 5 && !showAllContributors && (
              <TouchableOpacity style={styles.showMoreBtn} onPress={() => setShowAllContributors(true)}>
                <Text style={styles.showMoreText}>Show all {need.contributions.length} supporters</Text>
              </TouchableOpacity>
            )}
            {need.contributions.length === 0 && (
              <View style={styles.noContributors}>
                <MaterialIcons name="favorite-border" size={32} color={Colors.borderLight} />
                <Text style={styles.noContributorsText}>Be the first to spot this need</Text>
              </View>
            )}
          </View>

          <View style={styles.feeCard}>
            <MaterialIcons name="info-outline" size={18} color={Colors.textLight} />
            <Text style={styles.feeText}>
              SpotMe charges a 5% platform fee on contributions to keep the service running. The rest goes directly to the person in need.
            </Text>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      <ContributeModal
        visible={showContribute}
        onClose={() => setShowContribute(false)}
        onContribute={handleContribute}
        needTitle={need.title}
        needId={need.id}
        remaining={remaining}
        contributorName={currentUser.name}
      />

      <ReportModal
        visible={showReport}
        onClose={() => setShowReport(false)}
        onReport={handleReport}
        onBlock={handleBlock}
        type="need"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  headerActions: { flexDirection: 'row', gap: Spacing.sm },
  headerBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  photo: { width: '100%', height: 280 },
  content: { padding: Spacing.xl, gap: Spacing.lg },
  badgeRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
  title: { fontSize: FontSize.xxl, fontWeight: '900', color: Colors.text, lineHeight: 30 },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  userInfo: { flex: 1 },
  userName: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  metaText: { fontSize: FontSize.xs, color: Colors.textLight },
  metaDot: { color: Colors.textLight },
  messageCard: { backgroundColor: Colors.surface, borderRadius: BorderRadius.xl, padding: Spacing.xl, borderLeftWidth: 4, borderLeftColor: Colors.primary, ...Shadow.sm },
  message: { fontSize: FontSize.md, color: Colors.textSecondary, lineHeight: 24 },
  progressSection: { backgroundColor: Colors.surface, borderRadius: BorderRadius.xl, padding: Spacing.xl, gap: Spacing.md, ...Shadow.sm },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressTitle: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.text },
  progressPercent: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.primary },
  progressStats: { flexDirection: 'row', justifyContent: 'space-between' },
  raisedAmount: { fontSize: FontSize.xl, fontWeight: '900', color: Colors.text },
  raisedLabel: { fontSize: FontSize.xs, color: Colors.textLight },
  progressRight: { alignItems: 'flex-end' },
  contributorCount: { fontSize: FontSize.xl, fontWeight: '900', color: Colors.secondary },
  contributorLabel: { fontSize: FontSize.xs, color: Colors.textLight },
  remainingAmount: { fontSize: FontSize.xl, fontWeight: '900', color: Colors.accent },
  remainingLabel: { fontSize: FontSize.xs, color: Colors.textLight },
  goalMetBanner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: '#E8F5E8', padding: Spacing.xl, borderRadius: BorderRadius.xl },
  goalMetTitle: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.success },
  goalMetSubtitle: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  payoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: Colors.secondary, paddingVertical: Spacing.lg, borderRadius: BorderRadius.xl, ...Shadow.md },
  payoutBtnText: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.white },
  contributeSection: { gap: Spacing.md },
  contributeSectionTitle: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.text },
  contributeGrid: { flexDirection: 'row', gap: Spacing.sm },
  contributeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: Spacing.md, borderRadius: BorderRadius.lg, backgroundColor: Colors.primaryLight },
  contributeBtnText: { fontSize: FontSize.md, fontWeight: '700', color: Colors.primary },
  customContributeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: Colors.primary, paddingVertical: Spacing.lg, borderRadius: BorderRadius.xl, ...Shadow.md },
  customContributeBtnText: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.white },
  contributorSection: { gap: Spacing.md },
  contributorSectionTitle: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.text },
  contributorRow: { flexDirection: 'row', gap: Spacing.md, paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  contributorAvatar: { width: 40, height: 40, borderRadius: 20 },
  contributorInfo: { flex: 1, gap: 2 },
  contributorNameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  contributorName: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text },
  contributorAmount: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.primary },
  contributorNote: { fontSize: FontSize.sm, color: Colors.textSecondary, fontStyle: 'italic' },
  contributorTime: { fontSize: FontSize.xs, color: Colors.textLight },
  showMoreBtn: { paddingVertical: Spacing.md, alignItems: 'center' },
  showMoreText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.primary },
  noContributors: { alignItems: 'center', paddingVertical: Spacing.xxl, gap: Spacing.sm },
  noContributorsText: { fontSize: FontSize.sm, color: Colors.textLight },
  feeCard: { flexDirection: 'row', gap: Spacing.sm, backgroundColor: Colors.surfaceAlt, padding: Spacing.lg, borderRadius: BorderRadius.lg },
  feeText: { flex: 1, fontSize: FontSize.xs, color: Colors.textLight, lineHeight: 18 },
  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
  notFoundTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textSecondary },
  notFoundLink: { fontSize: FontSize.md, fontWeight: '600', color: Colors.primary },
});
