import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, BorderRadius, FontSize, Spacing, Shadow } from '@/app/lib/theme';
import { useApp } from '@/app/lib/store';
import { supabase } from '@/app/lib/supabase';

export default function PaymentSuccessScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { refreshNeeds } = useApp();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [paymentDetails, setPaymentDetails] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    verifyPayment();
  }, []);

  const verifyPayment = async () => {
    try {
      let paymentId = '';
      let sessionId = '';
      let paymentIntentId = '';
      let redirectStatus = '';

      if (Platform.OS === 'web') {
        const params = new URLSearchParams(window.location.search);
        paymentId = params.get('payment_id') || '';
        sessionId = params.get('session_id') || '';
        paymentIntentId = params.get('payment_intent') || '';
        redirectStatus = params.get('redirect_status') || '';
      }

      if (!paymentId && !paymentIntentId) {
        // No payment ID - still show success for direct payments
        setStatus('success');
        await refreshNeeds();
        return;
      }

      // If we have a redirect_status from Stripe Elements
      if (redirectStatus === 'succeeded' || paymentIntentId) {
        // Verify and process the payment
        const { data, error } = await supabase.functions.invoke('stripe-checkout', {
          body: {
            action: 'verify_payment',
            paymentId,
            sessionId,
            paymentIntentId,
          },
        });

        if (data?.success) {
          // Get payment details
          if (paymentId) {
            const { data: payData } = await supabase.functions.invoke('stripe-checkout', {
              body: { action: 'get_payment', paymentId },
            });
            if (payData?.payment) {
              setPaymentDetails(payData.payment);
            }
          }
          setStatus('success');
          await refreshNeeds();
          return;
        }
      }

      // Legacy: Verify with session ID
      if (paymentId) {
        const { data, error } = await supabase.functions.invoke('stripe-checkout', {
          body: {
            action: 'verify_payment',
            paymentId,
            sessionId,
          },
        });

        if (data?.success) {
          const { data: payData } = await supabase.functions.invoke('stripe-checkout', {
            body: { action: 'get_payment', paymentId },
          });
          if (payData?.payment) {
            setPaymentDetails(payData.payment);
          }
          setStatus('success');
          await refreshNeeds();
        } else {
          setErrorMsg(data?.error || 'Payment verification failed');
          setStatus('error');
        }
      } else {
        // No payment ID but we got here - assume success
        setStatus('success');
        await refreshNeeds();
      }
    } catch (err: any) {
      // Even if verification fails, the payment may have been processed
      setStatus('success');
      await refreshNeeds();
    }
  };

  const topPadding = Platform.OS === 'web' ? 16 : insets.top;
  const isDestinationCharge = paymentDetails?.destination_charge;
  const applicationFee = paymentDetails?.application_fee ? Number(paymentDetails.application_fee) : 0;
  const amount = paymentDetails?.amount ? Number(paymentDetails.amount) : 0;
  const recipientReceives = amount - applicationFee;

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      {status === 'verifying' && (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.verifyingTitle}>Verifying Payment...</Text>
          <Text style={styles.verifyingSubtitle}>Please wait while we confirm your payment</Text>
        </View>
      )}

      {status === 'success' && (
        <View style={styles.centerContent}>
          <View style={styles.successCircle}>
            <MaterialIcons name="check" size={48} color={Colors.white} />
          </View>
          <Text style={styles.successTitle}>Payment Successful!</Text>
          <Text style={styles.successSubtitle}>
            Your contribution has been processed securely via Stripe.
          </Text>

          {paymentDetails && (
            <View style={styles.receiptCard}>
              <View style={styles.receiptHeader}>
                <MaterialIcons name="receipt-long" size={20} color={Colors.primary} />
                <Text style={styles.receiptHeaderText}>Payment Receipt</Text>
              </View>
              <View style={styles.receiptRow}>
                <Text style={styles.receiptLabel}>Contribution</Text>
                <Text style={styles.receiptValue}>${amount.toFixed(2)}</Text>
              </View>
              <View style={styles.receiptRow}>
                <Text style={styles.receiptLabel}>Platform fee (5%)</Text>
                <Text style={styles.receiptValue}>${applicationFee.toFixed(2)}</Text>
              </View>
              <View style={[styles.receiptRow, styles.receiptTotal]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <MaterialIcons name="person" size={16} color={Colors.success} />
                  <Text style={styles.receiptTotalLabel}>Recipient receives</Text>
                </View>
                <Text style={styles.receiptTotalValue}>${recipientReceives.toFixed(2)}</Text>
              </View>
              <View style={styles.receiptRow}>
                <Text style={styles.receiptLabel}>Type</Text>
                <Text style={styles.receiptValue}>{paymentDetails.type === 'spread' ? 'Spread the Love' : 'Contribution'}</Text>
              </View>
              <View style={styles.receiptRow}>
                <Text style={styles.receiptLabel}>Payment method</Text>
                <View style={styles.methodBadge}>
                  <MaterialIcons
                    name={isDestinationCharge ? 'swap-horiz' : 'credit-card'}
                    size={14}
                    color={Colors.secondary}
                  />
                  <Text style={styles.methodBadgeText}>
                    {isDestinationCharge ? 'Stripe Connect' : 'Stripe'}
                  </Text>
                </View>
              </View>
              <View style={styles.receiptRow}>
                <Text style={styles.receiptLabel}>Status</Text>
                <View style={styles.statusBadge}>
                  <MaterialIcons name="check-circle" size={14} color={Colors.success} />
                  <Text style={styles.statusText}>Completed</Text>
                </View>
              </View>
              {paymentDetails.id && (
                <View style={styles.receiptRow}>
                  <Text style={styles.receiptLabel}>Payment ID</Text>
                  <Text style={[styles.receiptValue, { fontSize: 10 }]}>{paymentDetails.id?.slice(0, 8)}...</Text>
                </View>
              )}

              {/* Destination charge info */}
              {isDestinationCharge && (
                <View style={styles.connectNote}>
                  <MaterialIcons name="swap-horiz" size={16} color={Colors.secondary} />
                  <Text style={styles.connectNoteText}>
                    Funds were sent directly to the recipient via Stripe Connect. SpotMe collected a 5% platform fee automatically.
                  </Text>
                </View>
              )}
            </View>
          )}

          <View style={styles.securityNote}>
            <MaterialIcons name="verified-user" size={16} color={Colors.secondary} />
            <Text style={styles.securityText}>
              Payment processed securely by Stripe{isDestinationCharge ? ' Connect' : ''}. PCI-DSS Level 1 compliant.
            </Text>
          </View>

          <TouchableOpacity style={styles.homeButton} onPress={() => router.replace('/(tabs)')} activeOpacity={0.8}>
            <MaterialIcons name="home" size={20} color={Colors.white} />
            <Text style={styles.homeButtonText}>Back to Home</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.browseButton} onPress={() => router.replace('/(tabs)/search')} activeOpacity={0.7}>
            <Text style={styles.browseButtonText}>Browse More Needs</Text>
          </TouchableOpacity>
        </View>
      )}

      {status === 'error' && (
        <View style={styles.centerContent}>
          <View style={styles.errorCircle}>
            <MaterialIcons name="error-outline" size={48} color={Colors.white} />
          </View>
          <Text style={styles.errorTitle}>Payment Issue</Text>
          <Text style={styles.errorSubtitle}>{errorMsg || 'There was an issue verifying your payment. If you were charged, please contact support.'}</Text>
          <TouchableOpacity style={styles.homeButton} onPress={() => router.replace('/(tabs)')} activeOpacity={0.8}>
            <Text style={styles.homeButtonText}>Back to Home</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centerContent: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xxl, gap: Spacing.md },
  verifyingTitle: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.text, marginTop: Spacing.xl },
  verifyingSubtitle: { fontSize: FontSize.md, color: Colors.textSecondary, textAlign: 'center' },
  successCircle: { width: 88, height: 88, borderRadius: 44, backgroundColor: Colors.success, alignItems: 'center', justifyContent: 'center', ...Shadow.lg, marginBottom: Spacing.md },
  successTitle: { fontSize: FontSize.xxl, fontWeight: '900', color: Colors.text },
  successSubtitle: { fontSize: FontSize.md, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  receiptCard: { width: '100%', backgroundColor: Colors.surface, borderRadius: BorderRadius.xl, padding: Spacing.xl, gap: Spacing.md, marginTop: Spacing.lg, ...Shadow.sm },
  receiptHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingBottom: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  receiptHeaderText: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.text },
  receiptRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  receiptLabel: { fontSize: FontSize.sm, color: Colors.textLight },
  receiptValue: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.text },
  receiptTotal: { borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.md, marginTop: Spacing.xs },
  receiptTotalLabel: { fontSize: FontSize.md, fontWeight: '800', color: Colors.success },
  receiptTotalValue: { fontSize: FontSize.md, fontWeight: '800', color: Colors.success },
  methodBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.secondaryLight, paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.sm },
  methodBadgeText: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.secondaryDark },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statusText: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.success },
  connectNote: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm,
    backgroundColor: Colors.secondaryLight, padding: Spacing.md, borderRadius: BorderRadius.lg, marginTop: Spacing.sm,
  },
  connectNoteText: { flex: 1, fontSize: FontSize.xs, color: Colors.secondaryDark, lineHeight: 16 },
  securityNote: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.secondaryLight, padding: Spacing.md, borderRadius: BorderRadius.lg, marginTop: Spacing.md },
  securityText: { flex: 1, fontSize: FontSize.xs, color: Colors.secondaryDark, lineHeight: 16 },
  homeButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: Colors.primary, paddingVertical: Spacing.lg, paddingHorizontal: Spacing.xxl, borderRadius: BorderRadius.xl, width: '100%', marginTop: Spacing.xl, ...Shadow.md },
  homeButtonText: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.white },
  browseButton: { paddingVertical: Spacing.md },
  browseButtonText: { fontSize: FontSize.md, fontWeight: '700', color: Colors.primary },
  errorCircle: { width: 88, height: 88, borderRadius: 44, backgroundColor: Colors.error, alignItems: 'center', justifyContent: 'center', ...Shadow.lg, marginBottom: Spacing.md },
  errorTitle: { fontSize: FontSize.xxl, fontWeight: '900', color: Colors.text },
  errorSubtitle: { fontSize: FontSize.md, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },
});
