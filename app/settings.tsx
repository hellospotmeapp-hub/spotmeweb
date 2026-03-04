import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, TextInput, Modal, ActivityIndicator, Platform, Image } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, BorderRadius, FontSize, Spacing, Shadow } from '@/app/lib/theme';
import { FAQ_ITEMS } from '@/app/lib/data';
import { useApp } from '@/app/lib/store';
import { supabase } from '@/app/lib/supabase';
import { pickAndUploadAvatar } from '@/app/lib/imageUpload';


interface SettingRowProps {
  icon: string;
  label: string;
  value?: string;
  onPress?: () => void;
  toggle?: boolean;
  toggleValue?: boolean;
  onToggle?: (val: boolean) => void;
  danger?: boolean;
  badge?: string;
  badgeColor?: string;
}

interface PaymentMethod {
  id: string;
  last4: string;
  brand: string;
  isDefault: boolean;
}

function SettingRow({ icon, label, value, onPress, toggle, toggleValue, onToggle, danger, badge, badgeColor }: SettingRowProps) {
  return (
    <TouchableOpacity style={styles.settingRow} onPress={onPress} activeOpacity={toggle ? 1 : 0.7} disabled={toggle}>
      <View style={[styles.settingIcon, danger && { backgroundColor: Colors.error + '15' }]}>
        <MaterialIcons name={icon as any} size={20} color={danger ? Colors.error : Colors.textSecondary} />
      </View>
      <View style={styles.settingContent}>
        <View style={styles.settingLabelRow}>
          <Text style={[styles.settingLabel, danger && { color: Colors.error }]}>{label}</Text>
          {badge && (
            <View style={[styles.settingBadge, { backgroundColor: (badgeColor || Colors.primary) + '20' }]}>
              <Text style={[styles.settingBadgeText, { color: badgeColor || Colors.primary }]}>{badge}</Text>
            </View>
          )}
        </View>
        {value ? <Text style={styles.settingValue}>{value}</Text> : null}
      </View>
      {toggle ? (
        <Switch value={toggleValue} onValueChange={onToggle} trackColor={{ false: Colors.border, true: Colors.primaryLight }} thumbColor={toggleValue ? Colors.primary : Colors.textLight} />
      ) : (
        <MaterialIcons name="chevron-right" size={22} color={Colors.textLight} />
      )}
    </TouchableOpacity>
  );
}

const CARD_BRANDS = ['Visa', 'Mastercard', 'Amex', 'Discover'];

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const {
    currentUser, isLoggedIn, logout, pushEnabled, subscribeToPush, unsubscribeFromPush,
    payoutStatus, setupPayouts, checkPayoutStatus, completePayoutOnboarding, updateProfile,
  } = useApp();
  const [pushNotifs, setPushNotifs] = useState(pushEnabled);
  const [emailNotifs, setEmailNotifs] = useState(false);
  const [privateProfile, setPrivateProfile] = useState(false);

  const [showFAQ, setShowFAQ] = useState(false);
  const [expandedFAQ, setExpandedFAQ] = useState<number | null>(null);
  const [showPaymentMethods, setShowPaymentMethods] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loadingMethods, setLoadingMethods] = useState(false);
  const [showAddCard, setShowAddCard] = useState(false);
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCVC, setCardCVC] = useState('');
  const [cardBrand, setCardBrand] = useState('Visa');
  const [addingCard, setAddingCard] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  // Payout setup state
  const [showPayoutSetup, setShowPayoutSetup] = useState(false);
  const [payoutLoading, setPayoutLoading] = useState(false);
  const [payoutError, setPayoutError] = useState('');
  const [payoutSummary, setPayoutSummary] = useState<any>(null);
  const [loadingPayoutSummary, setLoadingPayoutSummary] = useState(false);

  // Avatar upload state
  const [avatarUploading, setAvatarUploading] = useState(false);

  const topPadding = Platform.OS === 'web' ? 16 : insets.top;

  const handleChangeAvatar = async () => {
    if (avatarUploading) return;
    setAvatarUploading(true);
    try {
      const result = await pickAndUploadAvatar(currentUser.id);
      if (result.error === 'cancelled') {
        setAvatarUploading(false);
        return;
      }
      if (result.success && result.avatarUrl) {
        updateProfile({ avatar: result.avatarUrl });
      } else if (result.localUri) {
        updateProfile({ avatar: result.localUri });
      }
    } catch (err) {
      console.error('Avatar change error:', err);
    } finally {
      setAvatarUploading(false);
    }
  };


  // Check for setup_payout param (returning from onboarding)
  useEffect(() => {
    if (Platform.OS === 'web') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('setup_payout') === 'true') {
        // User is returning from onboarding - complete it
        completePayoutOnboarding();
        // Clean URL
        window.history.replaceState({}, '', '/settings');
      }
    }
  }, []);

  const fetchPaymentMethods = async () => {
    setLoadingMethods(true);
    try {
      const { data } = await supabase.functions.invoke('process-contribution', { body: { action: 'list_payment_methods', userId: currentUser.id } });
      if (data?.success) setPaymentMethods(data.paymentMethods || []);
    } catch (e) {}
    setLoadingMethods(false);
  };

  const handleAddCard = async () => {
    if (cardNumber.length < 4) return;
    setAddingCard(true);
    try {
      const last4 = cardNumber.replace(/\s/g, '').slice(-4);
      const { data } = await supabase.functions.invoke('process-contribution', { body: { action: 'add_payment_method', userId: currentUser.id, cardLast4: last4, cardBrand } });
      if (data?.success) { setPaymentMethods(prev => [...prev, data.paymentMethod]); setShowAddCard(false); setCardNumber(''); setCardExpiry(''); setCardCVC(''); }
    } catch (e) {}
    setAddingCard(false);
  };

  const handleRemoveCard = async (methodId: string) => {
    setRemovingId(methodId);
    try {
      const { data } = await supabase.functions.invoke('process-contribution', { body: { action: 'remove_payment_method', userId: currentUser.id, paymentMethodId: methodId } });
      if (data?.success) setPaymentMethods(prev => prev.filter(m => m.id !== methodId));
    } catch (e) {}
    setRemovingId(null);
  };

  const formatCardNumber = (text: string) => {
    const cleaned = text.replace(/\D/g, '').substring(0, 16);
    const groups = cleaned.match(/.{1,4}/g);
    return groups ? groups.join(' ') : cleaned;
  };

  const formatExpiry = (text: string) => {
    const cleaned = text.replace(/\D/g, '').substring(0, 4);
    if (cleaned.length > 2) return cleaned.substring(0, 2) + '/' + cleaned.substring(2);
    return cleaned;
  };

  useEffect(() => { if (showPaymentMethods) fetchPaymentMethods(); }, [showPaymentMethods]);

  // Fetch payout summary when opening payout modal
  const fetchPayoutSummary = async () => {
    setLoadingPayoutSummary(true);
    try {
      const { data } = await supabase.functions.invoke('stripe-connect', {
        body: { action: 'get_payout_summary', userId: currentUser.id },
      });
      if (data?.success) {
        setPayoutSummary(data.summary);
      }
    } catch {}
    setLoadingPayoutSummary(false);
  };

  const handleSetupPayouts = async () => {
    setPayoutLoading(true);
    setPayoutError('');
    try {
      const result = await setupPayouts();
      if (result.success) {
        if (result.onboardingUrl) {
          // Redirect to onboarding
          if (Platform.OS === 'web') {
            window.location.href = result.onboardingUrl;
          }
        } else {
          // Already onboarded
          await checkPayoutStatus();
          setPayoutError('');
        }
      } else {
        setPayoutError(result.error || 'Setup failed');
      }
    } catch (err: any) {
      setPayoutError(err.message || 'Setup failed');
    }
    setPayoutLoading(false);
  };

  useEffect(() => {
    if (showPayoutSetup) fetchPayoutSummary();
  }, [showPayoutSetup]);

  const payoutsEnabled = payoutStatus?.payoutsEnabled || false;
  const hasPayoutAccount = payoutStatus?.hasAccount || false;

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="close" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.section}>
          {/* Change Profile Photo Row */}
          <TouchableOpacity style={styles.settingRow} onPress={handleChangeAvatar} activeOpacity={0.7} disabled={avatarUploading}>
            <View style={styles.avatarThumbContainer}>
              {currentUser.avatar ? (
                <Image source={{ uri: currentUser.avatar }} style={styles.avatarThumb} />
              ) : (
                <View style={[styles.avatarThumb, { backgroundColor: Colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }]}>
                  <MaterialIcons name="person" size={18} color={Colors.textLight} />
                </View>
              )}
              <View style={styles.avatarThumbBadge}>
                <MaterialIcons name="camera-alt" size={10} color={Colors.white} />
              </View>
            </View>
            <View style={styles.settingContent}>
              <Text style={styles.settingLabel}>Change Profile Photo</Text>
              <Text style={styles.settingValue}>
                {avatarUploading ? 'Uploading...' : 'Tap to select a new photo'}
              </Text>
            </View>
            {avatarUploading ? (
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : (
              <MaterialIcons name="chevron-right" size={22} color={Colors.textLight} />
            )}
          </TouchableOpacity>
          <SettingRow icon="person" label="Edit Profile" onPress={() => router.push('/(tabs)/profile')} />
          <SettingRow icon="credit-card" label="Payment Methods" value={paymentMethods.length > 0 ? `${paymentMethods.length} card(s)` : 'Add a card'} onPress={() => setShowPaymentMethods(true)} />
          <SettingRow
            icon="account-balance-wallet"
            label="Payout Settings"
            value={payoutsEnabled ? 'Stripe Connect active' : 'Set up to receive funds'}
            badge={payoutsEnabled ? 'Active' : 'Set Up'}
            badgeColor={payoutsEnabled ? Colors.success : Colors.accent}
            onPress={() => setShowPayoutSetup(true)}
          />
        </View>


        {/* Stripe Connect Info Banner */}
        <View style={styles.connectInfoBanner}>
          <View style={styles.connectInfoIcon}>
            <MaterialIcons name="swap-horiz" size={24} color={Colors.secondary} />
          </View>
          <View style={styles.connectInfoContent}>
            <Text style={styles.connectInfoTitle}>Stripe Connect</Text>
            <Text style={styles.connectInfoText}>
              When you set up payouts, contributions go directly to your bank account. SpotMe takes no platform fee — 100% goes to you. Tips from contributors support SpotMe.
            </Text>

          </View>
        </View>

        <Text style={styles.sectionTitle}>Notifications</Text>
        <View style={styles.section}>
          <SettingRow
            icon="notifications"
            label="Push Notifications"
            toggle
            toggleValue={pushNotifs}
            onToggle={async (val) => {
              setPushNotifs(val);
              if (val) {
                const success = await subscribeToPush();
                if (!success) setPushNotifs(false);
              } else {
                await unsubscribeFromPush();
              }
            }}
          />
          <SettingRow icon="email" label="Email Notifications" toggle toggleValue={emailNotifs} onToggle={setEmailNotifs} />
        </View>

        <Text style={styles.sectionTitle}>Privacy & Safety</Text>
        <View style={styles.section}>
          <SettingRow icon="lock" label="Private Profile" toggle toggleValue={privateProfile} onToggle={setPrivateProfile} />
          <SettingRow icon="block" label="Blocked Users" value="0 blocked" onPress={() => {}} />
          <SettingRow icon="gavel" label="Community Guidelines" onPress={() => router.push('/guidelines')} />
          <SettingRow icon="flag" label="Report a Problem" onPress={() => {}} />
        </View>

        <Text style={styles.sectionTitle}>Help Center</Text>
        <View style={styles.section}>
          <TouchableOpacity style={styles.settingRow} onPress={() => setShowFAQ(!showFAQ)} activeOpacity={0.7}>
            <View style={styles.settingIcon}><MaterialIcons name="help" size={20} color={Colors.textSecondary} /></View>
            <View style={styles.settingContent}><Text style={styles.settingLabel}>FAQs</Text></View>
            <MaterialIcons name={showFAQ ? 'expand-less' : 'expand-more'} size={22} color={Colors.textLight} />
          </TouchableOpacity>
          {showFAQ && (
            <View style={styles.faqSection}>
              {FAQ_ITEMS.map((item, index) => (
                <TouchableOpacity key={index} style={styles.faqItem} onPress={() => setExpandedFAQ(expandedFAQ === index ? null : index)} activeOpacity={0.7}>
                  <View style={styles.faqHeader}>
                    <Text style={styles.faqQuestion}>{item.q}</Text>
                    <MaterialIcons name={expandedFAQ === index ? 'remove' : 'add'} size={20} color={Colors.primary} />
                  </View>
                  {expandedFAQ === index && <Text style={styles.faqAnswer}>{item.a}</Text>}
                </TouchableOpacity>
              ))}
            </View>
          )}
          <SettingRow icon="chat" label="Contact Support" value="hellospotme.app@gmail.com" onPress={() => {
            if (Platform.OS === 'web') {
              window.open('mailto:hellospotme.app@gmail.com?subject=SpotMe Support Request', '_blank');
            }
          }} />
          <SettingRow icon="info" label="About SpotMe" value="v1.1.0" onPress={() => router.push('/about')} />
          <SettingRow icon="description" label="Terms of Service" onPress={() => router.push('/terms')} />
          <SettingRow icon="admin-panel-settings" label="Admin Dashboard" value="Manage app" onPress={() => router.push('/admin')} />
        </View>

        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.section}>
        <SettingRow icon="logout" label="Sign Out" danger onPress={async () => { await logout(); if (Platform.OS === 'web') { try { window.location.href = '/'; } catch {} } else { router.replace('/(tabs)'); } }} />

          <SettingRow icon="delete-forever" label="Delete Account" danger onPress={() => {}} />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerLogo}>SpotMe</Text>
          <Text style={styles.footerTagline}>No tragedy. Just life.</Text>
          <Text style={styles.footerVersion}>Version 1.1.0 · Stripe Connect</Text>
          <View style={styles.footerLinks}>
            <TouchableOpacity onPress={() => router.push('/terms')}><Text style={styles.footerLink}>Terms of Service</Text></TouchableOpacity>
            <Text style={styles.footerDot}>·</Text>
            <TouchableOpacity><Text style={styles.footerLink}>Privacy Policy</Text></TouchableOpacity>
            <Text style={styles.footerDot}>·</Text>
            <TouchableOpacity onPress={() => router.push('/guidelines')}><Text style={styles.footerLink}>Guidelines</Text></TouchableOpacity>
          </View>
          <Text style={styles.footerCopyright}>© 2026 SpotMe. All rights reserved.</Text>
        </View>

      </ScrollView>

      {/* Payment Methods Modal */}
      <Modal visible={showPaymentMethods} animationType="slide" transparent={Platform.OS === 'web'} onRequestClose={() => setShowPaymentMethods(false)}>
        <View style={[styles.modalContainer, { paddingTop: topPadding + 10 }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowPaymentMethods(false)}>
              <MaterialIcons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Payment Methods</Text>
            <View style={{ width: 24 }} />
          </View>
          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            <View style={styles.secureNotice}>
              <MaterialIcons name="lock" size={18} color={Colors.secondary} />
              <Text style={styles.secureNoticeText}>Your payment information is encrypted and secure.</Text>
            </View>
            {loadingMethods ? (
              <View style={styles.loadingContainer}><ActivityIndicator size="large" color={Colors.primary} /></View>
            ) : paymentMethods.length === 0 ? (
              <View style={styles.emptyMethods}>
                <MaterialIcons name="credit-card" size={56} color={Colors.borderLight} />
                <Text style={styles.emptyMethodsTitle}>No payment methods</Text>
                <Text style={styles.emptyMethodsSubtitle}>Add a card to start spotting people in need.</Text>
              </View>
            ) : (
              paymentMethods.map(method => (
                <View key={method.id} style={styles.cardRow}>
                  <View style={styles.cardIconBg}><MaterialIcons name="credit-card" size={24} color={Colors.primary} /></View>
                  <View style={styles.cardInfo}>
                    <Text style={styles.cardBrand}>{method.brand}</Text>
                    <Text style={styles.cardLast4}>**** **** **** {method.last4}</Text>
                    {method.isDefault && <View style={styles.defaultBadge}><Text style={styles.defaultBadgeText}>Default</Text></View>}
                  </View>
                  <TouchableOpacity style={styles.removeCardBtn} onPress={() => handleRemoveCard(method.id)} disabled={removingId === method.id}>
                    {removingId === method.id ? <ActivityIndicator size="small" color={Colors.error} /> : <MaterialIcons name="delete-outline" size={22} color={Colors.error} />}
                  </TouchableOpacity>
                </View>
              ))
            )}
            {!showAddCard ? (
              <TouchableOpacity style={styles.addCardBtn} onPress={() => setShowAddCard(true)} activeOpacity={0.8}>
                <MaterialIcons name="add-circle" size={22} color={Colors.white} />
                <Text style={styles.addCardBtnText}>Add Payment Method</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.addCardForm}>
                <Text style={styles.addCardTitle}>Add a Card</Text>
                <Text style={styles.fieldLabel}>Card Type</Text>
                <View style={styles.brandRow}>
                  {CARD_BRANDS.map(brand => (
                    <TouchableOpacity key={brand} style={[styles.brandChip, cardBrand === brand && styles.brandChipActive]} onPress={() => setCardBrand(brand)}>
                      <Text style={[styles.brandChipText, cardBrand === brand && styles.brandChipTextActive]}>{brand}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={styles.fieldLabel}>Card Number</Text>
                <TextInput style={styles.cardInput} value={cardNumber} onChangeText={(t) => setCardNumber(formatCardNumber(t))} placeholder="1234 5678 9012 3456" placeholderTextColor={Colors.textLight} keyboardType="numeric" maxLength={19} />
                <View style={styles.cardInputRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>Expiry</Text>
                    <TextInput style={styles.cardInput} value={cardExpiry} onChangeText={(t) => setCardExpiry(formatExpiry(t))} placeholder="MM/YY" placeholderTextColor={Colors.textLight} keyboardType="numeric" maxLength={5} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>CVC</Text>
                    <TextInput style={styles.cardInput} value={cardCVC} onChangeText={setCardCVC} placeholder="123" placeholderTextColor={Colors.textLight} keyboardType="numeric" maxLength={4} secureTextEntry />
                  </View>
                </View>
                <View style={styles.addCardActions}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => { setShowAddCard(false); setCardNumber(''); setCardExpiry(''); setCardCVC(''); }}>
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.saveCardBtn, (cardNumber.length < 15 || addingCard) && { opacity: 0.5 }]} onPress={handleAddCard} disabled={cardNumber.length < 15 || addingCard}>
                    {addingCard ? <ActivityIndicator size="small" color={Colors.white} /> : <Text style={styles.saveCardBtnText}>Save Card</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            )}
            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </Modal>

      {/* Payout Setup Modal */}
      <Modal visible={showPayoutSetup} animationType="slide" transparent={Platform.OS === 'web'} onRequestClose={() => setShowPayoutSetup(false)}>
        <View style={[styles.modalContainer, { paddingTop: topPadding + 10 }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowPayoutSetup(false)}>
              <MaterialIcons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Payout Settings</Text>
            <View style={{ width: 24 }} />
          </View>
          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            {/* Status Banner */}
            {payoutsEnabled ? (
              <View style={styles.payoutStatusActive}>
                <View style={styles.payoutStatusIcon}>
                  <MaterialIcons name="check-circle" size={32} color={Colors.success} />
                </View>
                <Text style={styles.payoutStatusTitle}>Payouts Active</Text>
                <Text style={styles.payoutStatusText}>
                  Your Stripe Connect account is set up. 100% of contributions to your needs are sent directly to you — no platform fees.
                </Text>
              </View>
            ) : (
              <View style={styles.payoutStatusInactive}>
                <View style={styles.payoutStatusIcon}>
                  <MaterialIcons name="account-balance-wallet" size={32} color={Colors.accent} />
                </View>
                <Text style={styles.payoutStatusTitle}>Set Up Direct Payouts</Text>
                <Text style={styles.payoutStatusText}>
                  Connect your bank account via Stripe to receive 100% of contributions directly. No platform fees — SpotMe is supported by optional tips.
                </Text>
              </View>
            )}

            {/* How It Works */}
            <View style={styles.howItWorks}>
              <Text style={styles.howItWorksTitle}>How Stripe Connect Works</Text>
              <View style={styles.stepRow}>
                <View style={[styles.stepNumber, { backgroundColor: Colors.primaryLight }]}>
                  <Text style={[styles.stepNumberText, { color: Colors.primary }]}>1</Text>
                </View>
                <View style={styles.stepContent}>
                  <Text style={styles.stepTitle}>Contributor pays</Text>
                  <Text style={styles.stepDesc}>Someone spots your need via Stripe's secure checkout</Text>
                </View>
              </View>
              <View style={styles.stepConnector} />
              <View style={styles.stepRow}>
                <View style={[styles.stepNumber, { backgroundColor: Colors.secondaryLight }]}>
                  <Text style={[styles.stepNumberText, { color: Colors.secondaryDark }]}>2</Text>
                </View>
                <View style={styles.stepContent}>
                  <Text style={styles.stepTitle}>Stripe routes the payment</Text>
                  <Text style={styles.stepDesc}>100% of the donation goes to you. Optional tips support SpotMe separately.</Text>
                </View>
              </View>
              <View style={styles.stepConnector} />
              <View style={styles.stepRow}>
                <View style={[styles.stepNumber, { backgroundColor: Colors.accentLight }]}>
                  <Text style={[styles.stepNumberText, { color: '#8B7000' }]}>3</Text>
                </View>
                <View style={styles.stepContent}>
                  <Text style={styles.stepTitle}>You receive funds</Text>
                  <Text style={styles.stepDesc}>Money arrives in your bank account within 2-3 business days</Text>
                </View>
              </View>
            </View>

            {/* Fee Example */}
            <View style={styles.feeExample}>
              <Text style={styles.feeExampleTitle}>Example: $20 Contribution</Text>
              <View style={styles.feeExampleRow}>
                <Text style={styles.feeExampleLabel}>Contributor pays</Text>
                <Text style={styles.feeExampleValue}>$20.00</Text>
              </View>
              <View style={styles.feeExampleRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <MaterialIcons name="arrow-forward" size={14} color={Colors.success} />
                  <Text style={[styles.feeExampleLabel, { color: Colors.success, fontWeight: '700' }]}>You receive</Text>
                </View>
                <Text style={[styles.feeExampleValue, { color: Colors.success, fontWeight: '800' }]}>$20.00</Text>
              </View>
              <View style={styles.feeExampleRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <MaterialIcons name="info-outline" size={14} color={Colors.textLight} />
                  <Text style={styles.feeExampleLabel}>Platform fee</Text>
                </View>
                <Text style={[styles.feeExampleValue, { color: Colors.success }]}>$0.00</Text>
              </View>
              <View style={[styles.feeExampleRow, { marginTop: 4 }]}>
                <Text style={[styles.feeExampleLabel, { fontStyle: 'italic' }]}>Stripe processing (2.9% + $0.30)</Text>
                <Text style={[styles.feeExampleValue, { color: Colors.textLight }]}>$0.88</Text>
              </View>
            </View>



            {/* Payout Summary */}
            {loadingPayoutSummary ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.primary} />
              </View>
            ) : payoutSummary ? (
              <View style={styles.payoutSummaryCard}>
                <Text style={styles.payoutSummaryTitle}>Your Payout Summary</Text>
                <View style={styles.payoutSummaryGrid}>
                  <View style={styles.payoutSummaryStat}>
                    <Text style={styles.payoutSummaryNumber}>${payoutSummary.totalRaised.toFixed(2)}</Text>
                    <Text style={styles.payoutSummaryLabel}>Total Raised</Text>
                  </View>
                  <View style={styles.payoutSummaryStat}>
                    <Text style={styles.payoutSummaryNumber}>${payoutSummary.pendingPayout.toFixed(2)}</Text>
                    <Text style={styles.payoutSummaryLabel}>Pending</Text>
                  </View>
                  <View style={styles.payoutSummaryStat}>
                    <Text style={styles.payoutSummaryNumber}>${payoutSummary.paidOut.toFixed(2)}</Text>
                    <Text style={styles.payoutSummaryLabel}>Paid Out</Text>
                  </View>
                  {payoutSummary.directPaymentsCount > 0 && (
                    <View style={styles.payoutSummaryStat}>
                      <Text style={[styles.payoutSummaryNumber, { color: Colors.success }]}>${payoutSummary.directPaymentsReceived.toFixed(2)}</Text>
                      <Text style={styles.payoutSummaryLabel}>Direct Deposits</Text>
                    </View>
                  )}
                </View>
              </View>
            ) : null}

            {/* Error */}
            {payoutError ? (
              <View style={styles.payoutErrorBanner}>
                <MaterialIcons name="error-outline" size={18} color={Colors.error} />
                <Text style={styles.payoutErrorText}>{payoutError}</Text>
              </View>
            ) : null}

            {/* Setup / Manage Button */}
            {!payoutsEnabled ? (
              <TouchableOpacity
                style={[styles.setupPayoutBtn, payoutLoading && { opacity: 0.6 }]}
                onPress={handleSetupPayouts}
                activeOpacity={0.8}
                disabled={payoutLoading}
              >
                {payoutLoading ? (
                  <ActivityIndicator size="small" color={Colors.white} />
                ) : (
                  <MaterialIcons name="account-balance" size={20} color={Colors.white} />
                )}
                <Text style={styles.setupPayoutBtnText}>
                  {payoutLoading ? 'Setting up...' : 'Set Up Stripe Connect Payouts'}
                </Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.payoutActiveActions}>
                <View style={styles.payoutActiveBadge}>
                  <MaterialIcons name="check-circle" size={18} color={Colors.success} />
                  <Text style={styles.payoutActiveBadgeText}>Stripe Connect is active</Text>
                </View>
                <TouchableOpacity style={styles.managePayoutBtn} onPress={() => checkPayoutStatus()} activeOpacity={0.7}>
                  <MaterialIcons name="refresh" size={18} color={Colors.primary} />
                  <Text style={styles.managePayoutBtnText}>Refresh Status</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Security Note */}
            <View style={styles.payoutSecurityNote}>
              <MaterialIcons name="verified-user" size={16} color={Colors.textLight} />
              <Text style={styles.payoutSecurityText}>
                Stripe Connect is PCI-DSS Level 1 certified. Your banking information is never stored on SpotMe's servers. All transfers are handled securely by Stripe.
              </Text>
            </View>

            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.text },
  sectionTitle: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textLight, textTransform: 'uppercase', letterSpacing: 0.5, paddingHorizontal: Spacing.xl, marginTop: Spacing.xxl, marginBottom: Spacing.sm },
  section: { backgroundColor: Colors.surface, marginHorizontal: Spacing.lg, borderRadius: BorderRadius.xl, overflow: 'hidden', ...Shadow.sm },
  settingRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.lg, gap: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  settingIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  settingContent: { flex: 1 },
  settingLabelRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  settingLabel: { fontSize: FontSize.md, fontWeight: '600', color: Colors.text },
  settingValue: { fontSize: FontSize.xs, color: Colors.textLight, marginTop: 1 },
  settingBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.full },
  settingBadgeText: { fontSize: FontSize.xs, fontWeight: '700' },
  connectInfoBanner: {
    flexDirection: 'row', marginHorizontal: Spacing.lg, marginTop: Spacing.lg,
    backgroundColor: Colors.secondaryLight, borderRadius: BorderRadius.xl, padding: Spacing.lg, gap: Spacing.md,
  },
  connectInfoIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  connectInfoContent: { flex: 1 },
  connectInfoTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.secondaryDark, marginBottom: 4 },
  connectInfoText: { fontSize: FontSize.sm, color: Colors.secondaryDark, lineHeight: 18 },
  faqSection: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md },
  faqItem: { paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  faqHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.md },
  faqQuestion: { flex: 1, fontSize: FontSize.md, fontWeight: '600', color: Colors.text },
  faqAnswer: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20, marginTop: Spacing.sm },
  footer: { alignItems: 'center', paddingVertical: Spacing.huge, gap: Spacing.xs },
  footerLogo: { fontSize: FontSize.xl, fontWeight: '900', color: Colors.primary },
  footerTagline: { fontSize: FontSize.sm, color: Colors.textLight, fontStyle: 'italic' },
  footerVersion: { fontSize: FontSize.xs, color: Colors.textLight, marginTop: Spacing.sm },
  footerLinks: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.md },
  footerLink: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: '600' },
  footerDot: { color: Colors.textLight },
  footerCopyright: { fontSize: FontSize.xs, color: Colors.textLight, marginTop: Spacing.sm },
  modalContainer: { flex: 1, backgroundColor: Colors.background },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  modalTitle: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.text },
  modalContent: { flex: 1, paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg },
  secureNotice: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.secondaryLight, padding: Spacing.md, borderRadius: BorderRadius.lg, marginBottom: Spacing.xl },
  secureNoticeText: { flex: 1, fontSize: FontSize.sm, color: Colors.secondaryDark, fontWeight: '600' },
  loadingContainer: { paddingVertical: Spacing.huge, alignItems: 'center' },
  emptyMethods: { alignItems: 'center', paddingVertical: Spacing.huge, gap: Spacing.md },
  emptyMethodsTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textSecondary },
  emptyMethodsSubtitle: { fontSize: FontSize.sm, color: Colors.textLight, textAlign: 'center' },
  cardRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, padding: Spacing.lg, borderRadius: BorderRadius.xl, marginBottom: Spacing.md, gap: Spacing.md, ...Shadow.sm },
  cardIconBg: { width: 48, height: 48, borderRadius: 12, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  cardInfo: { flex: 1, gap: 2 },
  cardBrand: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text },
  cardLast4: { fontSize: FontSize.sm, color: Colors.textSecondary },
  defaultBadge: { backgroundColor: Colors.secondaryLight, paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.full, alignSelf: 'flex-start', marginTop: 4 },
  defaultBadgeText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.secondaryDark },
  removeCardBtn: { padding: Spacing.sm },
  addCardBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: Colors.primary, paddingVertical: Spacing.lg, borderRadius: BorderRadius.xl, marginTop: Spacing.md, ...Shadow.md },
  addCardBtnText: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.white },
  addCardForm: { backgroundColor: Colors.surface, borderRadius: BorderRadius.xl, padding: Spacing.xl, marginTop: Spacing.md, gap: Spacing.md, ...Shadow.sm },
  addCardTitle: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.text, marginBottom: Spacing.sm },
  fieldLabel: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  brandRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm, flexWrap: 'wrap' },
  brandChip: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.full, backgroundColor: Colors.surfaceAlt, borderWidth: 2, borderColor: 'transparent' },
  brandChipActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  brandChipText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textSecondary },
  brandChipTextActive: { color: Colors.primary },
  cardInput: { backgroundColor: Colors.surfaceAlt, borderRadius: BorderRadius.lg, padding: Spacing.lg, fontSize: FontSize.md, color: Colors.text, borderWidth: 1, borderColor: Colors.border },
  cardInputRow: { flexDirection: 'row', gap: Spacing.md },
  addCardActions: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.sm },
  cancelBtn: { flex: 1, paddingVertical: Spacing.lg, borderRadius: BorderRadius.xl, backgroundColor: Colors.surfaceAlt, alignItems: 'center' },
  cancelBtnText: { fontSize: FontSize.md, fontWeight: '600', color: Colors.textSecondary },
  saveCardBtn: { flex: 1, paddingVertical: Spacing.lg, borderRadius: BorderRadius.xl, backgroundColor: Colors.primary, alignItems: 'center', ...Shadow.md },
  saveCardBtnText: { fontSize: FontSize.md, fontWeight: '700', color: Colors.white },
  // Payout Setup Styles
  payoutStatusActive: { alignItems: 'center', backgroundColor: Colors.secondaryLight, borderRadius: BorderRadius.xl, padding: Spacing.xxl, marginBottom: Spacing.xl, gap: Spacing.sm },
  payoutStatusInactive: { alignItems: 'center', backgroundColor: Colors.accentLight, borderRadius: BorderRadius.xl, padding: Spacing.xxl, marginBottom: Spacing.xl, gap: Spacing.sm },
  payoutStatusIcon: { marginBottom: Spacing.sm },
  payoutStatusTitle: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.text },
  payoutStatusText: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  howItWorks: { backgroundColor: Colors.surface, borderRadius: BorderRadius.xl, padding: Spacing.xl, marginBottom: Spacing.xl, ...Shadow.sm },
  howItWorksTitle: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.text, marginBottom: Spacing.lg },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  stepNumber: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  stepNumberText: { fontSize: FontSize.md, fontWeight: '800' },
  stepContent: { flex: 1 },
  stepTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text, marginBottom: 2 },
  stepDesc: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 18 },
  stepConnector: { width: 2, height: 16, backgroundColor: Colors.borderLight, marginLeft: 15, marginVertical: 4 },
  feeExample: { backgroundColor: Colors.surfaceAlt, borderRadius: BorderRadius.xl, padding: Spacing.xl, marginBottom: Spacing.xl, gap: Spacing.sm },
  feeExampleTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text, marginBottom: Spacing.sm },
  feeExampleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 2 },
  feeExampleLabel: { fontSize: FontSize.sm, color: Colors.textLight },
  feeExampleValue: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.text },
  payoutSummaryCard: { backgroundColor: Colors.surface, borderRadius: BorderRadius.xl, padding: Spacing.xl, marginBottom: Spacing.xl, ...Shadow.sm },
  payoutSummaryTitle: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.text, marginBottom: Spacing.lg },
  payoutSummaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  payoutSummaryStat: { flex: 1, minWidth: 100, backgroundColor: Colors.surfaceAlt, borderRadius: BorderRadius.lg, padding: Spacing.lg, alignItems: 'center', gap: 4 },
  payoutSummaryNumber: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.text },
  payoutSummaryLabel: { fontSize: FontSize.xs, color: Colors.textLight },
  payoutErrorBanner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: '#FFF0F0', padding: Spacing.md, borderRadius: BorderRadius.lg, marginBottom: Spacing.lg },
  payoutErrorText: { flex: 1, fontSize: FontSize.sm, color: Colors.error, fontWeight: '600' },
  setupPayoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: Colors.primary, paddingVertical: Spacing.lg + 2, borderRadius: BorderRadius.xl, marginBottom: Spacing.lg, ...Shadow.md },
  setupPayoutBtnText: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.white },
  payoutActiveActions: { gap: Spacing.md, marginBottom: Spacing.lg },
  payoutActiveBadge: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: Colors.secondaryLight, paddingVertical: Spacing.lg, borderRadius: BorderRadius.xl },
  payoutActiveBadgeText: { fontSize: FontSize.md, fontWeight: '700', color: Colors.secondaryDark },
  managePayoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: Colors.surfaceAlt, paddingVertical: Spacing.md, borderRadius: BorderRadius.lg },
  managePayoutBtnText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.primary },
  payoutSecurityNote: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, paddingVertical: Spacing.md },
  payoutSecurityText: { flex: 1, fontSize: FontSize.xs, color: Colors.textLight, lineHeight: 16 },
  // Avatar thumbnail styles
  avatarThumbContainer: {
    position: 'relative',
    width: 40,
    height: 40,
  },
  avatarThumb: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  avatarThumbBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.surface,
  },
});
