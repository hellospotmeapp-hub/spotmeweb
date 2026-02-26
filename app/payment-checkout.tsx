import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Platform, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, BorderRadius, FontSize, Spacing, Shadow } from '@/app/lib/theme';
import { supabase } from '@/app/lib/supabase';

// Platform Stripe publishable key — used with stripeAccount for connected account payments
const STRIPE_PK = 'pk_live_51OJhJBHdGQpsHqInIzu7c6PzGPSH0yImD4xfpofvxvFZs0VFhPRXZCyEgYkkhOtBOXFWvssYASs851mflwQvjnrl00T6DbUwWZ';
const DEFAULT_STRIPE_ACCOUNT = 'acct_1T10cMQmpzRtFmoy';

export default function PaymentCheckoutScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(false);
  const [stripeReady, setStripeReady] = useState(false);
  const [elementMounted, setElementMounted] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [paymentSucceeded, setPaymentSucceeded] = useState(false);
  const [formComplete, setFormComplete] = useState(false);
  const [loadRetries, setLoadRetries] = useState(0);
  const stripeRef = useRef<any>(null);
  const elementsRef = useRef<any>(null);
  const mountAttemptRef = useRef(0);

  // CRITICAL: Track if payment was ever submitted - NEVER reset to false once true
  const paymentEverSubmittedRef = useRef(false);

  // Parse URL params
  const [params, setParams] = useState<{
    clientSecret: string;
    paymentId: string;
    amount: string;
    tipAmount: string;
    needTitle: string;
    destinationCharge: string;
    applicationFee: string;
    recipientReceives: string;
    stripeAccount: string;
  }>({
    clientSecret: '',
    paymentId: '',
    amount: '0',
    tipAmount: '0',
    needTitle: '',
    destinationCharge: 'false',
    applicationFee: '0',
    recipientReceives: '0',
    stripeAccount: '',
  });

  useEffect(() => {
    if (Platform.OS === 'web') {
      const urlParams = new URLSearchParams(window.location.search);
      const parsed = {
        clientSecret: urlParams.get('client_secret') || '',
        paymentId: urlParams.get('payment_id') || '',
        amount: urlParams.get('amount') || '0',
        tipAmount: urlParams.get('tip_amount') || urlParams.get('application_fee') || '0',
        needTitle: urlParams.get('need_title') || '',
        destinationCharge: urlParams.get('destination_charge') || 'false',
        applicationFee: urlParams.get('application_fee') || '0',
        recipientReceives: urlParams.get('recipient_receives') || '0',
        stripeAccount: urlParams.get('stripe_account') || '',
      };
      setParams(parsed);

      if (!parsed.clientSecret) {
        setError('Missing payment information. Please go back and try again.');
        setLoading(false);
      }
    }
  }, []);

  // ================================================================
  // SERVER-SIDE PAYMENT STATUS CHECK
  // ================================================================
  const checkPaymentStatusServerSide = useCallback(async (): Promise<'succeeded' | 'failed' | 'pending' | 'unknown'> => {
    try {
      setCheckingStatus(true);
      
      const piId = params.clientSecret.split('_secret_')[0];
      if (!piId) return 'unknown';

      console.log('[SpotMe Checkout] Checking PI status server-side:', piId);

      const { data, error: fnError } = await supabase.functions.invoke('stripe-checkout', {
        body: {
          action: 'verify_payment',
          paymentIntentId: piId,
          paymentId: params.paymentId || undefined,
          redirectStatus: 'unknown',
        },
      });

      if (fnError && !data) {
        console.warn('[SpotMe Checkout] Status check failed:', fnError.message);
        return 'unknown';
      }

      console.log('[SpotMe Checkout] PI status result:', {
        success: data?.success,
        verified: data?.verified,
        already_processed: data?.already_processed,
        status: data?.status,
        notCharged: data?.notCharged,
      });

      if (data?.verified || data?.already_processed) {
        return 'succeeded';
      }

      if (data?.notCharged || data?.success === false) {
        return 'failed';
      }

      if (data?.status === 'processing' || data?.status === 'requires_action') {
        return 'pending';
      }

      return 'unknown';
    } catch (err) {
      console.error('[SpotMe Checkout] Status check error:', err);
      return 'unknown';
    } finally {
      setCheckingStatus(false);
    }
  }, [params.clientSecret, params.paymentId]);

  // Redirect to success page
  const redirectToSuccess = useCallback(() => {
    if (Platform.OS === 'web') {
      const successParams = new URLSearchParams({
        payment_id: params.paymentId || '',
        redirect_status: 'succeeded',
      });
      if (params.amount && params.amount !== '0') successParams.set('amount', params.amount);
      if (params.tipAmount && params.tipAmount !== '0') successParams.set('tip_amount', params.tipAmount);
      if (params.needTitle) successParams.set('need_title', params.needTitle);
      
      const piId = params.clientSecret.split('_secret_')[0];
      if (piId) successParams.set('payment_intent', piId);
      
      window.location.href = `/payment-success?${successParams.toString()}`;
    } else {
      router.replace('/payment-success' as any);
    }
  }, [params, router]);

  // Handle "Check Payment Status" button
  const handleCheckStatus = useCallback(async () => {
    const status = await checkPaymentStatusServerSide();
    
    if (status === 'succeeded') {
      setPaymentSucceeded(true);
      setError('');
      setTimeout(() => redirectToSuccess(), 1500);
    } else if (status === 'failed') {
      setError('Payment was not completed. Your card was NOT charged. You can safely try again.');
      paymentEverSubmittedRef.current = false;
    } else if (status === 'pending') {
      setError('Payment is still processing. Please wait a moment and check again.');
    } else {
      setError('Unable to confirm payment status. If you were charged, your contribution was received. Please check your bank statement.');
    }
  }, [checkPaymentStatusServerSide, redirectToSuccess]);

  // Detect if running in an iframe
  const isInIframe = useCallback(() => {
    if (Platform.OS !== 'web') return false;
    try { return window.self !== window.top; } catch { return true; }
  }, []);

  // Load Stripe.js and mount PaymentElement
  const loadAndMountStripe = useCallback(async () => {
    if (Platform.OS !== 'web' || !params.clientSecret) return;

    mountAttemptRef.current += 1;
    const attempt = mountAttemptRef.current;

    setLoading(true);
    setError('');
    setStripeReady(false);
    setElementMounted(false);
    setFormComplete(false);

    try {
      // Request storage access for iframe environments
      if (isInIframe()) {
        try {
          if (document.requestStorageAccess) {
            await document.requestStorageAccess();
          }
        } catch {
          console.log('[SpotMe Checkout] Storage access request failed (non-critical)');
        }
      }

      // Load Stripe.js script if not already loaded
      if (!(window as any).Stripe) {
        await new Promise<void>((resolve, reject) => {
          const existingScript = document.querySelector('script[src*="js.stripe.com"]');
          if (existingScript) {
            existingScript.addEventListener('load', () => resolve());
            existingScript.addEventListener('error', () => reject(new Error('Stripe.js script failed to load')));
            if ((window as any).Stripe) resolve();
            return;
          }
          const script = document.createElement('script');
          script.src = 'https://js.stripe.com/v3/';
          script.async = true;
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Failed to load Stripe.js. Check your internet connection.'));
          document.head.appendChild(script);
        });
      }

      if (!(window as any).Stripe) {
        throw new Error('Stripe.js failed to initialize. Please refresh the page.');
      }

      const stripeAccountId = params.stripeAccount || DEFAULT_STRIPE_ACCOUNT;
      let stripe: any = null;

      if (stripeAccountId) {
        try {
          stripe = (window as any).Stripe(STRIPE_PK, { stripeAccount: stripeAccountId });
        } catch (e: any) {
          console.warn('[SpotMe Checkout] Stripe init with stripeAccount failed:', e.message);
        }
      }

      if (!stripe) {
        try {
          stripe = (window as any).Stripe(STRIPE_PK);
        } catch (e: any) {
          throw new Error('Failed to initialize payment processor. Please try a different browser or disable content blockers.');
        }
      }

      stripeRef.current = stripe;

      // Clean up any previously mounted element
      const container = document.getElementById('stripe-payment-element');
      if (container) container.innerHTML = '';

      // Create Elements instance
      const elements = stripe.elements({
        clientSecret: params.clientSecret,
        appearance: {
          theme: 'stripe',
          variables: {
            colorPrimary: Colors.primary,
            colorBackground: '#FFFFFF',
            colorText: Colors.text,
            colorDanger: Colors.error,
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            borderRadius: '12px',
            spacingUnit: '4px',
          },
          rules: {
            '.Input': { border: `1px solid ${Colors.border}`, boxShadow: 'none', padding: '12px 16px', fontSize: '16px' },
            '.Input:focus': { border: `2px solid ${Colors.primary}`, boxShadow: `0 0 0 1px ${Colors.primary}20` },
            '.Label': { fontWeight: '600', fontSize: '13px', color: Colors.textSecondary },
          },
        },
      });
      elementsRef.current = elements;

      const paymentElement = elements.create('payment', { layout: 'tabs' });

      // Wait for container
      const waitForContainer = (): Promise<HTMLElement> => {
        return new Promise((resolve, reject) => {
          let checks = 0;
          const check = () => {
            const el = document.getElementById('stripe-payment-element');
            if (el) resolve(el);
            else if (checks > 50) reject(new Error('Payment form container not found.'));
            else { checks++; setTimeout(check, 100); }
          };
          check();
        });
      };

      const containerEl = await waitForContainer();
      paymentElement.mount(containerEl);

      paymentElement.on('ready', () => {
        if (attempt === mountAttemptRef.current) {
          setStripeReady(true);
          setElementMounted(true);
          setLoading(false);
          setError(''); // Clear any previous errors when form loads
        }
      });

      paymentElement.on('loaderror', (event: any) => {
        if (attempt === mountAttemptRef.current) {
          const msg = event?.error?.message || 'Failed to load payment form.';
          if (msg.includes('client_secret') || msg.includes('No such payment_intent')) {
            setError('This payment session has expired. Please go back and try again.');
          } else {
            setError(msg + ' Please try reloading.');
          }
          setLoading(false);
        }
      });

      // CRITICAL FIX: Track form completeness and clear errors on user interaction
      paymentElement.on('change', (event: any) => {
        if (event.complete) {
          setFormComplete(true);
          // Clear non-critical errors when user completes the form
          if (error && !paymentEverSubmittedRef.current) {
            setError('');
          }
        } else {
          setFormComplete(false);
        }
        // Clear validation errors when user starts typing
        if (event.value && !paymentEverSubmittedRef.current) {
          setError('');
        }
      });

      // Fallback timeout - if ready event never fires, still allow interaction
      setTimeout(() => {
        if (attempt === mountAttemptRef.current && loading) {
          console.log('[SpotMe Checkout] Fallback: marking as ready after timeout');
          setStripeReady(true);
          setElementMounted(true);
          setLoading(false);
        }
      }, 8000);

    } catch (err: any) {
      if (attempt === mountAttemptRef.current) {
        if (err.name === 'SecurityError' || (err.message && err.message.includes('insecure'))) {
          if (isInIframe()) {
            setError('Payment forms cannot load in preview mode. Please open this page in a new browser tab.');
          } else {
            setError('Your browser blocked the payment form. Please try: 1) Disable content blockers, 2) Allow third-party cookies, or 3) Use a different browser.');
          }
        } else {
          setError(err.message || 'Failed to load payment form.');
        }
        setLoading(false);
      }
    }
  }, [params.clientSecret, params.stripeAccount, isInIframe]);


  useEffect(() => {
    if (params.clientSecret) loadAndMountStripe();
  }, [params.clientSecret]);

  // ================================================================
  // SUBMIT PAYMENT
  // ================================================================
  const handleSubmit = async () => {
    if (!stripeRef.current || !elementsRef.current || processing) return;

    // If payment was EVER submitted, check status instead
    if (paymentEverSubmittedRef.current) {
      console.log('[SpotMe Checkout] Payment was already submitted. Checking status instead...');
      handleCheckStatus();
      return;
    }

    paymentEverSubmittedRef.current = true;
    setProcessing(true);
    setError('');

    try {
      // Build return URL
      const returnParams = new URLSearchParams({
        payment_id: params.paymentId || '',
      });
      if (params.amount && params.amount !== '0') returnParams.set('amount', params.amount);
      if (params.tipAmount && params.tipAmount !== '0') returnParams.set('tip_amount', params.tipAmount);
      if (params.needTitle) returnParams.set('need_title', params.needTitle);
      if (params.stripeAccount) returnParams.set('stripe_account', params.stripeAccount);
      const returnUrl = `${window.location.origin}/payment-success?${returnParams.toString()}`;

      console.log('[SpotMe Checkout] Confirming payment with redirect: if_required...');

      const result = await stripeRef.current.confirmPayment({
        elements: elementsRef.current,
        redirect: 'if_required',
        confirmParams: {
          return_url: returnUrl,
        },
      });

      // Handle inline result
      if (result.error) {
        console.error('[SpotMe Checkout] confirmPayment error:', result.error);

        // Card/validation errors - safe to retry
        if (result.error.type === 'card_error' || result.error.type === 'validation_error') {
          paymentEverSubmittedRef.current = false;
          setError(result.error.message || 'Your card was declined. Please try a different card.');
          setProcessing(false);
          return;
        }

        // For other errors, check server-side status
        console.log('[SpotMe Checkout] Non-card error. Checking if payment went through...');
        const actualStatus = await checkPaymentStatusServerSide();

        if (actualStatus === 'succeeded') {
          console.log('[SpotMe Checkout] Payment ACTUALLY SUCCEEDED despite client error!');
          setPaymentSucceeded(true);
          setError('');
          setProcessing(false);
          setTimeout(() => redirectToSuccess(), 1500);
          return;
        }

        if (actualStatus === 'failed') {
          paymentEverSubmittedRef.current = false;
          setError(result.error.message || 'Payment failed. Please try again.');
        } else {
          setError(
            'We could not confirm your payment status. Your card may have been charged. ' +
            'Please use the "Check Payment Status" button below before trying again.'
          );
        }
        setProcessing(false);
        return;
      }

      // Payment succeeded inline
      if (result.paymentIntent) {
        const piStatus = result.paymentIntent.status;
        console.log('[SpotMe Checkout] PaymentIntent status:', piStatus);

        if (piStatus === 'succeeded') {
          console.log('[SpotMe Checkout] Payment succeeded inline!');
          
          // Verify server-side
          try {
            await supabase.functions.invoke('stripe-checkout', {
              body: {
                action: 'verify_payment',
                paymentIntentId: result.paymentIntent.id,
                paymentId: params.paymentId || undefined,
                redirectStatus: 'succeeded',
              },
            });
          } catch (verifyErr) {
            console.warn('[SpotMe Checkout] Server verification call failed (non-critical):', verifyErr);
          }

          setPaymentSucceeded(true);
          setError('');
          setProcessing(false);
          setTimeout(() => redirectToSuccess(), 1200);
          return;
        }

        if (piStatus === 'requires_action' || piStatus === 'processing') {
          console.log('[SpotMe Checkout] Payment requires action or processing...');
          setError('Payment is being processed. Please wait...');
          setProcessing(false);
          
          // Auto-check status after a delay
          setTimeout(async () => {
            const status = await checkPaymentStatusServerSide();
            if (status === 'succeeded') {
              setPaymentSucceeded(true);
              setError('');
              setTimeout(() => redirectToSuccess(), 1200);
            } else if (status === 'failed') {
              paymentEverSubmittedRef.current = false;
              setError('Payment was not completed. You can safely try again.');
            } else {
              setError('Payment is still processing. Please check the status.');
            }
          }, 3000);
          return;
        }

        // Unexpected status
        console.warn('[SpotMe Checkout] Unexpected PI status:', piStatus);
        setError('Payment status unclear. Please check the status below.');
        setProcessing(false);
        return;
      }

      console.log('[SpotMe Checkout] No error and no paymentIntent - redirect may have occurred.');
      
    } catch (err: any) {
      console.error('[SpotMe Checkout] Payment exception:', err);

      // SecurityError handling
      if (err.name === 'SecurityError' || (err.message && err.message.includes('insecure'))) {
        console.log('[SpotMe Checkout] SecurityError caught. Checking payment status...');
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const actualStatus = await checkPaymentStatusServerSide();
        if (actualStatus === 'succeeded') {
          setPaymentSucceeded(true);
          setError('');
          setProcessing(false);
          setTimeout(() => redirectToSuccess(), 1200);
          return;
        }
        
        if (actualStatus === 'failed') {
          paymentEverSubmittedRef.current = false;
          setError('Payment was not completed. Your card was NOT charged. You can safely try again.');
          setProcessing(false);
          return;
        }
        
        setError(
          'Your browser blocked the payment confirmation. Your card may have been charged. ' +
          'Please tap "Check Payment Status" below to verify.'
        );
        setProcessing(false);
        return;
      }

      // Non-SecurityError exception
      const actualStatus = await checkPaymentStatusServerSide();
      if (actualStatus === 'succeeded') {
        setPaymentSucceeded(true);
        setError('');
        setProcessing(false);
        setTimeout(() => redirectToSuccess(), 1200);
        return;
      }
      if (actualStatus === 'failed') {
        paymentEverSubmittedRef.current = false;
        setError(err.message || 'Payment failed. Please try again.');
      } else {
        setError(
          'We could not confirm your payment status. ' +
          'Please use the "Check Payment Status" button below before trying again.'
        );
      }
      setProcessing(false);
    }
  };


  const handleRetry = () => {
    setError('');
    setLoadRetries(prev => prev + 1);
    loadAndMountStripe();
  };

  // Auto-retry loading once if it fails
  useEffect(() => {
    if (error && !elementMounted && loadRetries === 0 && params.clientSecret && !paymentEverSubmittedRef.current) {
      const timer = setTimeout(() => {
        console.log('[SpotMe Checkout] Auto-retrying Stripe load...');
        handleRetry();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [error, elementMounted, loadRetries, params.clientSecret]);

  const topPadding = Platform.OS === 'web' ? 16 : insets.top;
  const amount = parseFloat(params.amount) || 0;
  const tipAmount = parseFloat(params.tipAmount) || parseFloat(params.applicationFee) || 0;
  // Fix: recipientReceives should be the contribution amount (what the recipient gets)
  const recipientGets = parseFloat(params.recipientReceives) > 0 ? parseFloat(params.recipientReceives) : amount;
  const totalCharge = Math.round((amount + tipAmount) * 100) / 100;
  const isDestinationCharge = params.destinationCharge === 'true';

  // CRITICAL FIX: Submit button should be enabled when:
  // 1. Stripe is ready (form loaded)
  // 2. Not currently processing
  // 3. Not checking status
  // 4. Error should NOT block submission if the form is loaded and user can interact
  const canSubmit = stripeReady && !processing && !checkingStatus && !paymentSucceeded;
  // Only block if there's a critical error (form didn't load at all)
  const hasCriticalError = error && !elementMounted;

  // If payment succeeded, show success
  if (paymentSucceeded) {
    return (
      <View style={[styles.container, { paddingTop: topPadding }]}>
        <View style={styles.successOverlay}>
          <View style={styles.successCircle}>
            <MaterialIcons name="check-circle" size={64} color={Colors.success} />
          </View>
          <Text style={styles.successTitle}>Payment Successful!</Text>
          <Text style={styles.successSub}>
            Your ${amount.toFixed(2)} contribution went through. Redirecting...
          </Text>
          <ActivityIndicator size="small" color={Colors.primary} style={{ marginTop: 16 }} />
        </View>
      </View>
    );
  }

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

          {tipAmount > 0 && (
            <View style={styles.summaryRow}>
              <View style={styles.tipRow}>
                <MaterialIcons name="favorite" size={12} color={Colors.primary} />
                <Text style={[styles.summaryLabel, { color: Colors.primary }]}>SpotMe tip</Text>
              </View>
              <Text style={[styles.summaryValue, { color: Colors.primary }]}>${tipAmount.toFixed(2)}</Text>
            </View>
          )}

          <View style={[styles.summaryRow, styles.summaryTotal]}>
            <Text style={styles.totalLabel}>Total charge</Text>
            <Text style={styles.totalValue}>${totalCharge.toFixed(2)}</Text>
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
              <Text style={styles.connectBadgeText}>Funds go directly to the recipient via Stripe Connect</Text>
            </View>
          )}

          {!isDestinationCharge && (
            <View style={styles.platformBadge}>
              <MaterialIcons name="account-balance" size={16} color={Colors.accent} />
              <Text style={styles.platformBadgeText}>Funds held by SpotMe until recipient sets up payouts</Text>
            </View>
          )}
        </View>

        {/* Stripe Payment Element Container */}
        <View style={styles.paymentFormCard}>
          <Text style={styles.paymentFormTitle}>Payment Details</Text>

          {loading && !error && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={styles.loadingText}>Loading secure payment form...</Text>
              <Text style={styles.loadingSubtext}>This may take a few seconds</Text>
            </View>
          )}

          {/* This div is where Stripe Elements mounts */}
          {Platform.OS === 'web' && (
            <View style={styles.stripeContainer}>
              <div
                id="stripe-payment-element"
                style={{
                  minHeight: loading && !elementMounted ? 0 : 250,
                  opacity: loading && !elementMounted ? 0 : 1,
                  transition: 'opacity 0.3s ease, min-height 0.3s ease',
                }}
              />
            </View>
          )}

          {/* Error display with CHECK STATUS button */}
          {error ? (
            <View style={styles.errorContainer}>
              <View style={styles.errorBanner}>
                <MaterialIcons name="error-outline" size={20} color={Colors.error} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
              
              {/* Check Payment Status button */}
              {paymentEverSubmittedRef.current && (
                <TouchableOpacity
                  style={styles.checkStatusButton}
                  onPress={handleCheckStatus}
                  activeOpacity={0.7}
                  disabled={checkingStatus}
                >
                  {checkingStatus ? (
                    <ActivityIndicator size="small" color={Colors.success} />
                  ) : (
                    <MaterialIcons name="verified" size={18} color={Colors.success} />
                  )}
                  <Text style={styles.checkStatusText}>
                    {checkingStatus ? 'Checking...' : 'Check Payment Status'}
                  </Text>
                </TouchableOpacity>
              )}

              <View style={styles.errorActions}>
                {!paymentEverSubmittedRef.current && (
                  <TouchableOpacity
                    style={styles.retryButton}
                    onPress={handleRetry}
                    activeOpacity={0.7}
                  >
                    <MaterialIcons name="refresh" size={18} color={Colors.primary} />
                    <Text style={styles.retryButtonText}>Reload Payment Form</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={styles.goBackButton}
                  onPress={() => router.back()}
                  activeOpacity={0.7}
                >
                  <MaterialIcons name="arrow-back" size={16} color={Colors.textSecondary} />
                  <Text style={styles.goBackButtonText}>Go Back</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}
        </View>

        {/* Submit Button - FIXED: only disable for critical errors, not form validation errors */}
        <TouchableOpacity
          style={[
            styles.payButton,
            (!canSubmit || hasCriticalError) && styles.payButtonDisabled,
          ]}
          onPress={handleSubmit}
          activeOpacity={0.8}
          disabled={!canSubmit || !!hasCriticalError}
        >
          {processing || checkingStatus ? (
            <ActivityIndicator size="small" color={Colors.white} />
          ) : (
            <MaterialIcons name="lock" size={20} color={Colors.white} />
          )}
          <Text style={styles.payButtonText}>
            {processing ? 'Processing...' : checkingStatus ? 'Checking Status...' : `Pay $${totalCharge.toFixed(2)}`}
          </Text>
        </TouchableOpacity>

        {/* Warning if payment was submitted */}
        {paymentEverSubmittedRef.current && !processing && !paymentSucceeded && (
          <View style={styles.warningBanner}>
            <MaterialIcons name="info" size={18} color={Colors.accent} />
            <Text style={styles.warningText}>
              A payment attempt was already made. Please check the status before trying again to avoid being charged twice.
            </Text>
          </View>
        )}

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
            <Text style={styles.securityText}>Powered by Stripe</Text>
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
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.borderLight, backgroundColor: Colors.surface,
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
  tipRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  summaryTotal: {
    borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.sm, marginTop: Spacing.xs,
  },
  totalLabel: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text },
  totalValue: { fontSize: FontSize.md, fontWeight: '800', color: Colors.text },
  summaryHighlight: { paddingTop: Spacing.xs, marginTop: Spacing.xs },
  recipientRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  recipientLabel: { fontSize: FontSize.md, fontWeight: '700', color: Colors.success },
  recipientValue: { fontSize: FontSize.md, fontWeight: '800', color: Colors.success },
  connectBadge: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.secondaryLight, padding: Spacing.md, borderRadius: BorderRadius.lg, marginTop: Spacing.sm,
  },
  connectBadgeText: { flex: 1, fontSize: FontSize.xs, color: Colors.secondaryDark, fontWeight: '600', lineHeight: 16 },
  platformBadge: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.accentLight, padding: Spacing.md, borderRadius: BorderRadius.lg, marginTop: Spacing.sm,
  },
  platformBadgeText: { flex: 1, fontSize: FontSize.xs, color: '#8B7000', fontWeight: '600', lineHeight: 16 },
  paymentFormCard: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.xl,
    padding: Spacing.xl, marginBottom: Spacing.lg, ...Shadow.sm,
  },
  paymentFormTitle: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.text, marginBottom: Spacing.lg },
  loadingContainer: { alignItems: 'center', paddingVertical: Spacing.huge, gap: Spacing.sm },
  loadingText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '600' },
  loadingSubtext: { fontSize: FontSize.xs, color: Colors.textLight },
  stripeContainer: { minHeight: 50 },
  errorContainer: { gap: Spacing.md, marginTop: Spacing.sm },
  errorBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm,
    backgroundColor: '#FFF0F0', padding: Spacing.md, borderRadius: BorderRadius.lg,
  },
  errorText: { flex: 1, fontSize: FontSize.sm, color: Colors.error, fontWeight: '600', lineHeight: 20 },
  checkStatusButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
    backgroundColor: '#E8F5E8', paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.lg, borderWidth: 2, borderColor: Colors.success + '40',
  },
  checkStatusText: { fontSize: FontSize.md, fontWeight: '800', color: Colors.success },
  errorActions: { flexDirection: 'row', gap: Spacing.sm },
  retryButton: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs,
    backgroundColor: Colors.primaryLight, paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: Colors.primary + '30',
  },
  retryButtonText: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.primary },
  goBackButton: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs,
    backgroundColor: Colors.surfaceAlt, paddingVertical: Spacing.md, borderRadius: BorderRadius.lg,
  },
  goBackButtonText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textSecondary },
  payButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
    backgroundColor: Colors.primary, paddingVertical: Spacing.lg + 2,
    borderRadius: BorderRadius.xl, marginBottom: Spacing.lg, ...Shadow.md,
  },
  payButtonDisabled: { opacity: 0.5 },
  payButtonText: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.white },
  warningBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm,
    backgroundColor: Colors.accentLight, padding: Spacing.md, borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg, borderWidth: 1, borderColor: Colors.accent + '30',
  },
  warningText: { flex: 1, fontSize: FontSize.sm, color: '#8B7000', fontWeight: '600', lineHeight: 20 },
  securityFooter: { alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.lg },
  securityRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  securityText: { fontSize: FontSize.xs, color: Colors.textLight },
  successOverlay: {
    flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xxl, gap: Spacing.md,
  },
  successCircle: { marginBottom: Spacing.md },
  successTitle: { fontSize: FontSize.xxl, fontWeight: '900', color: Colors.text },
  successSub: { fontSize: FontSize.md, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },
});
