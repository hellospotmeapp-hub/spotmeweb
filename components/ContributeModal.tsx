import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView, Linking } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, BorderRadius, FontSize, Spacing, Shadow } from '@/app/lib/theme';
import { useApp } from '@/app/lib/store';
import { supabase } from '@/app/lib/supabase';
import { checkStripeSetup, type StripeSetupStatus } from '@/app/lib/stripeSetup';

interface ContributeModalProps {
  visible: boolean;
  onClose: () => void;
  onContribute: (amount: number, note?: string) => void;
  needTitle: string;
  needId: string;
  remaining: number;
  contributorName?: string;
}

const PRESET_AMOUNTS = [1, 5, 10, 25, 50];

// Smart tip suggestions based on donation amount
function getSmartTipSuggestions(donationAmount: number): { presets: number[]; defaultTip: number; message: string; highlight: number } {
  if (donationAmount <= 0) {
    return { presets: [0, 1, 2, 5], defaultTip: 1, message: 'An optional tip helps keep SpotMe free for everyone', highlight: 1 };
  }
  if (donationAmount <= 3) {
    return {
      presets: [0, 0.50, 1, 2],
      defaultTip: 0.50,
      message: 'Even $0.50 helps us keep SpotMe running',
      highlight: 0.50,
    };
  }
  if (donationAmount <= 10) {
    return {
      presets: [0, 1, 2, 3],
      defaultTip: 1,
      message: '$1 keeps SpotMe free for everyone',
      highlight: 1,
    };
  }
  if (donationAmount <= 25) {
    return {
      presets: [0, 1, 2, 5],
      defaultTip: 2,
      message: 'A $2 tip supports the platform that connects givers',
      highlight: 2,
    };
  }
  if (donationAmount <= 50) {
    return {
      presets: [0, 2, 3, 5],
      defaultTip: 2,
      message: 'Your generosity is amazing! A small tip keeps us going',
      highlight: 2,
    };
  }
  // $50+
  return {
    presets: [0, 2, 5, 10],
    defaultTip: 5,
    message: 'You\'re incredible! A $5 tip helps us reach more people',
    highlight: 5,
  };
}


export default function ContributeModal({ visible, onClose, onContribute, needTitle, needId, remaining, contributorName }: ContributeModalProps) {
  const { contributeWithPayment, isLoggedIn } = useApp();
  const [selectedAmount, setSelectedAmount] = useState<number | null>(5);
  const [customAmount, setCustomAmount] = useState('');
  const [note, setNote] = useState('');
  const [isCustom, setIsCustom] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successAmount, setSuccessAmount] = useState(0);
  const [successTip, setSuccessTip] = useState(0);
  const [paymentMode, setPaymentMode] = useState<'stripe' | 'stripe_connect' | 'direct' | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [recipientHasAccount, setRecipientHasAccount] = useState<boolean | null>(null);
  const [destinationInfo, setDestinationInfo] = useState<{ recipientName: string } | null>(null);
  const [stripeNotConfigured, setStripeNotConfigured] = useState(false);
  const [stripeSetupError, setStripeSetupError] = useState<string | undefined>(undefined);

  // Tip state
  const [tipAmount, setTipAmount] = useState<number>(1);
  const [isCustomTip, setIsCustomTip] = useState(false);
  const [customTip, setCustomTip] = useState('');
  const [tipAutoAdjusted, setTipAutoAdjusted] = useState(false);

  // Auto-adjust tip when donation amount changes
  // This ensures a $1 donation doesn't default to a $1 tip (100%)
  useEffect(() => {
    if (!isCustomTip) {
      const smartTip = getSmartTipSuggestions(getAmount());
      // Only auto-adjust if current tip isn't in the new presets, or on first render
      const currentInPresets = smartTip.presets.includes(tipAmount);
      if (!currentInPresets || !tipAutoAdjusted) {
        setTipAmount(smartTip.defaultTip);
        setTipAutoAdjusted(true);
      }
    }
  }, [selectedAmount, customAmount, isCustom]);


  // Check if recipient has a connected Stripe account
  useEffect(() => {
    if (visible && needId) {
      checkRecipientAccount();
    }
  }, [visible, needId]);

  const checkRecipientAccount = async () => {
    try {
      const { data } = await supabase.functions.invoke('stripe-connect', {
        body: { action: 'get_recipient_account', needId },
      });
      if (data?.success) {
        setRecipientHasAccount(data.hasConnectedAccount);
        setDestinationInfo({ recipientName: data.recipientName });
      }
    } catch {
      setRecipientHasAccount(false);
    }
  };

  const getAmount = () => {
    if (isCustom) {
      const parsed = parseFloat(customAmount);
      return isNaN(parsed) ? 0 : parsed;
    }
    return selectedAmount || 0;
  };

  const getTip = () => {
    if (isCustomTip) {
      const parsed = parseFloat(customTip);
      return isNaN(parsed) ? 0 : Math.max(0, parsed);
    }
    return tipAmount;
  };

  const amount = getAmount();
  const tip = getTip();
  const totalCharge = Math.round((amount + tip) * 100) / 100;
  // Ref to prevent double-submission (persists across re-renders)
  const paymentInProgressRef = React.useRef(false);

  // Track recent payment attempts in localStorage to prevent re-payment across modal re-opens
  const getRecentPaymentKey = () => `spotme_payment_${needId}`;
  
  const hasRecentPayment = (): boolean => {
    try {
      const key = getRecentPaymentKey();
      const stored = localStorage.getItem(key);
      if (!stored) return false;
      const data = JSON.parse(stored);
      // Consider payment "recent" if within last 10 minutes
      const tenMinAgo = Date.now() - 10 * 60 * 1000;
      return data.timestamp > tenMinAgo;
    } catch { return false; }
  };

  const markPaymentAttempt = () => {
    try {
      const key = getRecentPaymentKey();
      localStorage.setItem(key, JSON.stringify({ timestamp: Date.now(), amount }));
    } catch {}
  };

  const clearPaymentAttempt = () => {
    try { localStorage.removeItem(getRecentPaymentKey()); } catch {}
  };

  const handleContribute = async () => {
    if (amount <= 0 || amount > 300) return;
    
    // Prevent double-click / double-submission
    if (paymentInProgressRef.current || processing) {
      console.log('[SpotMe] Payment already in progress, ignoring click');
      return;
    }

    // Check for recent payment attempt on same need
    if (hasRecentPayment()) {
      setErrorMsg(
        'A payment was recently initiated for this need. Please check your bank/card statement before trying again. ' +
        'If the previous payment failed, wait a few minutes and try again.'
      );
      return;
    }

    paymentInProgressRef.current = true;
    setProcessing(true);
    setErrorMsg('');
    setStripeNotConfigured(false);
    setStripeSetupError(undefined);

    try {
      // Mark that we're attempting a payment (persists across modal re-opens)
      markPaymentAttempt();

      const result = await contributeWithPayment(needId, amount, note.trim() || undefined, isAnonymous, tip);

      if (result.success) {
        if ((result.mode === 'stripe_connect' || result.mode === 'stripe') && (result.clientSecret || result.checkoutUrl)) {
          // Redirecting to payment page - keep processing state, don't reset ref
          return;
        }
        // Direct processing succeeded - clear the payment tracking
        clearPaymentAttempt();
        
        setPaymentMode(result.mode || 'direct');
        setSuccessAmount(amount);
        setSuccessTip(tip);
        setShowSuccess(true);

        if (result.stripeNotConfigured) {
          setStripeNotConfigured(true);
          setStripeSetupError(result.stripeSetupError);
        }

        setTimeout(() => {
          resetAndClose();
        }, stripeNotConfigured ? 6000 : 3000);
      } else {
        // Payment failed - clear the tracking so they can retry
        clearPaymentAttempt();
        setErrorMsg(result.error || 'Payment failed. Please try again.');
        paymentInProgressRef.current = false; // Allow retry on error
      }
    } catch (err: any) {
      clearPaymentAttempt();
      setErrorMsg(err.message || 'Something went wrong. Please try again.');
      paymentInProgressRef.current = false; // Allow retry on error
    } finally {
      setProcessing(false);
    }
  };






  const resetAndClose = () => {
    setShowSuccess(false);
    setSuccessAmount(0);
    setSuccessTip(0);
    setSelectedAmount(5);
    setCustomAmount('');
    setNote('');
    setIsCustom(false);
    setIsAnonymous(false);
    setErrorMsg('');
    setProcessing(false);
    setPaymentMode(null);
    setTipAmount(1);
    setIsCustomTip(false);
    setCustomTip('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={resetAndClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} onPress={processing ? undefined : resetAndClose} activeOpacity={1} />

        <View style={styles.sheet}>
          {showSuccess ? (
            <View style={styles.successContainer}>
              <View style={styles.successIcon}>
                <MaterialIcons name="check-circle" size={56} color={Colors.success} />
              </View>
              <Text style={styles.successTitle}>Spot Sent!</Text>
              <Text style={styles.successMessage}>
                You spotted ${successAmount.toFixed(2)} on this need.
              </Text>
              <View style={styles.receiptCard}>
                <View style={styles.receiptHeader}>
                  <MaterialIcons name="receipt-long" size={18} color={Colors.textSecondary} />
                  <Text style={styles.receiptHeaderText}>Payment Receipt</Text>
                </View>
                <View style={styles.receiptRow}>
                  <Text style={styles.receiptLabel}>Contribution</Text>
                  <Text style={styles.receiptValue}>${successAmount.toFixed(2)}</Text>
                </View>
                {successTip > 0 && (
                  <View style={styles.receiptRow}>
                    <Text style={styles.receiptLabel}>Support SpotMe tip</Text>
                    <Text style={styles.receiptValue}>${successTip.toFixed(2)}</Text>
                  </View>
                )}
                <View style={[styles.receiptRow, styles.receiptRowHighlight]}>
                  <Text style={styles.receiptLabelBold}>Recipient receives</Text>
                  <Text style={styles.receiptValueBold}>${successAmount.toFixed(2)}</Text>
                </View>
                <View style={styles.receiptRow}>
                  <Text style={styles.receiptLabel}>Payment method</Text>
                  <View style={styles.paymentMethodBadge}>
                    <MaterialIcons
                      name={paymentMode === 'stripe_connect' ? 'swap-horiz' : paymentMode === 'stripe' ? 'credit-card' : 'account-balance'}
                      size={12}
                      color={Colors.secondary}
                    />
                    <Text style={styles.paymentMethodText}>
                      {paymentMode === 'stripe_connect' ? 'Stripe Connect' : paymentMode === 'stripe' ? 'Stripe' : 'SpotMe Direct'}
                    </Text>
                  </View>
                </View>
              </View>
              <Text style={styles.successSubtext}>100% of your contribution goes to the recipient. You're making a difference.</Text>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
              {/* Handle */}
              <View style={styles.handle} />

              {/* Header */}
              <View style={styles.header}>
                <Text style={styles.headerTitle}>Spot Someone</Text>
                <TouchableOpacity onPress={resetAndClose} disabled={processing}>
                  <MaterialIcons name="close" size={24} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <Text style={styles.needTitle} numberOfLines={2}>"{needTitle}"</Text>
              <Text style={styles.remainingText}>${remaining} remaining to reach goal</Text>

              {/* Stripe Connect Badge */}
              {recipientHasAccount === true ? (
                <View style={styles.connectBadge}>
                  <MaterialIcons name="swap-horiz" size={16} color={Colors.secondary} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.connectBadgeTitle}>Direct Payment via Stripe Connect</Text>
                    <Text style={styles.connectBadgeText}>
                      100% goes directly to {destinationInfo?.recipientName || 'the recipient'}. No platform fees.
                    </Text>
                  </View>
                </View>
              ) : recipientHasAccount === false ? (
                <View style={styles.platformBadge}>
                  <MaterialIcons name="lock" size={14} color={Colors.accent} />
                  <Text style={styles.platformBadgeText}>
                    Secure payment via Stripe. Funds held until recipient sets up payouts.
                  </Text>
                </View>
              ) : (
                <View style={styles.secureBadge}>
                  <MaterialIcons name="lock" size={14} color={Colors.secondary} />
                  <Text style={styles.secureBadgeText}>Secure payment via Stripe</Text>
                </View>
              )}

              {/* Amount Selection */}
              <Text style={styles.sectionLabel}>Choose amount</Text>
              <View style={styles.amountGrid}>
                {PRESET_AMOUNTS.map(amt => (
                  <TouchableOpacity
                    key={amt}
                    style={[
                      styles.amountButton,
                      !isCustom && selectedAmount === amt && styles.amountButtonSelected,
                    ]}
                    onPress={() => { setSelectedAmount(amt); setIsCustom(false); }}
                    activeOpacity={0.7}
                    disabled={processing}
                  >
                    <Text style={[
                      styles.amountButtonText,
                      !isCustom && selectedAmount === amt && styles.amountButtonTextSelected,
                    ]}>
                      ${amt}
                    </Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={[styles.amountButton, isCustom && styles.amountButtonSelected]}
                  onPress={() => setIsCustom(true)}
                  activeOpacity={0.7}
                  disabled={processing}
                >
                  <Text style={[styles.amountButtonText, isCustom && styles.amountButtonTextSelected]}>
                    Custom
                  </Text>
                </TouchableOpacity>
              </View>

              {isCustom && (
                <View style={styles.customInputRow}>
                  <Text style={styles.dollarSign}>$</Text>
                  <TextInput
                    style={[styles.customInput, Platform.OS === 'web' && { outlineStyle: 'none' as any }]}
                    value={customAmount}
                    onChangeText={setCustomAmount}
                    keyboardType="numeric"
                    placeholder="Enter amount"
                    placeholderTextColor={Colors.textLight}
                    maxLength={6}
                    autoFocus
                    editable={!processing}
                  />
                </View>
              )}

              {/* Note */}
              <Text style={styles.sectionLabel}>Leave a note (optional)</Text>
              <TextInput
                style={[styles.noteInput, Platform.OS === 'web' && { outlineStyle: 'none' as any }]}
                value={note}
                onChangeText={setNote}
                placeholder="You got this! Sending good vibes..."
                placeholderTextColor={Colors.textLight}
                maxLength={100}
                multiline
                editable={!processing}
              />

              {/* Anonymous toggle */}
              <TouchableOpacity
                style={styles.anonymousToggle}
                onPress={() => setIsAnonymous(!isAnonymous)}
                activeOpacity={0.7}
                disabled={processing}
              >
                <View style={[styles.checkbox, isAnonymous && styles.checkboxChecked]}>
                  {isAnonymous && <MaterialIcons name="check" size={14} color={Colors.white} />}
                </View>
                <View style={styles.anonymousInfo}>
                  <Text style={styles.anonymousTitle}>Contribute anonymously</Text>
                  <Text style={styles.anonymousSubtitle}>Appear as "A kind stranger"</Text>
                </View>
                <MaterialIcons name="visibility-off" size={20} color={isAnonymous ? Colors.primary : Colors.textLight} />
              </TouchableOpacity>

              {/* ===== SMART TIP SUGGESTIONS ===== */}
              {(() => {
                const smartTip = getSmartTipSuggestions(amount);
                return (
                  <View style={styles.tipSection}>
                    <View style={styles.tipHeader}>
                      <MaterialIcons name="favorite" size={18} color={Colors.primary} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.tipTitle}>Support SpotMe</Text>
                        <Text style={styles.tipSubtitle}>{smartTip.message}</Text>
                      </View>
                    </View>
                    <View style={styles.tipGrid}>
                      {smartTip.presets.map(t => (
                        <TouchableOpacity
                          key={t}
                          style={[
                            styles.tipButton,
                            !isCustomTip && tipAmount === t && styles.tipButtonSelected,
                            t === smartTip.highlight && !isCustomTip && tipAmount !== t && { borderColor: Colors.primary + '40' },
                          ]}
                          onPress={() => { setTipAmount(t); setIsCustomTip(false); }}
                          activeOpacity={0.7}
                          disabled={processing}
                        >
                          <Text style={[
                            styles.tipButtonText,
                            !isCustomTip && tipAmount === t && styles.tipButtonTextSelected,
                          ]}>
                            {t === 0 ? 'No tip' : `$${t % 1 === 0 ? t : t.toFixed(2)}`}
                          </Text>
                          {t === smartTip.highlight && !isCustomTip && tipAmount !== t && (
                            <Text style={{ fontSize: 8, color: Colors.primary, fontWeight: '600', marginTop: 1 }}>Suggested</Text>
                          )}
                        </TouchableOpacity>
                      ))}
                      <TouchableOpacity
                        style={[styles.tipButton, isCustomTip && styles.tipButtonSelected]}
                        onPress={() => setIsCustomTip(true)}
                        activeOpacity={0.7}
                        disabled={processing}
                      >
                        <Text style={[styles.tipButtonText, isCustomTip && styles.tipButtonTextSelected]}>
                          Other
                        </Text>
                      </TouchableOpacity>
                    </View>
                    {isCustomTip && (
                      <View style={styles.customTipRow}>
                        <Text style={styles.customTipDollar}>$</Text>
                        <TextInput
                          style={[styles.customTipInput, Platform.OS === 'web' && { outlineStyle: 'none' as any }]}
                          value={customTip}
                          onChangeText={setCustomTip}
                          keyboardType="numeric"
                          placeholder="0.00"
                          placeholderTextColor={Colors.textLight}
                          maxLength={5}
                          autoFocus
                          editable={!processing}
                        />
                      </View>
                    )}
                  </View>
                );
              })()}


              {/* Fee Breakdown */}
              <View style={styles.feeCard}>
                <View style={styles.feeRow}>
                  <Text style={styles.feeLabel}>Contribution</Text>
                  <Text style={styles.feeValue}>${amount.toFixed(2)}</Text>
                </View>
                {tip > 0 && (
                  <View style={styles.feeRow}>
                    <View style={styles.recipientRow}>
                      <MaterialIcons name="favorite" size={12} color={Colors.primary} />
                      <Text style={[styles.feeLabel, { color: Colors.primary }]}>Support SpotMe tip</Text>
                    </View>
                    <Text style={[styles.feeValue, { color: Colors.primary }]}>${tip.toFixed(2)}</Text>
                  </View>
                )}
                <View style={[styles.feeRow, styles.totalRow]}>
                  <Text style={styles.totalLabel}>You pay</Text>
                  <Text style={styles.totalValue}>${totalCharge.toFixed(2)}</Text>
                </View>
                <View style={styles.feeRow}>
                  <View style={styles.recipientRow}>
                    <MaterialIcons name="person" size={14} color={Colors.success} />
                    <Text style={[styles.feeLabel, { color: Colors.success, fontWeight: '700' }]}>
                      {recipientHasAccount ? 'Sent directly to recipient' : 'Recipient receives'}
                    </Text>
                  </View>
                  <Text style={[styles.feeValue, { color: Colors.success, fontWeight: '700' }]}>
                    ${amount.toFixed(2)}
                  </Text>
                </View>
                <View style={styles.processingNote}>
                  <MaterialIcons name="info-outline" size={12} color={Colors.textLight} />
                  <Text style={styles.processingNoteText}>
                    Stripe processing (2.9% + $0.30) is handled separately
                  </Text>
                </View>
              </View>

              {/* Accepted payment methods */}
              <View style={styles.paymentMethods}>
                <Text style={styles.paymentMethodsLabel}>Accepted</Text>
                <View style={styles.paymentIcons}>
                  <View style={styles.paymentIcon}>
                    <MaterialIcons name="credit-card" size={16} color={Colors.textSecondary} />
                    <Text style={styles.paymentIconText}>Card</Text>
                  </View>
                  <View style={styles.paymentIcon}>
                    <MaterialIcons name="account-balance" size={16} color={Colors.textSecondary} />
                    <Text style={styles.paymentIconText}>Bank</Text>
                  </View>
                  <View style={styles.paymentIcon}>
                    <MaterialIcons name="phone-iphone" size={16} color={Colors.textSecondary} />
                    <Text style={styles.paymentIconText}>Apple Pay</Text>
                  </View>
                  <View style={styles.paymentIcon}>
                    <MaterialIcons name="g-mobiledata" size={16} color={Colors.textSecondary} />
                    <Text style={styles.paymentIconText}>Google Pay</Text>
                  </View>
                </View>
              </View>

              {/* Error */}
              {errorMsg ? (
                <View style={styles.errorBanner}>
                  <MaterialIcons name="error-outline" size={18} color={Colors.error} />
                  <Text style={styles.errorText}>{errorMsg}</Text>
                </View>
              ) : null}

              {/* Submit */}
              <TouchableOpacity
                style={[styles.submitButton, (amount <= 0 || processing) && styles.submitButtonDisabled]}
                onPress={handleContribute}
                activeOpacity={0.8}
                disabled={amount <= 0 || processing}
              >
                {processing ? (
                  <ActivityIndicator size="small" color={Colors.white} />
                ) : (
                  <MaterialIcons name="lock" size={18} color={Colors.white} />
                )}
                <Text style={styles.submitButtonText}>
                  {processing ? 'Processing Payment...' : `Pay $${totalCharge > 0 ? totalCharge.toFixed(2) : '0.00'}`}
                </Text>
              </TouchableOpacity>

              <View style={styles.stripeFooter}>
                <MaterialIcons name="verified-user" size={14} color={Colors.textLight} />
                <Text style={styles.disclaimerText}>
                  {recipientHasAccount
                    ? 'Powered by Stripe Connect. 100% of your contribution goes to the recipient. No platform fees. PCI-DSS compliant.'
                    : 'Payments secured by Stripe. No platform fees — 100% goes to the recipient. PCI-DSS compliant.'
                  }
                </Text>
              </View>
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { flex: 1, backgroundColor: Colors.overlay },
  sheet: { backgroundColor: Colors.surface, borderTopLeftRadius: BorderRadius.xxl, borderTopRightRadius: BorderRadius.xxl, paddingHorizontal: Spacing.xxl, paddingBottom: 40, maxHeight: '90%' },
  handle: { width: 40, height: 4, backgroundColor: Colors.border, borderRadius: 2, alignSelf: 'center', marginTop: Spacing.md, marginBottom: Spacing.lg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  headerTitle: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.text },
  needTitle: { fontSize: FontSize.md, color: Colors.textSecondary, fontStyle: 'italic', marginBottom: Spacing.xs },
  remainingText: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: '600', marginBottom: Spacing.md },
  connectBadge: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm,
    backgroundColor: Colors.secondaryLight, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg, marginBottom: Spacing.xl,
  },
  connectBadgeTitle: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.secondaryDark, marginBottom: 2 },
  connectBadgeText: { fontSize: FontSize.xs, color: Colors.secondaryDark, lineHeight: 16 },
  platformBadge: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    backgroundColor: Colors.accentLight, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full, alignSelf: 'flex-start', marginBottom: Spacing.xl,
  },
  platformBadgeText: { fontSize: FontSize.xs, fontWeight: '600', color: '#8B7000' },
  secureBadge: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    backgroundColor: Colors.secondaryLight, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full, alignSelf: 'flex-start', marginBottom: Spacing.xl,
  },
  secureBadgeText: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.secondaryDark },
  sectionLabel: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textSecondary, marginBottom: Spacing.sm, textTransform: 'uppercase', letterSpacing: 0.5 },
  amountGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.lg },
  amountButton: { paddingVertical: Spacing.md, paddingHorizontal: Spacing.xl, borderRadius: BorderRadius.lg, backgroundColor: Colors.surfaceAlt, borderWidth: 2, borderColor: 'transparent', minWidth: 80, alignItems: 'center' },
  amountButtonSelected: { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  amountButtonText: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textSecondary },
  amountButtonTextSelected: { color: Colors.primary },
  customInputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surfaceAlt, borderRadius: BorderRadius.lg, paddingHorizontal: Spacing.lg, marginBottom: Spacing.lg, borderWidth: 2, borderColor: Colors.primary },
  dollarSign: { fontSize: FontSize.xxl, fontWeight: '700', color: Colors.primary },
  customInput: { flex: 1, fontSize: FontSize.xxl, fontWeight: '700', color: Colors.text, paddingVertical: Spacing.md, marginLeft: Spacing.xs },
  noteInput: { backgroundColor: Colors.surfaceAlt, borderRadius: BorderRadius.lg, padding: Spacing.lg, fontSize: FontSize.md, color: Colors.text, marginBottom: Spacing.md, minHeight: 60, textAlignVertical: 'top' },
  anonymousToggle: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: Colors.surfaceAlt, borderRadius: BorderRadius.lg, padding: Spacing.lg, marginBottom: Spacing.lg },
  checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  anonymousInfo: { flex: 1 },
  anonymousTitle: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.text },
  anonymousSubtitle: { fontSize: FontSize.xs, color: Colors.textLight, marginTop: 1 },

  // Tip Section
  tipSection: {
    backgroundColor: Colors.primaryLight,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.primary + '30',
  },
  tipHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, marginBottom: Spacing.md },
  tipTitle: { fontSize: FontSize.md, fontWeight: '800', color: Colors.text },
  tipSubtitle: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 1, lineHeight: 16 },
  tipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  tipButton: {
    paddingVertical: Spacing.sm, paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg, backgroundColor: Colors.surface,
    borderWidth: 2, borderColor: 'transparent', minWidth: 60, alignItems: 'center',
  },
  tipButtonSelected: { borderColor: Colors.primary, backgroundColor: Colors.surface },
  tipButtonText: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textSecondary },
  tipButtonTextSelected: { color: Colors.primary },
  customTipRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg, paddingHorizontal: Spacing.md, marginTop: Spacing.sm,
    borderWidth: 2, borderColor: Colors.primary,
  },
  customTipDollar: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.primary },
  customTipInput: { flex: 1, fontSize: FontSize.lg, fontWeight: '700', color: Colors.text, paddingVertical: Spacing.sm, marginLeft: Spacing.xs },

  feeCard: { backgroundColor: Colors.surfaceAlt, borderRadius: BorderRadius.lg, padding: Spacing.lg, marginBottom: Spacing.md, gap: Spacing.xs },
  feeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 2 },
  feeLabel: { fontSize: FontSize.sm, color: Colors.textLight },
  feeValue: { fontSize: FontSize.sm, color: Colors.textLight },
  totalRow: { borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.sm, marginTop: Spacing.xs },
  totalLabel: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text },
  totalValue: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text },
  recipientRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  processingNote: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: Spacing.xs },
  processingNoteText: { fontSize: 10, color: Colors.textLight, fontStyle: 'italic' },
  paymentMethods: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.lg },
  paymentMethodsLabel: { fontSize: FontSize.xs, color: Colors.textLight, fontWeight: '600' },
  paymentIcons: { flexDirection: 'row', gap: Spacing.md, flex: 1 },
  paymentIcon: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  paymentIconText: { fontSize: FontSize.xs, color: Colors.textLight },
  errorBanner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: '#FFF0F0', padding: Spacing.md, borderRadius: BorderRadius.lg, marginBottom: Spacing.md },
  errorText: { flex: 1, fontSize: FontSize.sm, color: Colors.error, fontWeight: '600' },
  submitButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: Colors.primary, paddingVertical: Spacing.lg, borderRadius: BorderRadius.xl, ...Shadow.md },
  submitButtonDisabled: { opacity: 0.5 },
  submitButtonText: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.white },
  stripeFooter: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, marginTop: Spacing.md, paddingBottom: Spacing.md },
  disclaimerText: { flex: 1, fontSize: FontSize.xs, color: Colors.textLight, lineHeight: 16 },
  successContainer: { alignItems: 'center', paddingVertical: Spacing.xxl, gap: Spacing.md },
  successIcon: { marginBottom: Spacing.sm },
  successTitle: { fontSize: FontSize.xxl, fontWeight: '800', color: Colors.text },
  successMessage: { fontSize: FontSize.md, color: Colors.textSecondary, textAlign: 'center' },
  receiptCard: { width: '100%', backgroundColor: Colors.surfaceAlt, borderRadius: BorderRadius.lg, padding: Spacing.lg, gap: Spacing.sm, marginTop: Spacing.md },
  receiptHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingBottom: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.borderLight, marginBottom: Spacing.xs },
  receiptHeaderText: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textSecondary },
  receiptRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  receiptRowHighlight: { borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.sm, marginTop: Spacing.xs },
  receiptLabel: { fontSize: FontSize.sm, color: Colors.textLight },
  receiptValue: { fontSize: FontSize.sm, color: Colors.textLight },
  receiptLabelBold: { fontSize: FontSize.md, fontWeight: '700', color: Colors.success },
  receiptValueBold: { fontSize: FontSize.md, fontWeight: '700', color: Colors.success },
  paymentMethodBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.secondaryLight, paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.sm },
  paymentMethodText: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.secondaryDark },
  successSubtext: { fontSize: FontSize.sm, color: Colors.textSecondary, fontStyle: 'italic', marginTop: Spacing.sm, textAlign: 'center' },
});
