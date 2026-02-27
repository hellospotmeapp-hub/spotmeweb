import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, TextInput, Platform, Modal, ActivityIndicator, Linking } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, BorderRadius, FontSize, Spacing, Shadow } from '@/app/lib/theme';
import { useApp } from '@/app/lib/store';
import { Need } from '@/app/lib/data';
import { pickAndUploadAvatar } from '@/app/lib/imageUpload';
import NeedCard from '@/components/NeedCard';
import StatusBadge from '@/components/StatusBadge';
import ThankYouCard from '@/components/ThankYouCard';
import ShareSheet from '@/components/ShareSheet';
import RecordThankYouModal from '@/components/RecordThankYouModal';
import BulkNeedManager from '@/components/BulkNeedManager';
import EditNeedModal from '@/components/EditNeedModal';
import ReceiptHistory from '@/components/ReceiptHistory';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { currentUser, needs, thankYouUpdates, isLoggedIn, isLoading, logout, updateProfile, requestPayout, payoutStatus, createThankYou, togglePinUpdate, likeUpdate, deleteNeed, editNeed } = useApp();


  const [activeTab, setActiveTab] = useState<'active' | 'completed' | 'updates' | 'given' | 'receipts'>('active');

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(currentUser.name);
  const [editBio, setEditBio] = useState(currentUser.bio);
  const [editCity, setEditCity] = useState(currentUser.city);
  const [showThankYouModal, setShowThankYouModal] = useState(false);
  const [thankYouNeedId, setThankYouNeedId] = useState('');
  const [thankYouMsg, setThankYouMsg] = useState('');
  const [showShare, setShowShare] = useState(false);
  const [showRecordThankYou, setShowRecordThankYou] = useState(false);
  const [recordThankYouNeedId, setRecordThankYouNeedId] = useState('');
  const [recordThankYouNeedTitle, setRecordThankYouNeedTitle] = useState('');

  // Bulk manager & edit modal state
  const [showBulkManager, setShowBulkManager] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingNeed, setEditingNeed] = useState<Need | null>(null);

  // Payout state per need
  const [payoutLoadingId, setPayoutLoadingId] = useState<string | null>(null);
  const [payoutMessages, setPayoutMessages] = useState<Record<string, { msg: string; success: boolean }>>({});

  // Avatar change state
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarSuccess, setAvatarSuccess] = useState(false);

  const topPadding = Platform.OS === 'web' ? 0 : insets.top;

  const handleChangeAvatar = async () => {
    if (avatarUploading) return;
    setAvatarUploading(true);
    setAvatarSuccess(false);
    try {
      const result = await pickAndUploadAvatar(currentUser.id);
      if (result.error === 'cancelled') { setAvatarUploading(false); return; }
      if (result.success && result.avatarUrl) {
        updateProfile({ avatar: result.avatarUrl });
        setAvatarSuccess(true);
        setTimeout(() => setAvatarSuccess(false), 3000);
      } else if (result.localUri) {
        updateProfile({ avatar: result.localUri });
        setAvatarSuccess(true);
        setTimeout(() => setAvatarSuccess(false), 3000);
      }
    } catch (err) {
      console.error('Avatar change error:', err);
    } finally {
      setAvatarUploading(false);
    }
  };

  // Show loading state while auth is initializing
  if (isLoading && !isLoggedIn) {
    return (
      <View style={[styles.container, { paddingTop: topPadding }]}>
        <View style={styles.loginPrompt}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loginSubtitle}>Loading your profile...</Text>
        </View>
      </View>
    );
  }

  if (!isLoggedIn) {
    return (
      <View style={[styles.container, { paddingTop: topPadding }]}>
        <View style={styles.loginPrompt}>
          <MaterialIcons name="person-outline" size={64} color={Colors.borderLight} />
          <Text style={styles.loginTitle}>Sign in to view your profile</Text>
          <Text style={styles.loginSubtitle}>Create an account to post needs and help others</Text>
          <TouchableOpacity style={styles.loginButton} onPress={() => router.push('/auth')}>
            <Text style={styles.loginButtonText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const NEED_EXPIRATION_MS = 14 * 24 * 60 * 60 * 1000;
  const isExpiredByTime = (n: Need) => {
    if (n.status === 'Expired') return true;
    if (n.status !== 'Collecting') return false;
    const exp = n.expiresAt ? new Date(n.expiresAt).getTime() : new Date(n.createdAt).getTime() + NEED_EXPIRATION_MS;
    return Date.now() >= exp;
  };

  const myNeeds = needs.filter(n => n.userId === currentUser.id);
  const activeNeeds = myNeeds.filter(n => n.status === 'Collecting' && !isExpiredByTime(n));
  const completedNeeds = myNeeds.filter(n => n.status !== 'Collecting' || isExpiredByTime(n));
  const givenNeeds = needs.filter(n => n.contributions.some(c => c.userId === currentUser.id));

  const myUpdates = thankYouUpdates.filter(u => u.userId === currentUser.id);
  const pinnedUpdates = myUpdates.filter(u => u.pinned);


  const handleSaveProfile = () => { updateProfile({ name: editName.trim() || currentUser.name, bio: editBio, city: editCity }); setEditing(false); };

  // Payout eligibility check for a need
  const canRequestPayoutForNeed = (need: Need): boolean => {
    if (need.status === 'Payout Requested' || need.status === 'Paid') return false;
    if (need.raisedAmount <= 0) return false;
    if (payoutMessages[need.id]?.success) return false;
    if (need.status === 'Goal Met') return true;
    if (need.status === 'Expired' || isExpiredByTime(need)) return true;
    return false;
  };

  // Handle payout request with loading state
  const handleRequestPayoutForNeed = async (needId: string) => {
    if (payoutLoadingId) return;
    const need = myNeeds.find(n => n.id === needId);
    if (!need) return;
    if (Platform.OS === 'web') {
      const confirmed = window.confirm(
        `Request payout of $${need.raisedAmount} for "${need.title}"?\n\nProcessing takes 2-3 business days.`
      );
      if (!confirmed) return;
    }
    setPayoutLoadingId(needId);
    try {
      const result = await requestPayout(needId);
      if (result.success) {
        setPayoutMessages(prev => ({ ...prev, [needId]: { msg: result.message || 'Payout requested!', success: true } }));
      } else {
        setPayoutMessages(prev => ({ ...prev, [needId]: { msg: result.error || 'Failed', success: false } }));
      }
    } catch (err: any) {
      setPayoutMessages(prev => ({ ...prev, [needId]: { msg: err.message || 'Error', success: false } }));
    }
    setPayoutLoadingId(null);
  };

  const handlePostThankYou = () => {
    if (thankYouMsg.trim().length >= 5 && thankYouNeedId) {
      createThankYou(thankYouNeedId, thankYouMsg.trim());
      setShowThankYouModal(false);
      setThankYouMsg('');
      setThankYouNeedId('');
      setActiveTab('updates');
    }
  };


  const tabs: { key: typeof activeTab; label: string; count: number; icon?: string }[] = [
    { key: 'active', label: 'Active', count: activeNeeds.length },
    { key: 'completed', label: 'Completed', count: completedNeeds.length },
    { key: 'updates', label: 'Updates', count: myUpdates.length },
    { key: 'given', label: 'Spotted', count: givenNeeds.length },
    { key: 'receipts', label: 'Receipts', count: 0, icon: 'receipt-long' },
  ];


  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header Actions */}
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => router.replace('/(tabs)')}>

            <MaterialIcons name="home" size={22} color={Colors.textSecondary} />
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity style={styles.iconBtn} onPress={() => setShowShare(true)}>
              <MaterialIcons name="share" size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/settings')}>
              <MaterialIcons name="settings" size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} onPress={() => { setEditing(!editing); if (!editing) { setEditName(currentUser.name); setEditBio(currentUser.bio); setEditCity(currentUser.city); } }}>
              <MaterialIcons name={editing ? 'close' : 'edit'} size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>



        {/* Profile Card */}
        <View style={styles.profileCard}>
          {/* Avatar with change photo button */}
          <TouchableOpacity
            style={styles.avatarContainer}
            onPress={handleChangeAvatar}
            activeOpacity={0.7}
            disabled={avatarUploading}
          >
            <Image source={{ uri: currentUser.avatar }} style={styles.profileAvatar} />
            <View style={[styles.avatarOverlay, avatarUploading && styles.avatarOverlayActive]}>
              {avatarUploading ? (
                <ActivityIndicator size="small" color={Colors.white} />
              ) : (
                <MaterialIcons name="camera-alt" size={18} color={Colors.white} />
              )}
            </View>
            {avatarSuccess && (
              <View style={styles.avatarSuccessBadge}>
                <MaterialIcons name="check-circle" size={24} color={Colors.success} />
              </View>
            )}
          </TouchableOpacity>

          <View style={styles.nameContainer}>
            <Text style={styles.profileName}>{currentUser.name}</Text>
            {currentUser.verified && <MaterialIcons name="verified" size={20} color={Colors.primary} />}
          </View>
          {editing ? (
            <View style={styles.editSection}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: Colors.textLight, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: -4 }}>Display Name</Text>
              <TextInput style={styles.editInput} value={editName} onChangeText={setEditName} placeholder="Your name..." placeholderTextColor={Colors.textLight} maxLength={40} autoFocus />
              <Text style={{ fontSize: 13, fontWeight: '700', color: Colors.textLight, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: -4 }}>Bio</Text>
              <TextInput style={styles.editInput} value={editBio} onChangeText={setEditBio} placeholder="Your bio..." placeholderTextColor={Colors.textLight} multiline maxLength={120} />
              <Text style={{ fontSize: 13, fontWeight: '700', color: Colors.textLight, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: -4 }}>City</Text>
              <TextInput style={styles.editInput} value={editCity} onChangeText={setEditCity} placeholder="Your city..." placeholderTextColor={Colors.textLight} maxLength={40} />
              <TouchableOpacity style={styles.changePhotoBtn} onPress={handleChangeAvatar} disabled={avatarUploading} activeOpacity={0.7}>
                {avatarUploading ? (
                  <ActivityIndicator size="small" color={Colors.primary} />
                ) : (
                  <>
                    <MaterialIcons name="photo-camera" size={18} color={Colors.primary} />
                    <Text style={styles.changePhotoBtnText}>Change Profile Photo</Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={handleSaveProfile}><Text style={styles.saveButtonText}>Save Changes</Text></TouchableOpacity>
            </View>
          ) : (

            <>
              <Text style={styles.profileBio}>{currentUser.bio}</Text>
              <View style={styles.locationRow}><MaterialIcons name="place" size={16} color={Colors.textLight} /><Text style={styles.locationText}>{currentUser.city}</Text></View>
            </>
          )}
          <Text style={styles.joinedText}>Member since {new Date(currentUser.joinedDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</Text>
        </View>

        {/* Pinned Updates Preview (always visible) */}
        {pinnedUpdates.length > 0 && activeTab !== 'updates' && (
          <View style={styles.pinnedSection}>
            <View style={styles.pinnedHeader}>
              <MaterialIcons name="push-pin" size={16} color={Colors.primary} />
              <Text style={styles.pinnedHeaderText}>Pinned Updates</Text>
              <TouchableOpacity onPress={() => setActiveTab('updates')}><Text style={styles.seeAllText}>See all</Text></TouchableOpacity>
            </View>
            {pinnedUpdates.slice(0, 1).map(u => (
              <ThankYouCard key={u.id} update={u} isOwner onTogglePin={togglePinUpdate} onLike={likeUpdate} onViewNeed={(nid) => router.push(`/need/${nid}`)} />
            ))}
          </View>
        )}

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}><MaterialIcons name="trending-up" size={24} color={Colors.primary} /><Text style={styles.statNumber}>${currentUser.totalRaised}</Text><Text style={styles.statLabel}>Raised</Text></View>
          <View style={styles.statCard}><MaterialIcons name="favorite" size={24} color={Colors.secondary} /><Text style={styles.statNumber}>${currentUser.totalGiven}</Text><Text style={styles.statLabel}>Given</Text></View>
          <View style={styles.statCard}><MaterialIcons name="people" size={24} color={Colors.accent} /><Text style={styles.statNumber}>{givenNeeds.length}</Text><Text style={styles.statLabel}>Spotted</Text></View>
        </View>

        {/* Manage Needs Button */}
        {myNeeds.length > 0 && (
          <TouchableOpacity
            style={styles.manageNeedsBtn}
            onPress={() => setShowBulkManager(true)}
            activeOpacity={0.7}
          >
            <MaterialIcons name="dashboard-customize" size={18} color={Colors.primary} />
            <Text style={styles.manageNeedsBtnText}>Manage All Needs</Text>
            <View style={styles.manageNeedsBadge}>
              <Text style={styles.manageNeedsBadgeText}>{myNeeds.length}</Text>
            </View>
            <MaterialIcons name="chevron-right" size={18} color={Colors.textLight} />
          </TouchableOpacity>
        )}

        {/* Tabs */}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll} contentContainerStyle={styles.tabsRow}>
          {tabs.map(tab => (
            <TouchableOpacity key={tab.key} style={[styles.tab, activeTab === tab.key && styles.tabActive]} onPress={() => setActiveTab(tab.key)} activeOpacity={0.7}>
              {tab.icon && <MaterialIcons name={tab.icon as any} size={14} color={activeTab === tab.key ? Colors.white : Colors.textSecondary} />}
              <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>{tab.label}</Text>
              {tab.count > 0 && <View style={[styles.tabBadge, activeTab === tab.key && styles.tabBadgeActive]}><Text style={[styles.tabBadgeText, activeTab === tab.key && styles.tabBadgeTextActive]}>{tab.count}</Text></View>}
            </TouchableOpacity>
          ))}
        </ScrollView>


        {/* Content */}
        <View style={styles.contentArea}>
          {activeTab === 'active' && (
            activeNeeds.length === 0 ? (
              <View style={styles.emptyTab}><MaterialIcons name="add-circle-outline" size={48} color={Colors.borderLight} /><Text style={styles.emptyTabTitle}>No active needs</Text><TouchableOpacity style={styles.createButton} onPress={() => router.push('/(tabs)/create')}><Text style={styles.createButtonText}>Post a Need</Text></TouchableOpacity></View>
            ) : activeNeeds.map(need => <NeedCard key={need.id} need={need} />)
          )}

          {activeTab === 'completed' && (
            completedNeeds.length === 0 ? (
              <View style={styles.emptyTab}><MaterialIcons name="celebration" size={48} color={Colors.borderLight} /><Text style={styles.emptyTabTitle}>No completed needs yet</Text><Text style={styles.emptyTabSubtitle}>When your goals are met, they'll appear here</Text></View>
            ) : completedNeeds.map(need => {
              const isPayoutLoading = payoutLoadingId === need.id;
              const payoutMsg = payoutMessages[need.id];
              const showPayoutBtn = canRequestPayoutForNeed(need);
              const displayStatus = (need.status === 'Collecting' && isExpiredByTime(need)) ? 'Expired' : need.status;
              return (
                <View key={need.id} style={styles.completedCard}>
                  <TouchableOpacity style={styles.completedCardInner} onPress={() => router.push(`/need/${need.id}`)} activeOpacity={0.8}>
                    {need.photo && <Image source={{ uri: need.photo }} style={[styles.completedImage, displayStatus === 'Expired' && { opacity: 0.7 }]} />}
                    <View style={styles.completedContent}>
                      <Text style={styles.completedTitle}>{need.title}</Text>
                      <StatusBadge status={displayStatus} />
                      <Text style={styles.completedAmount}>${need.raisedAmount} raised</Text>
                    </View>
                  </TouchableOpacity>
                  {/* Payout message */}
                  {payoutMsg && (
                    <View style={[styles.completedActions, { paddingBottom: 0 }]}>
                      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: payoutMsg.success ? '#E8F5E8' : '#FFF0F0', padding: 10, borderRadius: 10 }}>
                        <MaterialIcons name={payoutMsg.success ? 'check-circle' : 'error-outline'} size={16} color={payoutMsg.success ? Colors.success : Colors.error} />
                        <Text style={{ flex: 1, fontSize: 12, fontWeight: '600', color: payoutMsg.success ? Colors.success : Colors.error }}>{payoutMsg.msg}</Text>
                      </View>
                    </View>
                  )}
                  <View style={styles.completedActions}>
                    {showPayoutBtn && (
                      <TouchableOpacity
                        style={[styles.payoutButton, isPayoutLoading && { opacity: 0.6 }]}
                        onPress={() => handleRequestPayoutForNeed(need.id)}
                        activeOpacity={0.7}
                        disabled={isPayoutLoading || !!payoutLoadingId}
                      >
                        {isPayoutLoading ? (
                          <ActivityIndicator size="small" color={Colors.white} />
                        ) : (
                          <MaterialIcons name="account-balance-wallet" size={16} color={Colors.white} />
                        )}
                        <Text style={styles.payoutButtonText}>
                          {isPayoutLoading ? 'Processing...' : `Payout $${need.raisedAmount}`}
                        </Text>
                      </TouchableOpacity>
                    )}
                    {need.status === 'Payout Requested' && (
                      <View style={[styles.payoutButton, { backgroundColor: Colors.accentLight, borderWidth: 1, borderColor: Colors.accent }]}>
                        <MaterialIcons name="hourglass-top" size={16} color={Colors.accent} />
                        <Text style={[styles.payoutButtonText, { color: Colors.accent }]}>Processing</Text>
                      </View>
                    )}
                    {need.status === 'Paid' && (
                      <View style={[styles.payoutButton, { backgroundColor: '#E8F5E8', borderWidth: 1, borderColor: Colors.success + '40' }]}>
                        <MaterialIcons name="check-circle" size={16} color={Colors.success} />
                        <Text style={[styles.payoutButtonText, { color: Colors.success }]}>Paid</Text>
                      </View>
                    )}
                    {!myUpdates.some(u => u.needId === need.id) && (need.status === 'Goal Met' || need.status === 'Paid' || need.status === 'Payout Requested') && (
                      <TouchableOpacity style={styles.thankYouButton} onPress={() => { setThankYouNeedId(need.id); setShowThankYouModal(true); }} activeOpacity={0.7}>
                        <MaterialIcons name="auto-awesome" size={16} color={Colors.accent} />
                        <Text style={styles.thankYouButtonText}>Thank You</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })

          )}

          {activeTab === 'updates' && (
            myUpdates.length === 0 ? (
              <View style={styles.emptyTab}>
                <MaterialIcons name="auto-awesome" size={48} color={Colors.borderLight} />
                <Text style={styles.emptyTabTitle}>No thank you updates yet</Text>
                <Text style={styles.emptyTabSubtitle}>Post a thank you after your need is funded to show your gratitude</Text>
              </View>
            ) : myUpdates.map(u => (
              <ThankYouCard key={u.id} update={u} isOwner onTogglePin={togglePinUpdate} onLike={likeUpdate} onViewNeed={(nid) => router.push(`/need/${nid}`)} />
            ))
          )}

          {activeTab === 'given' && (
            givenNeeds.length === 0 ? (
              <View style={styles.emptyTab}><MaterialIcons name="favorite-border" size={48} color={Colors.borderLight} /><Text style={styles.emptyTabTitle}>You haven't spotted anyone yet</Text><TouchableOpacity style={styles.createButton} onPress={() => router.replace('/(tabs)')}><Text style={styles.createButtonText}>Browse Needs</Text></TouchableOpacity></View>

            ) : givenNeeds.map(need => (
              <TouchableOpacity key={need.id} style={styles.givenCard} onPress={() => router.push(`/need/${need.id}`)} activeOpacity={0.8}>
                {need.photo && <Image source={{ uri: need.photo }} style={styles.givenImage} />}
                <View style={styles.givenContent}>
                  <Text style={styles.givenTitle} numberOfLines={1}>{need.title}</Text>
                  <Text style={styles.givenUser}>{need.userName}</Text>
                  <View style={styles.givenProgressRow}>
                    <View style={styles.givenTrack}><View style={[styles.givenFill, { width: `${(need.raisedAmount / need.goalAmount) * 100}%` }]} /></View>
                    <Text style={styles.givenAmount}>${need.raisedAmount}/${need.goalAmount}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))
          )}

          {activeTab === 'receipts' && (
            <ReceiptHistory />
          )}
        </View>





        <TouchableOpacity style={styles.logoutButton} onPress={logout}><MaterialIcons name="logout" size={18} color={Colors.error} /><Text style={styles.logoutText}>Sign Out</Text></TouchableOpacity>
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Thank You Modal */}
      <Modal visible={showThankYouModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Post a Thank You</Text>
              <TouchableOpacity onPress={() => setShowThankYouModal(false)}><MaterialIcons name="close" size={24} color={Colors.textSecondary} /></TouchableOpacity>
            </View>
            <Text style={styles.modalSubtitle}>Share your gratitude with the community. This will be pinned to your profile.</Text>
            <TextInput style={styles.thankYouInput} value={thankYouMsg} onChangeText={setThankYouMsg} placeholder="Thank you so much! Here's how your help made a difference..." placeholderTextColor={Colors.textLight} multiline maxLength={500} textAlignVertical="top" />
            <TouchableOpacity
              style={styles.mediaHint}
              onPress={() => {
                setShowThankYouModal(false);
                setTimeout(() => {
                  setRecordThankYouNeedId(thankYouNeedId);
                  const n = needs.find(x => x.id === thankYouNeedId);
                  setRecordThankYouNeedTitle(n?.title || '');
                  setShowRecordThankYou(true);
                }, 300);
              }}
              activeOpacity={0.7}
            >
              <MaterialIcons name="videocam" size={20} color={Colors.accent} />
              <Text style={[styles.mediaHintText, { color: Colors.accent, fontWeight: '700' }]}>Record a Thank You Video instead</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.postButton, thankYouMsg.trim().length < 5 && styles.postButtonDisabled]} onPress={handlePostThankYou} disabled={thankYouMsg.trim().length < 5}>
              <MaterialIcons name="auto-awesome" size={18} color={Colors.white} />
              <Text style={styles.postButtonText}>Post Thank You</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <ShareSheet
        visible={showShare}
        onClose={() => setShowShare(false)}
        type="profile"
        userId={currentUser.id}
        userName={currentUser.name}
        userAvatar={currentUser.avatar}
        userCity={currentUser.city}
      />

      <RecordThankYouModal
        visible={showRecordThankYou}
        onClose={() => setShowRecordThankYou(false)}
        onSuccess={(video) => {
          createThankYou(recordThankYouNeedId, video.message, video.videoUrl);
          setActiveTab('updates');
        }}
        needId={recordThankYouNeedId}
        needTitle={recordThankYouNeedTitle}
        userId={currentUser.id}
        userName={currentUser.name}
        userAvatar={currentUser.avatar}
      />

      {/* Bulk Need Manager */}
      <BulkNeedManager
        visible={showBulkManager}
        onClose={() => setShowBulkManager(false)}
        needs={myNeeds}
        onDeleteNeed={deleteNeed}
        onEditNeed={(need) => {
          setShowBulkManager(false);
          setTimeout(() => {
            setEditingNeed(need);
            setShowEditModal(true);
          }, 300);
        }}
      />

      {/* Edit Need Modal (from bulk manager) */}
      {editingNeed && (
        <EditNeedModal
          visible={showEditModal}
          onClose={() => { setShowEditModal(false); setEditingNeed(null); }}
          onSave={async (updates) => {
            const ok = await editNeed(editingNeed.id, updates);
            return ok;
          }}
          onDelete={async () => {
            const result = await deleteNeed(editingNeed.id);
            if (result.success) {
              setShowEditModal(false);
              setEditingNeed(null);
            }
            return result;
          }}
          need={editingNeed}
        />
      )}

    </View>

  );
}


const styles = StyleSheet.create({

  container: { flex: 1, backgroundColor: Colors.background },
  headerActions: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, ...(Platform.OS === 'web' ? { paddingTop: 16 } : {}) },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  profileCard: { alignItems: 'center', paddingHorizontal: Spacing.xl, marginBottom: Spacing.lg },
  avatarContainer: {
    position: 'relative',
    marginBottom: Spacing.md,
  },
  profileAvatar: { width: 96, height: 96, borderRadius: 48, borderWidth: 3, borderColor: Colors.primary },
  avatarOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: Colors.background,
    ...Shadow.sm,
  },
  avatarOverlayActive: {
    backgroundColor: Colors.accent,
  },
  avatarSuccessBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: Colors.background,
    borderRadius: 14,
  },
  nameContainer: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginBottom: Spacing.xs },
  profileName: { fontSize: FontSize.xxl, fontWeight: '900', color: Colors.text },
  profileBio: { fontSize: FontSize.md, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: Spacing.sm, paddingHorizontal: Spacing.xl },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: Spacing.sm },
  locationText: { fontSize: FontSize.sm, color: Colors.textLight },
  joinedText: { fontSize: FontSize.xs, color: Colors.textLight },
  editSection: { width: '100%', gap: Spacing.md, marginTop: Spacing.md },
  editInput: { backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.lg, fontSize: FontSize.md, color: Colors.text, borderWidth: 1, borderColor: Colors.border },
  changePhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.primaryLight,
    borderWidth: 1,
    borderColor: Colors.primary + '30',
  },
  changePhotoBtnText: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.primary,
  },
  saveButton: { backgroundColor: Colors.primary, paddingVertical: Spacing.md, borderRadius: BorderRadius.lg, alignItems: 'center' },
  saveButtonText: { fontSize: FontSize.md, fontWeight: '700', color: Colors.white },
  pinnedSection: { marginHorizontal: Spacing.lg, marginBottom: Spacing.lg },
  pinnedHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: Spacing.sm },
  pinnedHeaderText: { flex: 1, fontSize: FontSize.sm, fontWeight: '700', color: Colors.primary },
  seeAllText: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: '600' },
  statsRow: { flexDirection: 'row', paddingHorizontal: Spacing.lg, gap: Spacing.md, marginBottom: Spacing.lg },
  statCard: { flex: 1, backgroundColor: Colors.surface, borderRadius: BorderRadius.xl, padding: Spacing.lg, alignItems: 'center', gap: Spacing.xs, ...Shadow.sm },
  statNumber: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.text },
  statLabel: { fontSize: FontSize.xs, color: Colors.textLight },
  tabsScroll: { marginBottom: Spacing.lg },
  tabsRow: { paddingHorizontal: Spacing.lg, gap: Spacing.sm },
  tab: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs, paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg, borderRadius: BorderRadius.lg, backgroundColor: Colors.surfaceAlt },
  tabActive: { backgroundColor: Colors.primary },
  tabText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textSecondary },
  tabTextActive: { color: Colors.white },
  tabBadge: { backgroundColor: Colors.border, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1 },
  tabBadgeActive: { backgroundColor: 'rgba(255,255,255,0.3)' },
  tabBadgeText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textSecondary },
  tabBadgeTextActive: { color: Colors.white },
  contentArea: { paddingHorizontal: Spacing.lg },
  emptyTab: { alignItems: 'center', paddingVertical: Spacing.huge, gap: Spacing.md },
  emptyTabTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textSecondary },
  emptyTabSubtitle: { fontSize: FontSize.sm, color: Colors.textLight, textAlign: 'center' },
  createButton: { backgroundColor: Colors.primary, paddingHorizontal: Spacing.xxl, paddingVertical: Spacing.md, borderRadius: BorderRadius.full, marginTop: Spacing.sm },
  createButtonText: { fontSize: FontSize.md, fontWeight: '700', color: Colors.white },
  completedCard: { marginBottom: Spacing.md, backgroundColor: Colors.surface, borderRadius: BorderRadius.xl, overflow: 'hidden', ...Shadow.sm },
  completedCardInner: { flexDirection: 'row', padding: Spacing.lg, gap: Spacing.md },
  completedImage: { width: 60, height: 60, borderRadius: BorderRadius.md },
  completedContent: { flex: 1, gap: Spacing.xs },
  completedTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text },
  completedAmount: { fontSize: FontSize.sm, color: Colors.textSecondary },
  completedActions: { flexDirection: 'row', gap: Spacing.sm, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg },
  payoutButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: Colors.secondary, paddingVertical: Spacing.md, borderRadius: BorderRadius.lg },
  payoutButtonText: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.white },
  thankYouButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: Colors.accentLight, paddingVertical: Spacing.md, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: Colors.accent },
  thankYouButtonText: { fontSize: FontSize.sm, fontWeight: '700', color: '#B8941E' },
  givenCard: { flexDirection: 'row', marginBottom: Spacing.md, backgroundColor: Colors.surface, borderRadius: BorderRadius.xl, overflow: 'hidden', ...Shadow.sm },
  givenImage: { width: 80, height: 80 },
  givenContent: { flex: 1, padding: Spacing.md, justifyContent: 'center', gap: 4 },
  givenTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text },
  givenUser: { fontSize: FontSize.xs, color: Colors.textLight },
  givenProgressRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: 4 },
  givenTrack: { flex: 1, height: 6, backgroundColor: Colors.borderLight, borderRadius: 3, overflow: 'hidden' },
  givenFill: { height: '100%' as any, backgroundColor: Colors.primary, borderRadius: 3 },
  givenAmount: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.textSecondary },
  logoutButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingVertical: Spacing.lg, marginHorizontal: Spacing.xl, marginTop: Spacing.xxl, borderRadius: BorderRadius.lg, backgroundColor: Colors.surfaceAlt },
  logoutText: { fontSize: FontSize.md, fontWeight: '600', color: Colors.error },
  loginPrompt: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xxxl, gap: Spacing.md },
  loginTitle: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.text },
  loginSubtitle: { fontSize: FontSize.md, color: Colors.textSecondary, textAlign: 'center' },
  loginButton: { backgroundColor: Colors.primary, paddingHorizontal: Spacing.xxxl, paddingVertical: Spacing.lg, borderRadius: BorderRadius.full, marginTop: Spacing.lg },
  loginButtonText: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.white },
  // Modal styles
  modalOverlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'flex-end' },
  modalContent: { backgroundColor: Colors.surface, borderTopLeftRadius: BorderRadius.xxl, borderTopRightRadius: BorderRadius.xxl, padding: Spacing.xxl, paddingBottom: 40, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  modalTitle: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.text },
  modalSubtitle: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20, marginBottom: Spacing.lg },
  thankYouInput: { backgroundColor: Colors.surfaceAlt, borderRadius: BorderRadius.lg, padding: Spacing.lg, fontSize: FontSize.md, color: Colors.text, minHeight: 120, borderWidth: 1, borderColor: Colors.border },
  charCount: { fontSize: FontSize.xs, color: Colors.textLight, textAlign: 'right', marginTop: 4, marginBottom: Spacing.md },
  mediaHint: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.surfaceAlt, padding: Spacing.md, borderRadius: BorderRadius.md, marginBottom: Spacing.lg },
  mediaHintText: { fontSize: FontSize.sm, color: Colors.textLight },
  postButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: Colors.primary, paddingVertical: Spacing.lg, borderRadius: BorderRadius.lg },
  postButtonDisabled: { opacity: 0.5 },
  postButtonText: { fontSize: FontSize.md, fontWeight: '700', color: Colors.white },
  // Manage Needs Button
  manageNeedsBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginHorizontal: Spacing.lg, marginBottom: Spacing.lg, paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg, backgroundColor: Colors.primaryLight, borderRadius: BorderRadius.xl, borderWidth: 1, borderColor: Colors.primary + '20' },
  manageNeedsBtnText: { flex: 1, fontSize: FontSize.md, fontWeight: '700', color: Colors.primary },
  manageNeedsBadge: { backgroundColor: Colors.primary, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  manageNeedsBadgeText: { fontSize: FontSize.xs, fontWeight: '800', color: Colors.white },
});
