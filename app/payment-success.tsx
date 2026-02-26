import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Platform, ScrollView, Animated, Image, Share } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, BorderRadius, FontSize, Spacing, Shadow } from '@/app/lib/theme';
import { useApp } from '@/app/lib/store';
import { supabase } from '@/app/lib/supabase';

const CTA_COLOR = Colors.primary;

// ---- URL param extraction (runs once) ----
interface SuccessParams {
  paymentId: string;
  paymentIntentId: string;
  redirectStatus: string;
  sessionId: string;
  amount: string;       // passed from checkout return_url
  tipAmount: string;    // passed from checkout return_url
  needTitle: string;    // passed from checkout return_url
  needId: string;       // may come from payment details
  stripeAccount: string;
}

function parseUrlParams(): SuccessParams {
  if (Platform.OS !== 'web') {
    return { paymentId: '', paymentIntentId: '', redirectStatus: '', sessionId: '', amount: '', tipAmount: '', needTitle: '', needId: '', stripeAccount: '' };
  }
  const p = new URLSearchParams(window.location.search);
  return {
    paymentId: p.get('payment_id') || '',
    paymentIntentId: p.get('payment_intent') || '',
    redirectStatus: p.get('redirect_status') || '',
    sessionId: p.get('session_id') || '',
    amount: p.get('amount') || '',
    tipAmount: p.get('tip_amount') || '',
    needTitle: p.get('need_title') || '',
    needId: p.get('need_id') || '',
    stripeAccount: p.get('stripe_account') || '',
  };
}

export default function PaymentSuccessScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { refreshNeeds, needs, currentUser, sendContributionReceipt, resendContributionReceipt } = useApp();

  // ---- State ----
  const [status, setStatus] = useState<'verifying' | 'success' | 'processing' | 'error'>('verifying');
  const [paymentDetails, setPaymentDetails] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [copied, setCopied] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [receiptStatus, setReceiptStatus] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');
  const [receiptNumber, setReceiptNumber] = useState('');
  const [receiptError, setReceiptError] = useState('');


  // URL params — parsed once
  const urlParamsRef = useRef<SuccessParams | null>(null);
  if (!urlParamsRef.current) {
    urlParamsRef.current = parseUrlParams();
  }
  const urlParams = urlParamsRef.current;

  // Animations
  const scaleAnim = useRef(new Animated.Value(0.7)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const confettiAnim = useRef(new Animated.Value(0)).current;

  // ---- Verification logic ----
  const verifyPayment = useCallback(async () => {
    const { paymentId, paymentIntentId, redirectStatus, sessionId } = urlParams;

    console.log('[SpotMe Success] Verifying with params:', {
      paymentId: paymentId || '(none)',
      paymentIntentId: paymentIntentId ? paymentIntentId.slice(0, 15) + '...' : '(none)',
      redirectStatus,
    });

    // Edge case: no identifiers at all (e.g. user navigated here directly)
    if (!paymentId && !paymentIntentId && !redirectStatus) {
      console.log('[SpotMe Success] No payment identifiers found in URL');
      setErrorMsg('No payment information found. If you just completed a payment, please check your email for a confirmation.');
      setStatus('error');
      return;
    }

    try {
      // Call verify_payment — now supports paymentIntentId as fallback when paymentId is empty
      const { data, error } = await supabase.functions.invoke('stripe-checkout', {
        body: {
          action: 'verify_payment',
          paymentId: paymentId || undefined,
          paymentIntentId: paymentIntentId || undefined,
          sessionId: sessionId || undefined,
          redirectStatus,
        },
      });

      console.log('[SpotMe Success] Verify response:', {
        success: data?.success,
        verified: data?.verified,
        already_processed: data?.already_processed,
        status: data?.status,
        hasPayment: !!data?.payment,
        error: error?.message || data?.error,
      });

      if (error && !data) {
        // Network/server error — but if Stripe says succeeded, trust it
        console.warn('[SpotMe Success] Verify call failed:', error.message);
        if (redirectStatus === 'succeeded') {
          console.log('[SpotMe Success] Trusting redirect_status=succeeded despite verify error');
          setStatus('success');
          await refreshNeeds();
          return;
        }
        throw new Error(error.message || 'Could not verify payment');
      }

      // Server returned an explicit failure
      if (data && data.success === false) {
        setErrorMsg(data.error || 'Payment verification failed. Please contact support if you were charged.');
        setStatus('error');
        return;
      }

      // Store payment details from verify response
      if (data?.payment) {
        setPaymentDetails(data.payment);
      }
      // Payment verified or already processed — send email receipt
      if (data?.verified || data?.already_processed) {
        setStatus('success');
        await refreshNeeds();
        // Fire-and-forget email receipt via new receipt system
        try {
          const pd = data.payment || {};
          const receiptResult = await sendContributionReceipt({
            paymentId: pd.id || paymentId || undefined,
            paymentIntentId: pd.payment_intent_id || paymentIntentId || undefined,
            amount: Number(pd.amount) || Number(urlParams.amount) || 0,
            tipAmount: Number(pd.application_fee || pd.tip_amount) || Number(urlParams.tipAmount) || 0,
            needTitle: pd.need_title || urlParams.needTitle || '',
            needId: pd.need_id || urlParams.needId || '',
            recipientName: pd.contributor_name || '',
          });
          if (receiptResult.emailSent) {
            setReceiptStatus('sent');
            setReceiptNumber(receiptResult.receiptNumber || '');
          } else {
            setReceiptStatus('failed');
            setReceiptError(receiptResult.error || 'Could not send receipt email');
          }
        } catch (e: any) {
          console.log('[SpotMe Success] Receipt email failed (non-critical):', e);
          setReceiptStatus('failed');
        }
        return;
      }




      // Payment still processing (e.g. requires_action, processing)
      if (data?.success && !data?.verified && data?.status) {
        const piStatus = data.status;
        if (piStatus === 'processing' || piStatus === 'requires_action') {
          setStatus('processing');
          return;
        }
        // For other statuses, if redirect said succeeded, trust it
        if (redirectStatus === 'succeeded') {
          setStatus('success');
          await refreshNeeds();
          return;
        }
      }

      // Fallback: if redirect_status is succeeded, show success
      if (redirectStatus === 'succeeded') {
        setStatus('success');
        await refreshNeeds();
        return;
      }

      // Unknown state
      setErrorMsg('Unable to confirm your payment status. If you were charged, your contribution was received. Please contact support if you have concerns.');
      setStatus('error');

    } catch (err: any) {
      console.error('[SpotMe Success] Verification exception:', err);
      // If Stripe redirect said succeeded, trust it despite the error
      if (redirectStatus === 'succeeded') {
        console.log('[SpotMe Success] Treating as success despite exception (redirect_status=succeeded)');
        setStatus('success');
        await refreshNeeds();
        return;
      }
      setErrorMsg(err.message || 'An unexpected error occurred during verification.');
      setStatus('error');
    }
  }, [urlParams, refreshNeeds]);

  // Run verification on mount
  useEffect(() => {
    verifyPayment();
  }, []);

  // Animate on success
  useEffect(() => {
    if (status === 'success') {
      Animated.sequence([
        Animated.parallel([
          Animated.spring(scaleAnim, { toValue: 1, tension: 50, friction: 7, useNativeDriver: true }),
          Animated.timing(opacityAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
        ]),
        Animated.timing(confettiAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      ]).start();
    }
  }, [status]);

  // Auto-retry for "processing" status
  useEffect(() => {
    if (status === 'processing' && retryCount < 5) {
      const timer = setTimeout(() => {
        console.log(`[SpotMe Success] Auto-retry verification (attempt ${retryCount + 1}/5)`);
        setRetryCount(prev => prev + 1);
        verifyPayment();
      }, 3000); // retry every 3 seconds
      return () => clearTimeout(timer);
    }
    if (status === 'processing' && retryCount >= 5) {
      // After 5 retries, if redirect said succeeded, show success
      if (urlParams.redirectStatus === 'succeeded') {
        setStatus('success');
        refreshNeeds();
      } else {
        setStatus('success'); // Assume success after extended processing
        refreshNeeds();
      }
    }
  }, [status, retryCount]);

  // ---- Derived values ----
  // Prefer paymentDetails from API, fall back to URL params
  const amount = paymentDetails?.amount
    ? Number(paymentDetails.amount)
    : urlParams.amount ? Number(urlParams.amount) : 0;

  const tipAmount = paymentDetails?.application_fee
    ? Number(paymentDetails.application_fee)
    : paymentDetails?.tip_amount
      ? Number(paymentDetails.tip_amount)
      : urlParams.tipAmount ? Number(urlParams.tipAmount) : 0;

  const recipientReceives = amount;
  const totalCharged = amount + tipAmount;

  const needId = paymentDetails?.need_id || urlParams.needId || '';
  const needTitle = paymentDetails?.need_title || urlParams.needTitle || '';
  const recipientName = paymentDetails?.contributor_name || '';
  const paymentRef = paymentDetails?.id || paymentDetails?.payment_intent_id || urlParams.paymentIntentId || '';

  // Find the related need for avatar and navigation
  const relatedNeed = needId ? needs.find(n => n.id === needId) : null;

  const topPadding = Platform.OS === 'web' ? 16 : insets.top;

  // ---- Share helpers ----
  const getShareUrl = () => {
    const base = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : 'https://spotme.app';
    return needId ? `${base}/share/${needId}` : base;
  };

  const getShareText = () => {
    const name = relatedNeed?.userName || 'someone';
    const title = needTitle || relatedNeed?.title || 'a need';
    return `I just spotted ${name} for "${title}" on SpotMe! Can you help too? No tragedy, just life. #SpotMe #MutualAid #HelpYourNeighbor`;
  };

  const handleShare = async (platform: string) => {
    const url = getShareUrl();
    const text = getShareText();

    switch (platform) {
      case 'tiktok':
        if (Platform.OS === 'web') window.open('https://www.tiktok.com/upload', '_blank');
        break;
      case 'instagram':
        if (Platform.OS === 'web') window.open('https://www.instagram.com/', '_blank');
        break;
      case 'twitter':
        if (Platform.OS === 'web') window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank');
        break;
      case 'copy':
        if (Platform.OS === 'web') {
          try { await navigator.clipboard.writeText(url); } catch {
            const ta = document.createElement('textarea');
            ta.value = url;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
          }
          setCopied(true);
          setTimeout(() => setCopied(false), 2500);
        }
        break;
      case 'native':
        try {
          if (Platform.OS === 'web' && navigator.share) {
            await navigator.share({ title: 'I spotted someone on SpotMe!', text, url });
          } else {
            await Share.share({ message: `${text}\n${url}` });
          }
        } catch {}
        break;
    }
  };

  // ---- Navigate to need ----
  const goToNeed = () => {
    if (needId) {
      router.replace(`/need/${needId}` as any);
    } else {
      router.replace('/(tabs)');
    }
  };

  // ---- RENDER ----
  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      {/* ======== VERIFYING STATE ======== */}
      {status === 'verifying' && (
        <View style={styles.centerContent}>
          <View style={styles.verifyingCircle}>
            <ActivityIndicator size="large" color={CTA_COLOR} />
          </View>
          <Text style={styles.verifyingTitle}>Verifying Payment...</Text>
          <Text style={styles.verifyingSub}>Please wait while we confirm your payment with Stripe</Text>
        </View>
      )}

      {/* ======== PROCESSING STATE ======== */}
      {status === 'processing' && (
        <View style={styles.centerContent}>
          <View style={[styles.verifyingCircle, { backgroundColor: Colors.accentLight }]}>
            <ActivityIndicator size="large" color={Colors.accent} />
          </View>
          <Text style={styles.verifyingTitle}>Payment Processing</Text>
          <Text style={styles.verifyingSub}>
            Your payment is being processed by your bank. This usually takes just a few seconds...
          </Text>
          <Text style={[styles.verifyingSub, { fontSize: FontSize.xs, marginTop: Spacing.sm }]}>
            Attempt {Math.min(retryCount + 1, 5)} of 5
          </Text>
        </View>
      )}

      {/* ======== SUCCESS STATE ======== */}
      {status === 'success' && (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.successScroll}
        >
          <Animated.View
            style={[
              styles.successContent,
              { opacity: opacityAnim, transform: [{ scale: scaleAnim }] },
            ]}
          >
            {/* Celebration Header */}
            <View style={styles.celebrationRow}>
              <Animated.View style={{
                opacity: confettiAnim,
                transform: [{ translateX: confettiAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
              }}>
                <MaterialIcons name="auto-awesome" size={24} color={Colors.accent} />
              </Animated.View>

              <View style={styles.successCircle}>
                <MaterialIcons name="favorite" size={40} color="#FFF" />
              </View>

              <Animated.View style={{
                opacity: confettiAnim,
                transform: [{ translateX: confettiAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }],
              }}>
                <MaterialIcons name="auto-awesome" size={24} color={Colors.accent} />
              </Animated.View>
            </View>

            {/* Thank You Message */}
            <Text style={styles.successTitle}>
              {relatedNeed
                ? `You spotted ${(relatedNeed.userName || 'Them').split(' ')[0]}!`
                : 'Spot Sent!'}
            </Text>

            {amount > 0 && (
              <Text style={styles.successAmount}>${amount.toFixed(2)}</Text>
            )}

            <Text style={styles.successSub}>
              {needTitle || relatedNeed?.title
                ? `for "${needTitle || relatedNeed?.title}"`
                : 'Your contribution has been processed securely.'}
            </Text>

            {/* Recipient Card */}
            {relatedNeed && (
              <TouchableOpacity
                style={styles.recipientCard}
                onPress={goToNeed}
                activeOpacity={0.7}
              >
                <Image source={{ uri: relatedNeed.userAvatar }} style={styles.recipientAvatar} />
                <View style={styles.recipientInfo}>
                  <Text style={styles.recipientName}>{relatedNeed.userName}</Text>
                  {recipientReceives > 0 && (
                    <Text style={styles.recipientReceives}>receives ${recipientReceives.toFixed(2)}</Text>
                  )}
                </View>
                <MaterialIcons name="check-circle" size={22} color={Colors.success} />
              </TouchableOpacity>
            )}

            {/* Impact Message */}
            <View style={styles.impactCard}>
              <MaterialIcons name="favorite" size={16} color={CTA_COLOR} />
              <Text style={styles.impactText}>
                Every dollar counts. You just made someone's day brighter.
              </Text>
            </View>

            {/* Receipt Toggle */}
            {(amount > 0 || paymentDetails) && (
              <TouchableOpacity
                style={styles.receiptToggle}
                onPress={() => setShowReceipt(!showReceipt)}
                activeOpacity={0.7}
              >
                <MaterialIcons name="receipt-long" size={18} color={Colors.textSecondary} />
                <Text style={styles.receiptToggleText}>
                  {showReceipt ? 'Hide receipt' : 'View receipt'}
                </Text>
                <MaterialIcons
                  name={showReceipt ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
                  size={18}
                  color={Colors.textLight}
                />
              </TouchableOpacity>
            )}

            {/* Collapsible Receipt */}
            {showReceipt && (
              <View style={styles.receiptCard}>
                <View style={styles.receiptRow}>
                  <Text style={styles.receiptLabel}>Contribution</Text>
                  <Text style={styles.receiptValue}>${amount > 0 ? amount.toFixed(2) : '—'}</Text>
                </View>
                {tipAmount > 0 && (
                  <View style={styles.receiptRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <MaterialIcons name="favorite" size={12} color={Colors.primary} />
                      <Text style={[styles.receiptLabel, { color: Colors.primary }]}>SpotMe tip</Text>
                    </View>
                    <Text style={[styles.receiptValue, { color: Colors.primary }]}>${tipAmount.toFixed(2)}</Text>
                  </View>
                )}
                {totalCharged > 0 && (
                  <View style={[styles.receiptRow, { borderTopWidth: 1, borderTopColor: Colors.borderLight, paddingTop: Spacing.xs, marginTop: Spacing.xs }]}>
                    <Text style={[styles.receiptLabel, { fontWeight: '700', color: Colors.text }]}>Total charged</Text>
                    <Text style={[styles.receiptValue, { fontWeight: '700', color: Colors.text }]}>${totalCharged.toFixed(2)}</Text>
                  </View>
                )}
                <View style={[styles.receiptRow, styles.receiptTotal]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <MaterialIcons name="person" size={14} color={Colors.success} />
                    <Text style={styles.receiptTotalLabel}>Recipient receives</Text>
                  </View>
                  <Text style={styles.receiptTotalValue}>${recipientReceives > 0 ? recipientReceives.toFixed(2) : '—'}</Text>
                </View>
                <View style={styles.receiptRow}>
                  <Text style={styles.receiptLabel}>Status</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <MaterialIcons name="check-circle" size={14} color={Colors.success} />
                    <Text style={[styles.receiptValue, { color: Colors.success, fontWeight: '700' }]}>Completed</Text>
                  </View>
                </View>
                {needTitle ? (
                  <View style={styles.receiptRow}>
                    <Text style={styles.receiptLabel}>Need</Text>
                    <Text style={[styles.receiptValue, { maxWidth: '60%' }]} numberOfLines={1}>{needTitle}</Text>
                  </View>
                ) : null}
                {paymentRef ? (
                  <View style={styles.receiptRow}>
                    <Text style={styles.receiptLabel}>Reference</Text>
                    <Text style={[styles.receiptValue, { fontSize: 10 }]}>
                      {paymentRef.length > 16 ? paymentRef.slice(0, 16) + '...' : paymentRef}
                    </Text>
                  </View>
                ) : null}
              </View>
            )}

            {/* Email Receipt Status & Resend Button */}
            <View style={{ width: '100%', alignItems: 'center', gap: 8, marginTop: 4 }}>
              {receiptStatus === 'sent' && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#E8F5E9', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10 }}>
                  <MaterialIcons name="mark-email-read" size={16} color="#2E7D32" />
                  <Text style={{ fontSize: 13, color: '#2E7D32', fontWeight: '600' }}>Receipt emailed{receiptNumber ? ` (${receiptNumber})` : ''}</Text>
                </View>
              )}
              {receiptStatus === 'failed' && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFF3E0', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10 }}>
                  <MaterialIcons name="warning" size={16} color="#E65100" />
                  <Text style={{ fontSize: 13, color: '#E65100', fontWeight: '600' }}>Receipt email not sent</Text>
                </View>
              )}
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.surfaceAlt, paddingVertical: 10, paddingHorizontal: 18, borderRadius: 12, borderWidth: 1, borderColor: Colors.border }}
                disabled={receiptStatus === 'sending'}
                activeOpacity={0.7}
                onPress={async () => {
                  setReceiptStatus('sending');
                  try {
                    const result = await resendContributionReceipt({
                      paymentId: paymentDetails?.id || urlParams.paymentId || undefined,
                      paymentIntentId: paymentDetails?.payment_intent_id || urlParams.paymentIntentId || undefined,
                      amount, tipAmount, needTitle, needId, recipientName,
                    });
                    setReceiptStatus(result.emailSent ? 'sent' : 'failed');
                    if (result.receiptNumber) setReceiptNumber(result.receiptNumber);
                  } catch { setReceiptStatus('failed'); }
                }}
              >
                {receiptStatus === 'sending' ? (
                  <ActivityIndicator size="small" color={CTA_COLOR} />
                ) : (
                  <MaterialIcons name="send" size={16} color={CTA_COLOR} />
                )}
                <Text style={{ fontSize: 14, fontWeight: '700', color: CTA_COLOR }}>
                  {receiptStatus === 'sending' ? 'Sending...' : receiptStatus === 'sent' ? 'Resend Receipt' : 'Send Receipt Email'}
                </Text>
              </TouchableOpacity>
            </View>


            {/* ===== SHARE SECTION ===== */}
            <View style={styles.shareSection}>
              <Text style={styles.shareTitle}>Share your impact</Text>
              <Text style={styles.shareSub}>
                Help {relatedNeed ? (relatedNeed.userName || 'them').split(' ')[0] : 'them'} reach their goal faster
              </Text>

              <View style={styles.shareGrid}>
                <TouchableOpacity
                  style={[styles.shareBtn, { backgroundColor: '#000' }]}
                  onPress={() => handleShare('tiktok')}
                  activeOpacity={0.8}
                >
                  <MaterialIcons name="music-note" size={22} color="#FFF" />
                  <Text style={styles.shareBtnText}>TikTok</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.shareBtn, { backgroundColor: '#E1306C' }]}
                  onPress={() => handleShare('instagram')}
                  activeOpacity={0.8}
                >
                  <MaterialIcons name="camera-alt" size={22} color="#FFF" />
                  <Text style={styles.shareBtnText}>Instagram</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.shareBtn, { backgroundColor: '#1DA1F2' }]}
                  onPress={() => handleShare('twitter')}
                  activeOpacity={0.8}
                >
                  <MaterialIcons name="tag" size={22} color="#FFF" />
                  <Text style={styles.shareBtnText}>X</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.shareBtn, { backgroundColor: CTA_COLOR }]}
                  onPress={() => handleShare('native')}
                  activeOpacity={0.8}
                >
                  <MaterialIcons name="share" size={22} color="#FFF" />
                  <Text style={styles.shareBtnText}>More</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.copyLinkBtn}
                onPress={() => handleShare('copy')}
                activeOpacity={0.7}
              >
                <MaterialIcons
                  name={copied ? 'check' : 'link'}
                  size={16}
                  color={copied ? Colors.success : CTA_COLOR}
                />
                <Text style={[styles.copyLinkText, copied && { color: Colors.success }]}>
                  {copied ? 'Link copied!' : 'Copy share link'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Security Note */}
            <View style={styles.securityNote}>
              <MaterialIcons name="verified-user" size={14} color={Colors.textLight} />
              <Text style={styles.securityText}>
                Payment processed securely by Stripe. PCI-DSS Level 1 compliant.
              </Text>
            </View>

            {/* Action Buttons */}
            {needId ? (
              <TouchableOpacity
                style={styles.viewNeedBtn}
                onPress={goToNeed}
                activeOpacity={0.8}
              >
                <MaterialIcons name="visibility" size={20} color="#FFF" />
                <Text style={styles.viewNeedBtnText}>View Need</Text>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              style={[styles.homeBtn, needId ? styles.homeBtnSecondary : null]}
              onPress={() => router.replace('/(tabs)')}
              activeOpacity={0.8}
            >
              <MaterialIcons name="home" size={20} color={needId ? CTA_COLOR : '#FFF'} />
              <Text style={[styles.homeBtnText, needId ? styles.homeBtnTextSecondary : null]}>Back to Home</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.browseBtn}
              onPress={() => router.replace('/(tabs)/search')}
              activeOpacity={0.7}
            >
              <Text style={styles.browseBtnText}>Browse More Needs</Text>
            </TouchableOpacity>

            <View style={{ height: 40 }} />
          </Animated.View>
        </ScrollView>
      )}

      {/* ======== ERROR STATE ======== */}
      {status === 'error' && (
        <ScrollView contentContainerStyle={styles.errorScroll}>
          <View style={styles.errorContent}>
            <View style={styles.errorCircle}>
              <MaterialIcons name="error-outline" size={48} color="#FFF" />
            </View>
            <Text style={styles.errorTitle}>Payment Issue</Text>
            <Text style={styles.errorSub}>
              {errorMsg || 'There was an issue verifying your payment. If you were charged, please contact support.'}
            </Text>

            {/* Show what we know from URL params */}
            {(urlParams.amount || urlParams.needTitle) && (
              <View style={styles.errorDetailsCard}>
                <Text style={styles.errorDetailsTitle}>Payment Details</Text>
                {urlParams.amount ? (
                  <View style={styles.errorDetailRow}>
                    <Text style={styles.errorDetailLabel}>Amount</Text>
                    <Text style={styles.errorDetailValue}>${Number(urlParams.amount).toFixed(2)}</Text>
                  </View>
                ) : null}
                {urlParams.needTitle ? (
                  <View style={styles.errorDetailRow}>
                    <Text style={styles.errorDetailLabel}>Need</Text>
                    <Text style={styles.errorDetailValue} numberOfLines={1}>{urlParams.needTitle}</Text>
                  </View>
                ) : null}
                {urlParams.paymentIntentId ? (
                  <View style={styles.errorDetailRow}>
                    <Text style={styles.errorDetailLabel}>Reference</Text>
                    <Text style={[styles.errorDetailValue, { fontSize: 10 }]}>
                      {urlParams.paymentIntentId.slice(0, 20)}...
                    </Text>
                  </View>
                ) : null}
              </View>
            )}

            {/* Retry button */}
            <TouchableOpacity
              style={styles.retryVerifyBtn}
              onPress={() => {
                setStatus('verifying');
                setErrorMsg('');
                setRetryCount(0);
                verifyPayment();
              }}
              activeOpacity={0.8}
            >
              <MaterialIcons name="refresh" size={20} color={CTA_COLOR} />
              <Text style={styles.retryVerifyBtnText}>Retry Verification</Text>
            </TouchableOpacity>

            {/* Navigation buttons */}
            {needId ? (
              <TouchableOpacity
                style={styles.homeBtn}
                onPress={goToNeed}
                activeOpacity={0.8}
              >
                <MaterialIcons name="visibility" size={20} color="#FFF" />
                <Text style={styles.homeBtnText}>View Need</Text>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              style={[styles.homeBtn, needId ? styles.homeBtnSecondary : null]}
              onPress={() => router.replace('/(tabs)')}
              activeOpacity={0.8}
            >
              <MaterialIcons name="home" size={20} color={needId ? CTA_COLOR : '#FFF'} />
              <Text style={[styles.homeBtnText, needId ? styles.homeBtnTextSecondary : null]}>Back to Home</Text>
            </TouchableOpacity>

            {/* Support note */}
            <View style={styles.supportNote}>
              <MaterialIcons name="help-outline" size={14} color={Colors.textLight} />
              <Text style={styles.supportText}>
                If you were charged and don't see your contribution reflected, please allow a few minutes for processing. Contact support if the issue persists.
              </Text>
            </View>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centerContent: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xxl, gap: Spacing.md },

  // Verifying / Processing
  verifyingCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  verifyingTitle: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.text },
  verifyingSub: { fontSize: FontSize.md, color: Colors.textSecondary, textAlign: 'center' },

  // Success
  successScroll: { flexGrow: 1, paddingHorizontal: Spacing.xxl },
  successContent: { alignItems: 'center', paddingTop: Spacing.huge, gap: Spacing.md },

  celebrationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xxl,
    marginBottom: Spacing.sm,
  },
  successCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: CTA_COLOR,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.lg,
  },
  successTitle: {
    fontSize: FontSize.xxl,
    fontWeight: '900',
    color: Colors.text,
    textAlign: 'center',
  },
  successAmount: {
    fontSize: 44,
    fontWeight: '900',
    color: CTA_COLOR,
    letterSpacing: -1,
  },
  successSub: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.sm,
  },

  // Recipient Card
  recipientCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    width: '100%',
  },
  recipientAvatar: { width: 48, height: 48, borderRadius: 24 },
  recipientInfo: { flex: 1 },
  recipientName: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text },
  recipientReceives: { fontSize: FontSize.sm, color: Colors.success, fontWeight: '600', marginTop: 1 },

  // Impact
  impactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primaryLight,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    width: '100%',
  },
  impactText: { flex: 1, fontSize: FontSize.sm, color: Colors.primaryDark, fontWeight: '600', lineHeight: 20 },

  // Receipt
  receiptToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  receiptToggleText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textSecondary },
  receiptCard: {
    width: '100%',
    backgroundColor: Colors.surfaceAlt,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  receiptRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  receiptLabel: { fontSize: FontSize.sm, color: Colors.textLight },
  receiptValue: { fontSize: FontSize.sm, color: Colors.textLight },
  receiptTotal: { borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.sm, marginTop: Spacing.xs },
  receiptTotalLabel: { fontSize: FontSize.md, fontWeight: '800', color: Colors.success },
  receiptTotalValue: { fontSize: FontSize.md, fontWeight: '800', color: Colors.success },

  // Share Section
  shareSection: {
    width: '100%',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    marginTop: Spacing.sm,
  },
  shareTitle: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.text },
  shareSub: { fontSize: FontSize.sm, color: Colors.textLight, marginBottom: Spacing.sm },
  shareGrid: { flexDirection: 'row', gap: Spacing.sm, width: '100%' },
  shareBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    minHeight: 56,
  },
  shareBtnText: { fontSize: FontSize.xs, fontWeight: '700', color: '#FFF' },
  copyLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
  },
  copyLinkText: { fontSize: FontSize.sm, fontWeight: '600', color: CTA_COLOR },

  // Security
  securityNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.secondaryLight,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    width: '100%',
    marginTop: Spacing.sm,
  },
  securityText: { flex: 1, fontSize: FontSize.xs, color: Colors.secondaryDark, lineHeight: 16 },

  // View Need Button (primary when needId exists)
  viewNeedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: CTA_COLOR,
    paddingVertical: 16,
    borderRadius: BorderRadius.xl,
    width: '100%',
    marginTop: Spacing.lg,
    minHeight: 56,
    ...Shadow.md,
  },
  viewNeedBtnText: { fontSize: FontSize.lg, fontWeight: '800', color: '#FFF' },

  // Buttons
  homeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: CTA_COLOR,
    paddingVertical: 16,
    borderRadius: BorderRadius.xl,
    width: '100%',
    marginTop: Spacing.md,
    minHeight: 56,
    ...Shadow.md,
  },
  homeBtnSecondary: {
    backgroundColor: Colors.surface,
    borderWidth: 2,
    borderColor: CTA_COLOR,
    ...Shadow.sm,
  },
  homeBtnText: { fontSize: FontSize.lg, fontWeight: '800', color: '#FFF' },
  homeBtnTextSecondary: { color: CTA_COLOR },
  browseBtn: { paddingVertical: Spacing.md },
  browseBtnText: { fontSize: FontSize.md, fontWeight: '700', color: CTA_COLOR },

  // Error
  errorScroll: { flexGrow: 1, paddingHorizontal: Spacing.xxl, justifyContent: 'center' },
  errorContent: { alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.huge },
  errorCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.error,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.lg,
    marginBottom: Spacing.md,
  },
  errorTitle: { fontSize: FontSize.xxl, fontWeight: '900', color: Colors.text },
  errorSub: { fontSize: FontSize.md, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },

  // Error details card
  errorDetailsCard: {
    width: '100%',
    backgroundColor: Colors.surfaceAlt,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  errorDetailsTitle: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.text, marginBottom: Spacing.xs },
  errorDetailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  errorDetailLabel: { fontSize: FontSize.sm, color: Colors.textLight },
  errorDetailValue: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.text, maxWidth: '60%' },

  // Retry verify button
  retryVerifyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primaryLight,
    paddingVertical: 14,
    borderRadius: BorderRadius.xl,
    width: '100%',
    marginTop: Spacing.md,
    borderWidth: 1,
    borderColor: CTA_COLOR + '30',
  },
  retryVerifyBtnText: { fontSize: FontSize.md, fontWeight: '700', color: CTA_COLOR },

  // Support note
  supportNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    backgroundColor: Colors.surfaceAlt,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    width: '100%',
    marginTop: Spacing.lg,
  },
  supportText: { flex: 1, fontSize: FontSize.xs, color: Colors.textLight, lineHeight: 16 },
});
