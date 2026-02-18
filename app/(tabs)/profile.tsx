import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, TextInput, Platform, Modal } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, BorderRadius, FontSize, Spacing, Shadow } from '@/app/lib/theme';
import { useApp } from '@/app/lib/store';
import NeedCard from '@/components/NeedCard';
import StatusBadge from '@/components/StatusBadge';
import ThankYouCard from '@/components/ThankYouCard';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { currentUser, needs, thankYouUpdates, isLoggedIn, logout, updateProfile, requestPayout, payoutStatus, createThankYou, togglePinUpdate, likeUpdate } = useApp();
  const [activeTab, setActiveTab] = useState<'active' | 'completed' | 'updates' | 'given'>('active');
  const [editing, setEditing] = useState(false);
  const [editBio, setEditBio] = useState(currentUser.bio);
  const [editCity, setEditCity] = useState(currentUser.city);
  const [showThankYouModal, setShowThankYouModal] = useState(false);
  const [thankYouNeedId, setThankYouNeedId] = useState('');
  const [thankYouMsg, setThankYouMsg] = useState('');

  const topPadding = Platform.OS === 'web' ? 0 : insets.top;

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

  const myNeeds = needs.filter(n => n.userId === currentUser.id || n.userId === 'current');
  const activeNeeds = myNeeds.filter(n => n.status === 'Collecting');
  const completedNeeds = myNeeds.filter(n => n.status !== 'Collecting');
  const givenNeeds = needs.filter(n => n.contributions.some(c => c.userId === currentUser.id || c.userId === 'current'));
  const myUpdates = thankYouUpdates.filter(u => u.userId === currentUser.id || u.userId === 'current');
  const pinnedUpdates = myUpdates.filter(u => u.pinned);

  const handleSaveProfile = () => { updateProfile({ bio: editBio, city: editCity }); setEditing(false); };

  const handlePostThankYou = () => {
    if (thankYouMsg.trim().length >= 5 && thankYouNeedId) {
      createThankYou(thankYouNeedId, thankYouMsg.trim());
      setShowThankYouModal(false);
      setThankYouMsg('');
      setThankYouNeedId('');
      setActiveTab('updates');
    }
  };

  const tabs = [
    { key: 'active' as const, label: 'Active', count: activeNeeds.length },
    { key: 'completed' as const, label: 'Completed', count: completedNeeds.length },
    { key: 'updates' as const, label: 'Updates', count: myUpdates.length },
    { key: 'given' as const, label: 'Spotted', count: givenNeeds.length },
  ];

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header Actions */}
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/settings')}>
            <MaterialIcons name="settings" size={22} color={Colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={() => setEditing(!editing)}>
            <MaterialIcons name={editing ? 'close' : 'edit'} size={22} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Profile Card */}
        <View style={styles.profileCard}>
          <Image source={{ uri: currentUser.avatar }} style={styles.profileAvatar} />
          <View style={styles.nameContainer}>
            <Text style={styles.profileName}>{currentUser.name}</Text>
            {currentUser.verified && <MaterialIcons name="verified" size={20} color={Colors.primary} />}
          </View>
          {editing ? (
            <View style={styles.editSection}>
              <TextInput style={styles.editInput} value={editBio} onChangeText={setEditBio} placeholder="Your bio..." placeholderTextColor={Colors.textLight} multiline maxLength={120} />
              <TextInput style={styles.editInput} value={editCity} onChangeText={setEditCity} placeholder="Your city..." placeholderTextColor={Colors.textLight} maxLength={40} />
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

        {/* Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll} contentContainerStyle={styles.tabsRow}>
          {tabs.map(tab => (
            <TouchableOpacity key={tab.key} style={[styles.tab, activeTab === tab.key && styles.tabActive]} onPress={() => setActiveTab(tab.key)} activeOpacity={0.7}>
              <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>{tab.label}</Text>
              <View style={[styles.tabBadge, activeTab === tab.key && styles.tabBadgeActive]}><Text style={[styles.tabBadgeText, activeTab === tab.key && styles.tabBadgeTextActive]}>{tab.count}</Text></View>
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
            ) : completedNeeds.map(need => (
              <View key={need.id} style={styles.completedCard}>
                <TouchableOpacity style={styles.completedCardInner} onPress={() => router.push(`/need/${need.id}`)} activeOpacity={0.8}>
                  {need.photo && <Image source={{ uri: need.photo }} style={styles.completedImage} />}
                  <View style={styles.completedContent}>
                    <Text style={styles.completedTitle}>{need.title}</Text>
                    <StatusBadge status={need.status} />
                    <Text style={styles.completedAmount}>${need.raisedAmount} raised</Text>
                  </View>
                </TouchableOpacity>
                <View style={styles.completedActions}>
                  {need.status === 'Goal Met' && (
                    <TouchableOpacity style={styles.payoutButton} onPress={() => requestPayout(need.id)} activeOpacity={0.7}>
                      <MaterialIcons name="account-balance-wallet" size={16} color={Colors.white} />
                      <Text style={styles.payoutButtonText}>Request Payout</Text>
                    </TouchableOpacity>
                  )}
                  {!myUpdates.some(u => u.needId === need.id) && (
                    <TouchableOpacity style={styles.thankYouButton} onPress={() => { setThankYouNeedId(need.id); setShowThankYouModal(true); }} activeOpacity={0.7}>
                      <MaterialIcons name="auto-awesome" size={16} color={Colors.accent} />
                      <Text style={styles.thankYouButtonText}>Post Thank You</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))
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
              <View style={styles.emptyTab}><MaterialIcons name="favorite-border" size={48} color={Colors.borderLight} /><Text style={styles.emptyTabTitle}>You haven't spotted anyone yet</Text><TouchableOpacity style={styles.createButton} onPress={() => router.push('/(tabs)')}><Text style={styles.createButtonText}>Browse Needs</Text></TouchableOpacity></View>
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
            <Text style={styles.charCount}>{thankYouMsg.length}/500</Text>
            <View style={styles.mediaHint}>
              <MaterialIcons name="photo-camera" size={20} color={Colors.textLight} />
              <Text style={styles.mediaHintText}>Photo/video uploads coming soon</Text>
            </View>
            <TouchableOpacity style={[styles.postButton, thankYouMsg.trim().length < 5 && styles.postButtonDisabled]} onPress={handlePostThankYou} disabled={thankYouMsg.trim().length < 5}>
              <MaterialIcons name="auto-awesome" size={18} color={Colors.white} />
              <Text style={styles.postButtonText}>Post Thank You</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  headerActions: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, ...(Platform.OS === 'web' ? { paddingTop: 16 } : {}) },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  profileCard: { alignItems: 'center', paddingHorizontal: Spacing.xl, marginBottom: Spacing.lg },
  profileAvatar: { width: 96, height: 96, borderRadius: 48, borderWidth: 3, borderColor: Colors.primary, marginBottom: Spacing.md },
  nameContainer: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginBottom: Spacing.xs },
  profileName: { fontSize: FontSize.xxl, fontWeight: '900', color: Colors.text },
  profileBio: { fontSize: FontSize.md, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: Spacing.sm, paddingHorizontal: Spacing.xl },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: Spacing.sm },
  locationText: { fontSize: FontSize.sm, color: Colors.textLight },
  joinedText: { fontSize: FontSize.xs, color: Colors.textLight },
  editSection: { width: '100%', gap: Spacing.md, marginTop: Spacing.md },
  editInput: { backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.lg, fontSize: FontSize.md, color: Colors.text, borderWidth: 1, borderColor: Colors.border },
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
});

