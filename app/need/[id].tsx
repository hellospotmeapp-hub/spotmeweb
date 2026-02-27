import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Platform, Alert, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, BorderRadius, FontSize, Spacing, Shadow } from '@/app/lib/theme';
import { useApp } from '@/app/lib/store';
import { supabase } from '@/app/lib/supabase';
import ProgressBar from '@/components/ProgressBar';
import CategoryBadge from '@/components/CategoryBadge';
import StatusBadge from '@/components/StatusBadge';
import ContributeModal from '@/components/ContributeModal';
import ReportModal from '@/components/ReportModal';
import ShareSheet from '@/components/ShareSheet';
import SignInPromptModal from '@/components/SignInPromptModal';
import LiveDonationFeed from '@/components/LiveDonationFeed';
import VideoPlayer from '@/components/VideoPlayer';
import RecordThankYouModal from '@/components/RecordThankYouModal';
import ExpirationTimer from '@/components/ExpirationTimer';
import EditNeedModal from '@/components/EditNeedModal';


function getTimeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffHours < 1) return 'just now';
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'yesterday';
  return `${diffDays}d ago`;
}

const NEED_EXPIRATION_MS = 14 * 24 * 60 * 60 * 1000;

function isExpiredByTime(createdAt: string, expiresAt?: string): boolean {
  const exp = expiresAt 
    ? new Date(expiresAt).getTime()
    : new Date(createdAt).getTime() + NEED_EXPIRATION_MS;
  return Date.now() >= exp;
}

interface ThankYouVideoData {
  id: string;
  video_url: string;
  thumbnail_url?: string;
  message: string;
  user_name: string;
  user_avatar: string;
  created_at: string;
  views: number;
  likes: number;
}

export default function NeedDetailScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { needs, contribute, editNeed, deleteNeed, reportNeed, blockUser, requestPayout, currentUser, isLoggedIn, createThankYou, refreshNeeds } = useApp();

  
  const [showContribute, setShowContribute] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showAllContributors, setShowAllContributors] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showSignInPrompt, setShowSignInPrompt] = useState(false);
  const [showRecordThankYou, setShowRecordThankYou] = useState(false);
  const [showEditNeed, setShowEditNeed] = useState(false);
  const [thankYouVideo, setThankYouVideo] = useState<ThankYouVideoData | null>(null);
  const [payoutLoading, setPayoutLoading] = useState(false);
  const [payoutMessage, setPayoutMessage] = useState('');
  const [payoutSuccess, setPayoutSuccess] = useState(false);

  const need = needs.find(n => n.id === id);
  const topPadding = Platform.OS === 'web' ? 16 : insets.top;

  // Fetch thank-you video
  useEffect(() => {
    if (id) {
      (async () => {
        try {
          const { data, error } = await supabase.functions.invoke('upload-thankyou-video', {
            body: { action: 'get_by_need', needId: id },
          });
          if (!error && data?.success && data.video) {
            setThankYouVideo(data.video);
          }
        } catch {}
      })();
    }
  }, [id]);

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
  
  // Comprehensive expiration check
  const isExpired = need.status === 'Expired' || (need.status === 'Collecting' && isExpiredByTime(need.createdAt, need.expiresAt));
  const isComplete = need.status !== 'Collecting' || isExpired;
  const isFunded = need.status === 'Goal Met' || need.status === 'Payout Requested' || need.status === 'Paid';
  const canContribute = need.status === 'Collecting' && !isExpired;
  
  // Payout eligibility: owner + (goal met OR expired with funds)
  const canRequestPayout = isOwner && !payoutSuccess && (
    need.status === 'Goal Met' || 
    (isExpired && need.raisedAmount > 0 && need.status !== 'Payout Requested' && need.status !== 'Paid')
  );

  const handleContribute = (amount: number, note?: string) => {
    contribute(need.id, amount, note);
  };

  const handleReport = (reason: string) => {
    reportNeed(need.id, reason);
  };

  const handleBlock = () => {
    blockUser(need.userId);
    router.back();
  };

  const handleSpotMe = () => {
    if (!isLoggedIn) {
      setShowSignInPrompt(true);
      return;
    }
    if (!canContribute) return;
    setShowContribute(true);
  };

  const handleRequestPayout = async () => {
    if (payoutLoading || payoutSuccess) return;
    
    // Confirmation
    if (Platform.OS === 'web') {
      const confirmed = window.confirm(
        `Request payout of $${need.raisedAmount} for "${need.title}"?\n\nFunds will be sent to your connected bank account. Processing takes 2-3 business days.`
      );
      if (!confirmed) return;
    }

    setPayoutLoading(true);
    setPayoutMessage('');
    
    try {
      const result = await requestPayout(need.id);
      
      if (result.success) {
        setPayoutSuccess(true);
        setPayoutMessage(result.message || `Payout of $${need.raisedAmount} requested successfully!`);
        // Refresh needs to get updated status
        setTimeout(() => refreshNeeds(), 1500);
      } else {
        setPayoutMessage(result.error || 'Failed to request payout. Please try again.');
      }
    } catch (err: any) {
      setPayoutMessage(err.message || 'An unexpected error occurred.');
    } finally {
      setPayoutLoading(false);
    }
  };

  const handleThankYouVideoSuccess = (video: { id: string; videoUrl: string; message: string }) => {
    createThankYou(need.id, video.message, video.videoUrl);
    setThankYouVideo({
      id: video.id,
      video_url: video.videoUrl,
      message: video.message,
      user_name: currentUser.name,
      user_avatar: currentUser.avatar,
      created_at: new Date().toISOString(),
      views: 0,
      likes: 0,
    });
  };

  const displayedContributions = showAllContributors
    ? need.contributions
    : need.contributions.slice(0, 5);

  // Effective display status
  const displayStatus = isExpired && need.status === 'Collecting' ? 'Expired' : need.status;

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => { try { router.replace('/(tabs)'); } catch { router.back(); } }}>

          <MaterialIcons name="arrow-back" size={24} color={Colors.text} />

        </TouchableOpacity>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerBtn} onPress={() => setShowShare(true)}>
            <MaterialIcons name="share" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
          {isOwner && need.status === 'Collecting' && !isExpired && (
            <TouchableOpacity style={styles.headerBtn} onPress={() => setShowEditNeed(true)}>
              <MaterialIcons name="edit" size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          )}
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
            <StatusBadge status={displayStatus} />
          </View>

          <Text style={styles.title}>{need.title}</Text>

          <TouchableOpacity style={styles.userRow} onPress={() => router.push(`/user/${need.userId}`)} activeOpacity={0.7}>
            <Image source={{ uri: need.userAvatar }} style={styles.avatar} />
            <View style={styles.userInfo}>
              <View style={styles.userNameRow}>
                <Text style={styles.userName}>{need.userName}</Text>
                <MaterialIcons name="chevron-right" size={16} color={Colors.textLight} />
              </View>
              <View style={styles.metaRow}>
                <MaterialIcons name="place" size={14} color={Colors.textLight} />
                <Text style={styles.metaText}>{need.userCity}</Text>
                <Text style={styles.metaDot}>·</Text>
                <Text style={styles.metaText}>{getTimeAgo(need.createdAt)}</Text>
              </View>
            </View>
          </TouchableOpacity>

          {/* Expiration Timer */}
          <ExpirationTimer
            expiresAt={need.expiresAt}
            createdAt={need.createdAt}
            status={displayStatus}
          />

          <View style={styles.messageCard}>
            <Text style={styles.message}>{need.message}</Text>
          </View>

          <View style={styles.progressSection}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressTitle}>Progress</Text>
              <Text style={styles.progressPercent}>{Math.round(progress * 100)}%</Text>
            </View>
            <ProgressBar progress={progress} height={14} showGlow={!isExpired} />
            <View style={styles.progressStats}>
              <View>
                <Text style={styles.raisedAmount}>${need.raisedAmount}</Text>
                <Text style={styles.raisedLabel}>raised of ${need.goalAmount}</Text>
              </View>
              <View style={styles.progressRight}>
                <Text style={styles.contributorCount}>{need.contributorCount}</Text>
                <Text style={styles.contributorLabel}>supporters</Text>
              </View>
              {canContribute && (
                <View style={styles.progressRight}>
                  <Text style={styles.remainingAmount}>${remaining}</Text>
                  <Text style={styles.remainingLabel}>to go</Text>
                </View>
              )}
            </View>
          </View>

          {/* Expired Need Banner */}
          {isExpired && (
            <View style={styles.expiredBanner}>
              <MaterialIcons name="timer-off" size={28} color={Colors.textLight} />
              <View style={{ flex: 1 }}>
                <Text style={styles.expiredBannerTitle}>Need Expired</Text>
                <Text style={styles.expiredBannerSub}>
                  {need.raisedAmount > 0
                    ? `This need expired with $${need.raisedAmount} raised. ${isOwner ? 'You can request a payout for the funds collected below.' : 'The owner can still request a payout.'}`
                    : 'This need expired without receiving any contributions.'}
                </Text>
              </View>
            </View>
          )}

          {/* Payout Request Button for owner */}
          {canRequestPayout && (
            <View style={styles.payoutSection}>
              <TouchableOpacity 
                style={[styles.payoutBtn, payoutLoading && { opacity: 0.6 }]} 
                onPress={handleRequestPayout} 
                activeOpacity={0.8}
                disabled={payoutLoading}
              >
                {payoutLoading ? (
                  <ActivityIndicator size="small" color={Colors.white} />
                ) : (
                  <MaterialIcons name="account-balance-wallet" size={20} color={Colors.white} />
                )}
                <Text style={styles.payoutBtnText}>
                  {payoutLoading ? 'Processing...' : `Request Payout — $${need.raisedAmount}`}
                </Text>
              </TouchableOpacity>
              {payoutMessage ? (
                <View style={[
                  styles.payoutMsgCard,
                  payoutSuccess ? styles.payoutMsgSuccess : styles.payoutMsgError
                ]}>
                  <MaterialIcons 
                    name={payoutSuccess ? 'check-circle' : 'error-outline'} 
                    size={18} 
                    color={payoutSuccess ? Colors.success : Colors.error} 
                  />
                  <Text style={[
                    styles.payoutMsg, 
                    { color: payoutSuccess ? Colors.success : Colors.error }
                  ]}>
                    {payoutMessage}
                  </Text>
                </View>
              ) : null}
              <Text style={styles.payoutNote}>
                Funds will be sent to your connected bank account. Set up payouts in Settings if you haven't already. Processing takes 2-3 business days.
              </Text>
              {!payoutSuccess && (
                <TouchableOpacity 
                  style={styles.payoutSetupLink} 
                  onPress={() => router.push('/payouts')}
                  activeOpacity={0.7}
                >
                  <MaterialIcons name="settings" size={14} color={Colors.primary} />
                  <Text style={styles.payoutSetupLinkText}>View Payout Dashboard</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Payout Success Banner (after requesting) */}
          {payoutSuccess && (
            <View style={styles.payoutSuccessBanner}>
              <MaterialIcons name="check-circle" size={28} color={Colors.success} />
              <View style={{ flex: 1 }}>
                <Text style={styles.payoutSuccessTitle}>Payout Requested!</Text>
                <Text style={styles.payoutSuccessSub}>
                  Your payout of ${need.raisedAmount} is being processed. You'll receive the funds in 2-3 business days.
                </Text>
              </View>
            </View>
          )}

          {/* Payout Requested Banner */}
          {need.status === 'Payout Requested' && !payoutSuccess && (
            <View style={styles.payoutRequestedBanner}>
              <MaterialIcons name="hourglass-top" size={28} color={Colors.accent} />
              <View style={{ flex: 1 }}>
                <Text style={styles.payoutRequestedTitle}>Payout Processing</Text>
                <Text style={styles.payoutRequestedSub}>
                  Your payout of ${need.raisedAmount} is being processed. Funds typically arrive in 2-3 business days.
                </Text>
                {isOwner && (
                  <TouchableOpacity 
                    style={styles.viewPayoutDashLink}
                    onPress={() => router.push('/payouts')}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.viewPayoutDashText}>View Payout Dashboard</Text>
                    <MaterialIcons name="chevron-right" size={16} color={Colors.primary} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          {/* Paid Banner */}
          {need.status === 'Paid' && (
            <View style={styles.paidBanner}>
              <MaterialIcons name="check-circle" size={28} color={Colors.success} />
              <View style={{ flex: 1 }}>
                <Text style={styles.paidBannerTitle}>Payout Complete</Text>
                <Text style={styles.paidBannerSub}>
                  ${need.raisedAmount} has been sent to the recipient's bank account.
                </Text>
              </View>
            </View>
          )}

          {/* Thank You Video */}
          {thankYouVideo && (
            <View style={styles.thankYouVideoCard}>
              <View style={styles.thankYouVideoHeader}>
                <MaterialIcons name="videocam" size={18} color={Colors.accent} />
                <Text style={styles.thankYouVideoTitle}>Thank You Video</Text>
                <TouchableOpacity onPress={() => router.push(`/thankyou/${thankYouVideo.id}`)}>
                  <Text style={styles.thankYouViewFull}>View full</Text>
                </TouchableOpacity>
              </View>
              <VideoPlayer videoUrl={thankYouVideo.video_url} thumbnailUrl={thankYouVideo.thumbnail_url} compact />
              {thankYouVideo.message ? (
                <View style={styles.thankYouMsgRow}>
                  <Image source={{ uri: thankYouVideo.user_avatar }} style={styles.thankYouMsgAvatar} />
                  <Text style={styles.thankYouMsgText} numberOfLines={3}>"{thankYouVideo.message}"</Text>
                </View>
              ) : null}
            </View>
          )}

          {/* Record Thank You for owners of funded needs */}
          {isOwner && isFunded && !thankYouVideo && (
            <TouchableOpacity style={styles.recordThankYouBtn} onPress={() => setShowRecordThankYou(true)} activeOpacity={0.8}>
              <View style={styles.recordThankYouIcon}>
                <MaterialIcons name="videocam" size={24} color="#FFF" />
              </View>
              <View style={styles.recordThankYouContent}>
                <Text style={styles.recordThankYouTitle}>Record a Thank You</Text>
                <Text style={styles.recordThankYouSub}>Say thanks with a short video (15-60 sec)</Text>
              </View>
              <MaterialIcons name="chevron-right" size={22} color={Colors.accent} />
            </TouchableOpacity>
          )}

          {/* Goal Met Banner */}
          {need.status === 'Goal Met' && !isOwner && (
            <View style={styles.goalMetBanner}>
              <MaterialIcons name="celebration" size={28} color={Colors.success} />
              <View style={{ flex: 1 }}>
                <Text style={styles.goalMetTitle}>Goal Met!</Text>
                <Text style={styles.goalMetSubtitle}>This need has been fully funded by the community.</Text>
              </View>
            </View>
          )}

          {/* Share Banner */}
          <TouchableOpacity style={styles.shareBanner} onPress={() => setShowShare(true)} activeOpacity={0.7}>
            <View style={styles.shareBannerLeft}>
              <MaterialIcons name="share" size={20} color={Colors.primary} />
              <View>
                <Text style={styles.shareBannerTitle}>Share this need</Text>
                <Text style={styles.shareBannerSubtitle}>QR code, TikTok, link & more</Text>
              </View>
            </View>
            <MaterialIcons name="chevron-right" size={22} color={Colors.primary} />
          </TouchableOpacity>

          {/* Contribute Section */}
          {canContribute && !isOwner && (
            <View style={styles.contributeSection}>
              <Text style={styles.contributeSectionTitle}>Spot this need</Text>
              <View style={styles.contributeGrid}>
                {[1, 5, 10, 25].map(amount => (
                  <TouchableOpacity key={amount} style={styles.contributeBtn} onPress={handleSpotMe} activeOpacity={0.7}>
                    <MaterialIcons name="favorite" size={16} color={Colors.primary} />
                    <Text style={styles.contributeBtnText}>${amount}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity style={styles.customContributeBtn} onPress={handleSpotMe} activeOpacity={0.8}>
                <MaterialIcons name="favorite" size={20} color={Colors.white} />
                <Text style={styles.customContributeBtnText}>Spot {(need.userName || 'Them').split(' ')[0]}</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Expired - Can't contribute message */}
          {isExpired && !isOwner && (
            <View style={styles.cantContributeCard}>
              <MaterialIcons name="info-outline" size={18} color={Colors.textLight} />
              <Text style={styles.cantContributeText}>
                This need has expired and is no longer accepting contributions.
              </Text>
            </View>
          )}

          {/* Supporters */}
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
                <Text style={styles.noContributorsText}>
                  {isExpired ? 'No contributions were made' : 'Be the first to spot this need'}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.shareInfoCard}>
            <MaterialIcons name="link" size={18} color={Colors.secondary} />
            <View style={styles.shareInfoContent}>
              <Text style={styles.shareInfoTitle}>Shareable Link</Text>
              <Text style={styles.shareInfoText}>
                This need has a unique shareable page at /share/{need.id} — perfect for TikTok bio links, Instagram stories, and more.
              </Text>
            </View>
          </View>

          <View style={styles.feeCard}>
            <MaterialIcons name="info-outline" size={18} color={Colors.success} />
            <Text style={styles.feeText}>
              SpotMe takes no platform fee — 100% of your contribution goes directly to the person in need. Stripe processing (2.9% + $0.30) applies. You can leave an optional tip at checkout to support SpotMe.
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
      <ShareSheet
        visible={showShare}
        onClose={() => setShowShare(false)}
        needId={need.id}
        needTitle={need.title}
        needMessage={need.message}
        needPhoto={need.photo}
        needRaised={need.raisedAmount}
        needGoal={need.goalAmount}
        userName={need.userName}
        userAvatar={need.userAvatar}
        userCity={need.userCity}
        category={need.category}
        contributorCount={need.contributorCount}
      />
      <SignInPromptModal
        visible={showSignInPrompt}
        onClose={() => setShowSignInPrompt(false)}
        userName={need.userName}
        userAvatar={need.userAvatar}
        needTitle={need.title}
        remaining={remaining}
      />
      <RecordThankYouModal
        visible={showRecordThankYou}
        onClose={() => setShowRecordThankYou(false)}
        onSuccess={handleThankYouVideoSuccess}
        needId={need.id}
        needTitle={need.title}
        userId={currentUser.id}
        userName={currentUser.name}
        userAvatar={currentUser.avatar}
      />
      {showEditNeed && (
        <EditNeedModal
          visible={showEditNeed}
          onClose={() => setShowEditNeed(false)}
          onSave={async (updates) => {
            const result = await editNeed(need.id, updates);
            return result;
          }}
          onDelete={async () => {
            const result = await deleteNeed(need.id);
            if (result.success) {
              try { router.replace('/(tabs)'); } catch { router.back(); }

            }
            return result;
          }}
          need={need}
        />
      )}
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
  userNameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
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

  // Expired Banner
  expiredBanner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: '#F0EDE9', padding: Spacing.xl, borderRadius: BorderRadius.xl, borderWidth: 1, borderColor: '#E8E4DF' },
  expiredBannerTitle: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.textSecondary },
  expiredBannerSub: { fontSize: FontSize.sm, color: Colors.textLight, marginTop: 4, lineHeight: 20 },

  // Payout Section
  payoutSection: { gap: Spacing.sm },
  payoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: Colors.secondary, paddingVertical: Spacing.lg, borderRadius: BorderRadius.xl, ...Shadow.md },
  payoutBtnText: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.white },
  payoutMsgCard: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, padding: Spacing.md, borderRadius: BorderRadius.lg },
  payoutMsgSuccess: { backgroundColor: '#E8F5E8' },
  payoutMsgError: { backgroundColor: '#FFF0F0' },
  payoutMsg: { flex: 1, fontSize: FontSize.sm, fontWeight: '600', lineHeight: 20 },
  payoutNote: { fontSize: FontSize.xs, color: Colors.textLight, textAlign: 'center', lineHeight: 18 },
  payoutSetupLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: Spacing.sm },
  payoutSetupLinkText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.primary },

  // Payout Success Banner
  payoutSuccessBanner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: '#E8F5E8', padding: Spacing.xl, borderRadius: BorderRadius.xl, borderWidth: 1, borderColor: Colors.success + '30' },
  payoutSuccessTitle: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.success },
  payoutSuccessSub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 4, lineHeight: 20 },

  // Payout Requested Banner
  payoutRequestedBanner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: Colors.accentLight, padding: Spacing.xl, borderRadius: BorderRadius.xl, borderWidth: 1, borderColor: Colors.accent + '30' },
  payoutRequestedTitle: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.accent },
  payoutRequestedSub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 4, lineHeight: 20 },
  viewPayoutDashLink: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: Spacing.sm },
  viewPayoutDashText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.primary },

  // Paid Banner
  paidBanner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: '#E8F5E8', padding: Spacing.xl, borderRadius: BorderRadius.xl, borderWidth: 1, borderColor: Colors.success + '30' },
  paidBannerTitle: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.success },
  paidBannerSub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 4, lineHeight: 20 },

  // Can't contribute
  cantContributeCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: '#F0EDE9', padding: Spacing.lg, borderRadius: BorderRadius.lg },
  cantContributeText: { flex: 1, fontSize: FontSize.sm, color: Colors.textLight, lineHeight: 20 },

  // Thank You Video
  thankYouVideoCard: { backgroundColor: Colors.surface, borderRadius: BorderRadius.xl, overflow: 'hidden', ...Shadow.md },
  thankYouVideoHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.lg, paddingBottom: Spacing.sm },
  thankYouVideoTitle: { flex: 1, fontSize: FontSize.md, fontWeight: '800', color: Colors.text },
  thankYouViewFull: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.primary },
  thankYouMsgRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, padding: Spacing.lg, paddingTop: Spacing.sm },
  thankYouMsgAvatar: { width: 28, height: 28, borderRadius: 14 },
  thankYouMsgText: { flex: 1, fontSize: FontSize.sm, color: Colors.textSecondary, fontStyle: 'italic', lineHeight: 20 },

  // Record Thank You
  recordThankYouBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: Colors.accentLight, borderRadius: BorderRadius.xl, padding: Spacing.lg, borderWidth: 1.5, borderColor: Colors.accent + '40' },
  recordThankYouIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center' },
  recordThankYouContent: { flex: 1 },
  recordThankYouTitle: { fontSize: FontSize.md, fontWeight: '800', color: Colors.text },
  recordThankYouSub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },

  // Goal Met
  goalMetBanner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: '#E8F5E8', padding: Spacing.xl, borderRadius: BorderRadius.xl },
  goalMetTitle: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.success },
  goalMetSubtitle: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },

  shareBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.primaryLight, borderRadius: BorderRadius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.primary + '20' },
  shareBannerLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  shareBannerTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text },
  shareBannerSubtitle: { fontSize: FontSize.xs, color: Colors.textSecondary },
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
  shareInfoCard: { flexDirection: 'row', gap: Spacing.md, backgroundColor: Colors.secondaryLight, padding: Spacing.lg, borderRadius: BorderRadius.lg },
  shareInfoContent: { flex: 1 },
  shareInfoTitle: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.text, marginBottom: 2 },
  shareInfoText: { fontSize: FontSize.xs, color: Colors.textSecondary, lineHeight: 18 },
  feeCard: { flexDirection: 'row', gap: Spacing.sm, backgroundColor: Colors.surfaceAlt, padding: Spacing.lg, borderRadius: BorderRadius.lg },
  feeText: { flex: 1, fontSize: FontSize.xs, color: Colors.textLight, lineHeight: 18 },
  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
  notFoundTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textSecondary },
  notFoundLink: { fontSize: FontSize.md, fontWeight: '600', color: Colors.primary },
});
