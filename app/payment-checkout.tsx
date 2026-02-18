import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Platform, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, BorderRadius, FontSize, Spacing, Shadow } from '@/app/lib/theme';

const STRIPE_PK = 'pk_live_51OJhJBHdGQpsHqInIzu7c6PzGPSH0yImD4xfpofvxvFZs0VFhPRXZCyEgYkkhOtBOXFWvssYASs851mflwQvjnrl00T6DbUwWZ';
const STRIPE_ACCOUNT = 'acct_1T10cMQmpzRtFmoy';

export default function PaymentCheckoutScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(false);
  const [stripeReady, setStripeReady] = useState(false);
  const stripeRef = useRef<any>(null);
  const elementsRef = useRef<any>(null);
  const containerRef = useRef<any>(null);

  // Parse URL params
  const [params, setParams] = useState<{
    clientSecret: string;
    paymentId: string;
    amount: string;
    needTitle: string;
    destinationCharge: string;
    applicationFee: string;
    recipientReceives: string;
  }>({
    clientSecret: '',
    paymentId: '',
    amount: '0',
    needTitle: '',
    destinationCharge: 'false',
    applicationFee: '0',
    recipientReceives: '0',
  });

  useEffect(() => {
    if (Platform.OS === 'web') {
      const urlParams = new URLSearchParams(window.location.search);
      setParams({
        clientSecret: urlParams.get('client_secret') || '',
        paymentId: urlParams.get('payment_id') || '',
        amount: urlParams.get('amount') || '0',
        needTitle: urlParams.get('need_title') || '',
        destinationCharge: urlParams.get('destination_charge') || 'false',
        applicationFee: urlParams.get('application_fee') || '0',
        recipientReceives: urlParams.get('recipient_receives') || '0',
      });
    }
  }, []);

  // Load Stripe.js and mount PaymentElement
  useEffect(() => {
    if (Platform.OS !== 'web' || !params.clientSecret) return;

    const loadStripeAndMount = async () => {
      try {
        // Load Stripe.js script if not already loaded
        if (!(window as any).Stripe) {
          await new Promise<void>((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://js.stripe.com/v3/';
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('Failed to load Stripe.js'));
            document.head.appendChild(script);
          });
        }

        // Initialize Stripe with connected account
        const stripe = (window as any).Stripe(STRIPE_PK, {
          stripeAccount: STRIPE_ACCOUNT,
        });
        stripeRef.current = stripe;

        // Create Elements instance
        const elements = stripe.elements({
          clientSecret: params.clientSecret,
          appearance: {
            theme: 'stripe',
            variables: {
              colorPrimary: Colors.primary,
              colorBackground: Colors.surface,
              colorText: Colors.text,
              colorDanger: Colors.error,
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              borderRadius: '12px',
              spacingUnit: '4px',
            },
            rules: {
              '.Input': {
                border: `1px solid ${Colors.border}`,
                boxShadow: 'none',
                padding: '12px 16px',
              },
              '.Input:focus': {
                border: `2px solid ${Colors.primary}`,
                boxShadow: `0 0 0 1px ${Colors.primary}20`,
              },
              '.Label': {
                fontWeight: '600',
                fontSize: '13px',
                color: Colors.textSecondary,
              },
            },
          },
        });
        elementsRef.current = elements;

        // Mount PaymentElement
        const paymentElement = elements.create('payment', {
          layout: 'tabs',
        });

        // Wait for the container to be in the DOM
        const waitForContainer = () => {
          return new Promise<void>((resolve) => {
            const check = () => {
              const container = document.getElementById('stripe-payment-element');
              if (container) {
                paymentElement.mount('#stripe-payment-element');
                resolve();
              } else {
                setTimeout(check, 100);
              }
            };
            check();
          });
        };

        await waitForContainer();

        paymentElement.on('ready', () => {
          setStripeReady(true);
          setLoading(false);
        });

        // Fallback if ready event doesn't fire
        setTimeout(() => {
          setStripeReady(true);
          setLoading(false);
        }, 3000);

      } catch (err: any) {
        console.error('Stripe load error:', err);
        setError(err.message || 'Failed to load payment form');
        setLoading(false);
      }
    };

    loadStripeAndMount();
  }, [params.clientSecret]);

  const handleSubmit = async () => {
    if (!stripeRef.current || !elementsRef.current || processing) return;

    setProcessing(true);
    setError('');

    try {
      const { error: submitError } = await stripeRef.current.confirmPayment({
        elements: elementsRef.current,
        confirmParams: {
          return_url: `${window.location.origin}/payment-success?payment_id=${params.paymentId}`,
        },
      });

      if (submitError) {
        setError(submitError.message || 'Payment failed');
        setProcessing(false);
      }
      // If no error, the page will redirect
    } catch (err: any) {
      setError(err.message || 'Payment failed');
      setProcessing(false);
    }
  };

  const topPadding = Platform.OS === 'web' ? 16 : insets.top;
  const isDestinationCharge = params.destinationCharge === 'true';
  const amount = parseFloat(params.amount) || 0;
  const appFee = parseFloat(params.applicationFee) || 0;
  const recipientGets = parseFloat(params.recipientReceives) || 0;

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} disabled={processing}>
          <MaterialIcons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Secure Payment</Text>
        <View style={styles.lockBadge}>
          <MaterialIcons name="lock" size={16} color={Colors.secondary} />
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Payment Summary */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <MaterialIcons name="receipt-long" size={20} color={Colors.primary} />
            <Text style={styles.summaryTitle}>Payment Summary</Text>
          </View>

          {params.needTitle ? (
            <Text style={styles.needTitle} numberOfLines={2}>"{params.needTitle}"</Text>
          ) : null}

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Contribution amount</Text>
            <Text style={styles.summaryValue}>${amount.toFixed(2)}</Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Platform fee (5%)</Text>
            <Text style={styles.summaryValue}>${appFee.toFixed(2)}</Text>
          </View>

          <View style={[styles.summaryRow, styles.summaryHighlight]}>
            <View style={styles.recipientRow}>
              <MaterialIcons name="person" size={16} color={Colors.success} />
              <Text style={styles.recipientLabel}>Recipient receives</Text>
            </View>
            <Text style={styles.recipientValue}>${recipientGets.toFixed(2)}</Text>
          </View>

          {isDestinationCharge && (
            <View style={styles.connectBadge}>
              <MaterialIcons name="swap-horiz" size={16} color={Colors.secondary} />
              <Text style={styles.connectBadgeText}>
                Funds go directly to the recipient via Stripe Connect
              </Text>
            </View>
          )}

          {!isDestinationCharge && (
            <View style={styles.platformBadge}>
              <MaterialIcons name="account-balance" size={16} color={Colors.accent} />
              <Text style={styles.platformBadgeText}>
                Funds held by SpotMe until recipient sets up payouts
              </Text>
            </View>
          )}
        </View>

        {/* Stripe Payment Element Container */}
        <View style={styles.paymentFormCard}>
          <Text style={styles.paymentFormTitle}>Payment Details</Text>

          {loading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={styles.loadingText}>Loading secure payment form...</Text>
            </View>
          )}

          {/* This div is where Stripe Elements mounts */}
          {Platform.OS === 'web' && (
            <View style={styles.stripeContainer}>
              <div
                id="stripe-payment-element"
                style={{
                  minHeight: loading ? 0 : 200,
                  opacity: loading ? 0 : 1,
                  transition: 'opacity 0.3s ease',
                }}
              />
            </View>
          )}

          {error ? (
            <View style={styles.errorBanner}>
              <MaterialIcons name="error-outline" size={18} color={Colors.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.payButton, (!stripeReady || processing) && styles.payButtonDisabled]}
          onPress={handleSubmit}
          activeOpacity={0.8}
          disabled={!stripeReady || processing}
        >
          {processing ? (
            <ActivityIndicator size="small" color={Colors.white} />
          ) : (
            <MaterialIcons name="lock" size={20} color={Colors.white} />
          )}
          <Text style={styles.payButtonText}>
            {processing ? 'Processing...' : `Pay $${amount.toFixed(2)}`}
          </Text>
        </TouchableOpacity>

        {/* Security Footer */}
        <View style={styles.securityFooter}>
          <View style={styles.securityRow}>
            <MaterialIcons name="verified-user" size={14} color={Colors.textLight} />
            <Text style={styles.securityText}>PCI-DSS Level 1 compliant</Text>
          </View>
          <View style={styles.securityRow}>
            <MaterialIcons name="https" size={14} color={Colors.textLight} />
            <Text style={styles.securityText}>256-bit SSL encryption</Text>
          </View>
          <View style={styles.securityRow}>
            <MaterialIcons name="shield" size={14} color={Colors.textLight} />
            <Text style={styles.securityText}>Powered by Stripe Connect</Text>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    backgroundColor: Colors.surface,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.surfaceAlt, alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.text },
  lockBadge: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.secondaryLight, alignItems: 'center', justifyContent: 'center',
  },
  content: { flex: 1, paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg },
  summaryCard: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.xl,
    padding: Spacing.xl, marginBottom: Spacing.lg, gap: Spacing.sm, ...Shadow.sm,
  },
  summaryHeader: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingBottom: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  summaryTitle: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.text },
  needTitle: {
    fontSize: FontSize.md, color: Colors.textSecondary, fontStyle: 'italic',
    marginTop: Spacing.xs, marginBottom: Spacing.xs,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 2 },
  summaryLabel: { fontSize: FontSize.sm, color: Colors.textLight },
  summaryValue: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.text },
  summaryHighlight: {
    borderTopWidth: 1, borderTopColor: Colors.border,
    paddingTop: Spacing.md, marginTop: Spacing.xs,
  },
  recipientRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  recipientLabel: { fontSize: FontSize.md, fontWeight: '700', color: Colors.success },
  recipientValue: { fontSize: FontSize.md, fontWeight: '800', color: Colors.success },
  connectBadge: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.secondaryLight, padding: Spacing.md,
    borderRadius: BorderRadius.lg, marginTop: Spacing.sm,
  },
  connectBadgeText: { flex: 1, fontSize: FontSize.xs, color: Colors.secondaryDark, fontWeight: '600', lineHeight: 16 },
  platformBadge: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.accentLight, padding: Spacing.md,
    borderRadius: BorderRadius.lg, marginTop: Spacing.sm,
  },
  platformBadgeText: { flex: 1, fontSize: FontSize.xs, color: '#8B7000', fontWeight: '600', lineHeight: 16 },
  paymentFormCard: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.xl,
    padding: Spacing.xl, marginBottom: Spacing.lg, ...Shadow.sm,
  },
  paymentFormTitle: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.text, marginBottom: Spacing.lg },
  loadingContainer: { alignItems: 'center', paddingVertical: Spacing.huge, gap: Spacing.md },
  loadingText: { fontSize: FontSize.sm, color: Colors.textSecondary },
  stripeContainer: { minHeight: 50 },
  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: '#FFF0F0', padding: Spacing.md, borderRadius: BorderRadius.lg, marginTop: Spacing.md,
  },
  errorText: { flex: 1, fontSize: FontSize.sm, color: Colors.error, fontWeight: '600' },
  payButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
    backgroundColor: Colors.primary, paddingVertical: Spacing.lg + 2,
    borderRadius: BorderRadius.xl, marginBottom: Spacing.lg, ...Shadow.md,
  },
  payButtonDisabled: { opacity: 0.5 },
  payButtonText: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.white },
  securityFooter: {
    alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.lg,
  },
  securityRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  securityText: { fontSize: FontSize.xs, color: Colors.textLight },
});
