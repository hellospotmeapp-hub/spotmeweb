import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, BorderRadius, FontSize, Spacing, Shadow } from '@/app/lib/theme';
import { useApp } from '@/app/lib/store';
import { supabase } from '@/app/lib/supabase';

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
  const [paymentMode, setPaymentMode] = useState<'stripe' | 'stripe_connect' | 'direct' | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [recipientHasAccount, setRecipientHasAccount] = useState<boolean | null>(null);
  const [destinationInfo, setDestinationInfo] = useState<{ recipientName: string } | null>(null);

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

  const amount = getAmount();
  const fee = Math.round(amount * 0.05 * 100) / 100;
  const recipientReceives = Math.round((amount - fee) * 100) / 100;

  const handleContribute = async () => {
    if (amount <= 0 || amount > 300) return;

    setProcessing(true);
    setErrorMsg('');

    try {
      const result = await contributeWithPayment(needId, amount, note.trim() || undefined, isAnonymous);

      if (result.success) {
        if ((result.mode === 'stripe_connect' || result.mode === 'stripe') && (result.clientSecret || result.checkoutUrl)) {
          // Redirecting to payment page - don't close modal
          return;
        }
        // Direct processing succeeded
        setPaymentMode(result.mode || 'direct');
        setSuccessAmount(amount);
        setShowSuccess(true);

        setTimeout(() => {
          resetAndClose();
        }, 3000);
      } else {
        setErrorMsg(result.error || 'Payment failed. Please try again.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Something went wrong. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const resetAndClose = () => {
    setShowSuccess(false);
    setSuccessAmount(0);
    setSelectedAmount(5);
    setCustomAmount('');
    setNote('');
    setIsCustom(false);
    setIsAnonymous(false);
    setErrorMsg('');
    setProcessing(false);
    setPaymentMode(null);
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
                <View style={styles.receiptRow}>
                  <Text style={styles.receiptLabel}>Platform fee (5%)</Text>
                  <Text style={styles.receiptValue}>${(successAmount * 0.05).toFixed(2)}</Text>
                </View>
                <View style={[styles.receiptRow, styles.receiptRowHighlight]}>
                  <Text style={styles.receiptLabelBold}>Recipient receives</Text>
                  <Text style={styles.receiptValueBold}>${(successAmount * 0.95).toFixed(2)}</Text>
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
              <Text style={styles.successSubtext}>Payment processed securely. You're making a difference.</Text>
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
                      95% goes directly to {destinationInfo?.recipientName || 'the recipient'}. 5% platform fee.
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

              {/* Fee Breakdown */}
              <View style={styles.feeCard}>
                <View style={styles.feeRow}>
                  <Text style={styles.feeLabel}>Contribution</Text>
                  <Text style={styles.feeValue}>${amount.toFixed(2)}</Text>
                </View>
                <View style={styles.feeRow}>
                  <Text style={styles.feeLabel}>Platform fee (5%)</Text>
                  <Text style={styles.feeValue}>${fee.toFixed(2)}</Text>
                </View>
                <View style={[styles.feeRow, styles.totalRow]}>
                  <Text style={styles.totalLabel}>You pay</Text>
                  <Text style={styles.totalValue}>${amount.toFixed(2)}</Text>
                </View>
                <View style={styles.feeRow}>
                  <View style={styles.recipientRow}>
                    <MaterialIcons name="person" size={14} color={Colors.success} />
                    <Text style={[styles.feeLabel, { color: Colors.success, fontWeight: '700' }]}>
                      {recipientHasAccount ? 'Sent directly to recipient' : 'Recipient receives'}
                    </Text>
                  </View>
                  <Text style={[styles.feeValue, { color: Colors.success, fontWeight: '700' }]}>
                    ${recipientReceives.toFixed(2)}
                  </Text>
                </View>
                {recipientHasAccount && (
                  <View style={styles.feeRow}>
                    <View style={styles.recipientRow}>
                      <MaterialIcons name="account-balance" size={14} color={Colors.textLight} />
                      <Text style={styles.feeLabel}>SpotMe platform fee</Text>
                    </View>
                    <Text style={styles.feeValue}>${fee.toFixed(2)}</Text>
                  </View>
                )}
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
                  {processing ? 'Processing Payment...' : `Pay $${amount > 0 ? amount.toFixed(2) : '0.00'}`}
                </Text>
              </TouchableOpacity>

              <View style={styles.stripeFooter}>
                <MaterialIcons name="verified-user" size={14} color={Colors.textLight} />
                <Text style={styles.disclaimerText}>
                  {recipientHasAccount
                    ? 'Powered by Stripe Connect. Funds split automatically: 95% to recipient, 5% platform fee. PCI-DSS compliant.'
                    : 'Payments secured by Stripe. A 5% fee supports platform operations. PCI-DSS compliant.'
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
  feeCard: { backgroundColor: Colors.surfaceAlt, borderRadius: BorderRadius.lg, padding: Spacing.lg, marginBottom: Spacing.md, gap: Spacing.xs },
  feeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 2 },
  feeLabel: { fontSize: FontSize.sm, color: Colors.textLight },
  feeValue: { fontSize: FontSize.sm, color: Colors.textLight },
  totalRow: { borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.sm, marginTop: Spacing.xs },
  totalLabel: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text },
  totalValue: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text },
  recipientRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
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
  successSubtext: { fontSize: FontSize.sm, color: Colors.textSecondary, fontStyle: 'italic', marginTop: Spacing.sm },
});
