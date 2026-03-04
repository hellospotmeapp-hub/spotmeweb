import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Platform, TextInput } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, BorderRadius, FontSize, Spacing, Shadow } from '@/app/lib/theme';
import { supabase } from '@/app/lib/supabase';
import { useApp } from '@/app/lib/store';

// ============================================================
// TEST CARD NUMBERS
// ============================================================
const TEST_CARDS = [
  { number: '4242424242424242', label: 'Visa (Success)', icon: 'check-circle', color: Colors.success, description: 'Always succeeds' },
  { number: '4000000000003220', label: '3D Secure Required', icon: 'security', color: Colors.accent, description: 'Requires authentication' },
  { number: '4000000000009995', label: 'Insufficient Funds', icon: 'money-off', color: Colors.error, description: 'Decline: insufficient_funds' },
  { number: '4000000000000002', label: 'Generic Decline', icon: 'block', color: Colors.error, description: 'Decline: generic_decline' },
  { number: '4000000000000069', label: 'Expired Card', icon: 'event-busy', color: Colors.error, description: 'Decline: expired_card' },
  { number: '4000000000000127', label: 'Incorrect CVC', icon: 'vpn-key', color: Colors.error, description: 'Decline: incorrect_cvc' },
  { number: '4000000000000119', label: 'Processing Error', icon: 'error', color: Colors.error, description: 'Decline: processing_error' },
  { number: '5555555555554444', label: 'Mastercard (Success)', icon: 'check-circle', color: Colors.success, description: 'Always succeeds' },
];

// ============================================================
// TYPES
// ============================================================
interface TestStep {
  id: string;
  label: string;
  status: 'idle' | 'running' | 'success' | 'error' | 'warning';
  detail?: string;
  data?: any;
  duration?: number;
}

interface StripeConfig {
  hasStripeSecretKey: boolean;
  keySource: string;
  keyPrefix: string | null;
  isTestMode: boolean | null;
  isLiveMode: boolean | null;
  hasGatewayKey: boolean;
  mode: string;
}

// ============================================================
// SECTION COMPONENT
// ============================================================
function TestSection({ title, icon, children, collapsed, onToggle }: {
  title: string; icon: string; children: React.ReactNode;
  collapsed?: boolean; onToggle?: () => void;
}) {
  return (
    <View style={styles.section}>
      <TouchableOpacity style={styles.sectionHeader} onPress={onToggle} activeOpacity={0.7}>
        <View style={styles.sectionIcon}>
          <MaterialIcons name={icon as any} size={20} color={Colors.primary} />
        </View>
        <Text style={styles.sectionTitle}>{title}</Text>
        {onToggle && (
          <MaterialIcons name={collapsed ? 'expand-more' : 'expand-less'} size={24} color={Colors.textLight} />
        )}
      </TouchableOpacity>
      {!collapsed && <View style={styles.sectionContent}>{children}</View>}
    </View>
  );
}

// ============================================================
// STEP DISPLAY
// ============================================================
function StepDisplay({ step }: { step: TestStep }) {
  const iconMap: Record<string, { name: string; color: string }> = {
    idle: { name: 'radio-button-unchecked', color: Colors.textLight },
    running: { name: 'hourglass-empty', color: Colors.accent },
    success: { name: 'check-circle', color: Colors.success },
    error: { name: 'cancel', color: Colors.error },
    warning: { name: 'warning', color: Colors.accent },
  };
  const { name, color } = iconMap[step.status] || iconMap.idle;

  return (
    <View style={styles.stepRow}>
      <View style={styles.stepIconWrap}>
        {step.status === 'running' ? (
          <ActivityIndicator size="small" color={Colors.accent} />
        ) : (
          <MaterialIcons name={name as any} size={20} color={color} />
        )}
      </View>
      <View style={styles.stepContent}>
        <Text style={[styles.stepLabel, step.status === 'error' && { color: Colors.error }]}>
          {step.label}
        </Text>
        {step.detail && (
          <Text style={[styles.stepDetail, step.status === 'error' && { color: Colors.error }]} numberOfLines={3}>
            {step.detail}
          </Text>
        )}
        {step.duration !== undefined && (
          <Text style={styles.stepDuration}>{step.duration}ms</Text>
        )}
      </View>
    </View>
  );
}

// ============================================================
// JSON VIEWER
// ============================================================
function JsonViewer({ data, label }: { data: any; label?: string }) {
  const [expanded, setExpanded] = useState(false);
  if (!data) return null;
  const json = typeof data === 'string' ? data : JSON.stringify(data, null, 2);

  return (
    <View style={styles.jsonContainer}>
      <TouchableOpacity style={styles.jsonHeader} onPress={() => setExpanded(!expanded)} activeOpacity={0.7}>
        <MaterialIcons name="code" size={14} color={Colors.textLight} />
        <Text style={styles.jsonLabel}>{label || 'Response Data'}</Text>
        <MaterialIcons name={expanded ? 'expand-less' : 'expand-more'} size={18} color={Colors.textLight} />
      </TouchableOpacity>
      {expanded && (
        <ScrollView horizontal style={styles.jsonScroll}>
          <Text style={styles.jsonText} selectable>{json}</Text>
        </ScrollView>
      )}
    </View>
  );
}

// ============================================================
// MAIN COMPONENT
// ============================================================
export default function TestPaymentsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { currentUser, isLoggedIn, needs } = useApp();
  const topPadding = Platform.OS === 'web' ? 16 : insets.top;

  // State
  const [stripeConfig, setStripeConfig] = useState<StripeConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(false);

  // Payment test state
  const [paymentSteps, setPaymentSteps] = useState<TestStep[]>([]);
  const [paymentRunning, setPaymentRunning] = useState(false);
  const [testAmount, setTestAmount] = useState('1.00');
  const [selectedCard, setSelectedCard] = useState(TEST_CARDS[0]);
  const [paymentResult, setPaymentResult] = useState<any>(null);
  const [receiptData, setReceiptData] = useState<any>(null);

  // Payout test state
  const [payoutSteps, setPayoutSteps] = useState<TestStep[]>([]);
  const [payoutRunning, setPayoutRunning] = useState(false);
  const [payoutResult, setPayoutResult] = useState<any>(null);

  // Connect test state
  const [connectSteps, setConnectSteps] = useState<TestStep[]>([]);
  const [connectRunning, setConnectRunning] = useState(false);

  // Section collapse state
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({
    config: false,
    cards: true,
    payment: false,
    connect: true,
    payout: true,
  });

  const toggleSection = (key: string) => setCollapsed(prev => ({ ...prev, [key]: !prev[key] }));

  // ============================================================
  // CHECK STRIPE CONFIG
  // ============================================================
  const checkStripeConfig = useCallback(async () => {
    setConfigLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('stripe-connect', {
        body: { action: 'check_stripe_config' },
      });
      if (data?.success) {
        setStripeConfig(data.config);
      } else {
        setStripeConfig(null);
      }
    } catch (err: any) {
      console.error('Config check failed:', err);
    }
    setConfigLoading(false);
  }, []);

  useEffect(() => { checkStripeConfig(); }, []);

  // ============================================================
  // HELPER: Update a step
  // ============================================================
  const updateStep = (
    setSteps: React.Dispatch<React.SetStateAction<TestStep[]>>,
    stepId: string,
    updates: Partial<TestStep>
  ) => {
    setSteps(prev => prev.map(s => s.id === stepId ? { ...s, ...updates } : s));
  };

  // ============================================================
  // RUN PAYMENT TEST
  // ============================================================
  const runPaymentTest = useCallback(async () => {
    if (paymentRunning) return;
    setPaymentRunning(true);
    setPaymentResult(null);
    setReceiptData(null);

    const steps: TestStep[] = [
      { id: 'create_intent', label: 'Create Payment Intent', status: 'idle' },
      { id: 'verify_intent', label: 'Verify Intent Created', status: 'idle' },
      { id: 'verify_payment', label: 'Verify Payment (server-side)', status: 'idle' },
      { id: 'fetch_receipt', label: 'Fetch Receipt', status: 'idle' },
    ];
    setPaymentSteps(steps);

    const amount = parseFloat(testAmount) || 1.00;

    // Step 1: Create Payment Intent
    updateStep(setPaymentSteps, 'create_intent', { status: 'running', detail: `Creating $${amount.toFixed(2)} payment intent...` });
    const t1 = Date.now();

    try {
      const { data, error } = await supabase.functions.invoke('stripe-checkout', {
        body: {
          action: 'create_checkout',
          amount,
          needId: null,
          needTitle: 'Test Payment',
          contributorId: currentUser.id !== 'guest' ? currentUser.id : null,
          contributorName: currentUser.name || 'Test User',
          contributorAvatar: currentUser.avatar || '',
          note: `Test payment - ${selectedCard.label}`,
          isAnonymous: false,
          tipAmount: 0,
          type: 'contribution',
        },
      });

      const d1 = Date.now() - t1;

      if (error || !data?.success) {
        updateStep(setPaymentSteps, 'create_intent', {
          status: 'error',
          detail: `Failed: ${data?.error || error?.message || 'Unknown error'}`,
          duration: d1,
          data,
        });
        setPaymentRunning(false);
        return;
      }

      updateStep(setPaymentSteps, 'create_intent', {
        status: 'success',
        detail: `Payment ID: ${data.paymentId}\nPI: ${data.paymentIntentId || 'N/A'}\nMode: ${data.mode}\nClient Secret: ${data.clientSecret ? data.clientSecret.substring(0, 30) + '...' : 'N/A'}`,
        duration: d1,
        data,
      });

      setPaymentResult(data);

      // Step 2: Verify Intent
      updateStep(setPaymentSteps, 'verify_intent', { status: 'running', detail: 'Checking payment intent status...' });
      const t2 = Date.now();

      if (data.paymentIntentId || data.clientSecret) {
        const piId = data.paymentIntentId || (data.clientSecret ? data.clientSecret.split('_secret_')[0] : null);

        const { data: verifyData, error: verifyErr } = await supabase.functions.invoke('stripe-checkout', {
          body: {
            action: 'verify_payment',
            paymentIntentId: piId,
            paymentId: data.paymentId,
            redirectStatus: 'unknown',
          },
        });

        const d2 = Date.now() - t2;

        if (verifyErr && !verifyData) {
          updateStep(setPaymentSteps, 'verify_intent', {
            status: 'warning',
            detail: `Verify call failed: ${verifyErr.message}. This is expected for unpaid intents.`,
            duration: d2,
          });
        } else {
          const isVerified = verifyData?.verified || verifyData?.already_processed;
          updateStep(setPaymentSteps, 'verify_intent', {
            status: isVerified ? 'success' : 'warning',
            detail: isVerified
              ? `Payment verified! Status: completed`
              : `Status: ${verifyData?.status || 'requires_payment_method'} (not yet paid - this is expected for test)`,
            duration: d2,
            data: verifyData,
          });
        }
      } else {
        updateStep(setPaymentSteps, 'verify_intent', {
          status: 'warning',
          detail: 'No payment intent ID (direct mode). Skipping verification.',
          duration: Date.now() - t2,
        });
      }

      // Step 3: Server-side verification
      updateStep(setPaymentSteps, 'verify_payment', { status: 'running', detail: 'Running server-side verify_payment...' });
      const t3 = Date.now();

      try {
        const { data: vpData } = await supabase.functions.invoke('stripe-checkout', {
          body: {
            action: 'get_payment',
            paymentId: data.paymentId,
          },
        });

        const d3 = Date.now() - t3;
        if (vpData?.success && vpData.payment) {
          updateStep(setPaymentSteps, 'verify_payment', {
            status: 'success',
            detail: `Payment record found:\n  Status: ${vpData.payment.status}\n  Amount: $${vpData.payment.amount}\n  Type: ${vpData.payment.type}\n  Intent: ${vpData.payment.payment_intent_id || 'N/A'}`,
            duration: d3,
            data: vpData.payment,
          });
          setReceiptData(vpData.payment);
        } else {
          updateStep(setPaymentSteps, 'verify_payment', {
            status: 'warning',
            detail: 'Payment record not found or incomplete.',
            duration: d3,
          });
        }
      } catch (err: any) {
        updateStep(setPaymentSteps, 'verify_payment', {
          status: 'error',
          detail: `Error: ${err.message}`,
          duration: Date.now() - t3,
        });
      }

      // Step 4: Receipt
      updateStep(setPaymentSteps, 'fetch_receipt', { status: 'running', detail: 'Generating receipt data...' });
      const t4 = Date.now();

      const receipt = {
        paymentId: data.paymentId,
        paymentIntentId: data.paymentIntentId,
        amount: amount,
        tipAmount: 0,
        total: amount,
        mode: data.mode,
        destinationCharge: data.destinationCharge || false,
        recipientReceives: data.recipientReceives || amount,
        stripeAccount: data.stripeAccount,
        clientSecret: data.clientSecret ? 'present' : 'absent',
        timestamp: new Date().toISOString(),
        testCard: selectedCard.label,
      };

      updateStep(setPaymentSteps, 'fetch_receipt', {
        status: 'success',
        detail: `Receipt generated for $${amount.toFixed(2)}`,
        duration: Date.now() - t4,
        data: receipt,
      });

    } catch (err: any) {
      updateStep(setPaymentSteps, 'create_intent', {
        status: 'error',
        detail: `Exception: ${err.message}`,
        duration: Date.now() - Date.now(),
      });
    }

    setPaymentRunning(false);
  }, [testAmount, selectedCard, currentUser, paymentRunning]);

  // ============================================================
  // RUN CONNECT TEST
  // ============================================================
  const runConnectTest = useCallback(async () => {
    if (connectRunning) return;
    setConnectRunning(true);

    const steps: TestStep[] = [
      { id: 'check_config', label: 'Check Stripe Configuration', status: 'idle' },
      { id: 'check_status', label: 'Check Account Status', status: 'idle' },
      { id: 'create_account', label: 'Create/Check Account', status: 'idle' },
      { id: 'bank_info', label: 'Fetch Bank Info', status: 'idle' },
      { id: 'payout_summary', label: 'Fetch Payout Summary', status: 'idle' },
    ];
    setConnectSteps(steps);

    // Step 1: Config
    updateStep(setConnectSteps, 'check_config', { status: 'running' });
    const t1 = Date.now();
    try {
      const { data } = await supabase.functions.invoke('stripe-connect', {
        body: { action: 'check_stripe_config' },
      });
      updateStep(setConnectSteps, 'check_config', {
        status: data?.success ? 'success' : 'error',
        detail: data?.config ? `Mode: ${data.config.mode}\nKey: ${data.config.keyPrefix || 'none'}\nTest: ${data.config.isTestMode}` : 'Failed',
        duration: Date.now() - t1,
        data: data?.config,
      });
    } catch (err: any) {
      updateStep(setConnectSteps, 'check_config', { status: 'error', detail: err.message, duration: Date.now() - t1 });
    }

    // Step 2: Check Status
    updateStep(setConnectSteps, 'check_status', { status: 'running' });
    const t2 = Date.now();
    try {
      const { data } = await supabase.functions.invoke('stripe-connect', {
        body: { action: 'check_status', userId: currentUser.id },
      });
      updateStep(setConnectSteps, 'check_status', {
        status: data?.success ? 'success' : 'error',
        detail: `Has Account: ${data?.hasAccount}\nOnboarding: ${data?.onboardingComplete}\nPayouts: ${data?.payoutsEnabled}\nAccount: ${data?.accountId || 'none'}\nAPI Mode: ${data?.apiMode || 'N/A'}`,
        duration: Date.now() - t2,
        data,
      });
    } catch (err: any) {
      updateStep(setConnectSteps, 'check_status', { status: 'error', detail: err.message, duration: Date.now() - t2 });
    }

    // Step 3: Create Account
    updateStep(setConnectSteps, 'create_account', { status: 'running' });
    const t3 = Date.now();
    try {
      const { data } = await supabase.functions.invoke('stripe-connect', {
        body: {
          action: 'create_account',
          userId: currentUser.id,
          email: `${currentUser.id}@spotmeone.com`,
          name: currentUser.name,
        },
      });
      updateStep(setConnectSteps, 'create_account', {
        status: data?.success ? 'success' : 'error',
        detail: `Account: ${data?.accountId || 'none'}\nExisting: ${data?.existing}\nPending: ${data?.pending || false}\nAPI Mode: ${data?.apiMode || 'N/A'}`,
        duration: Date.now() - t3,
        data,
      });
    } catch (err: any) {
      updateStep(setConnectSteps, 'create_account', { status: 'error', detail: err.message, duration: Date.now() - t3 });
    }

    // Step 4: Bank Info
    updateStep(setConnectSteps, 'bank_info', { status: 'running' });
    const t4 = Date.now();
    try {
      const { data } = await supabase.functions.invoke('stripe-connect', {
        body: { action: 'get_bank_info', userId: currentUser.id },
      });
      updateStep(setConnectSteps, 'bank_info', {
        status: data?.success ? 'success' : 'error',
        detail: data?.bankInfo
          ? `Bank: ${data.bankInfo.bankName || 'N/A'}\nLast4: ${data.bankInfo.last4 || 'N/A'}\nType: ${data.bankInfo.type}`
          : `No bank info. ${data?.message || ''}`,
        duration: Date.now() - t4,
        data,
      });
    } catch (err: any) {
      updateStep(setConnectSteps, 'bank_info', { status: 'error', detail: err.message, duration: Date.now() - t4 });
    }

    // Step 5: Payout Summary
    updateStep(setConnectSteps, 'payout_summary', { status: 'running' });
    const t5 = Date.now();
    try {
      const { data } = await supabase.functions.invoke('stripe-connect', {
        body: { action: 'get_payout_summary', userId: currentUser.id },
      });
      updateStep(setConnectSteps, 'payout_summary', {
        status: data?.success ? 'success' : 'error',
        detail: data?.summary
          ? `Total Raised: $${data.summary.totalRaised.toFixed(2)}\nPending: $${data.summary.pendingPayout.toFixed(2)}\nPaid: $${data.summary.paidOut.toFixed(2)}\nDirect: $${data.summary.directPaymentsReceived.toFixed(2)} (${data.summary.directPaymentsCount} payments)\nStripe Mode: ${data.summary.stripeMode || 'N/A'}`
          : 'No summary data',
        duration: Date.now() - t5,
        data: data?.summary,
      });
    } catch (err: any) {
      updateStep(setConnectSteps, 'payout_summary', { status: 'error', detail: err.message, duration: Date.now() - t5 });
    }

    setConnectRunning(false);
  }, [currentUser, connectRunning]);

  // ============================================================
  // RUN PAYOUT TEST
  // ============================================================
  const runPayoutTest = useCallback(async () => {
    if (payoutRunning) return;
    setPayoutRunning(true);
    setPayoutResult(null);

    // Find a need owned by current user that's eligible
    const myNeeds = needs.filter(n =>
      (n.userId === currentUser.id || n.userId === 'current') &&
      (n.status === 'Goal Met' || (n.status === 'Expired' && n.raisedAmount > 0))
    );

    const steps: TestStep[] = [
      { id: 'find_need', label: 'Find Eligible Need', status: 'idle' },
      { id: 'request_payout', label: 'Request Payout', status: 'idle' },
      { id: 'verify_payout', label: 'Verify Payout Status', status: 'idle' },
    ];
    setPayoutSteps(steps);

    // Step 1: Find need
    updateStep(setPayoutSteps, 'find_need', { status: 'running', detail: 'Searching for eligible needs...' });
    const t1 = Date.now();

    if (myNeeds.length === 0) {
      updateStep(setPayoutSteps, 'find_need', {
        status: 'warning',
        detail: `No eligible needs found. You need a need with status "Goal Met" or "Expired" with raised amount > 0.\n\nYour needs: ${needs.filter(n => n.userId === currentUser.id || n.userId === 'current').map(n => `${n.title} (${n.status}, $${n.raisedAmount})`).join(', ') || 'none'}`,
        duration: Date.now() - t1,
      });
      setPayoutRunning(false);
      return;
    }

    const testNeed = myNeeds[0];
    updateStep(setPayoutSteps, 'find_need', {
      status: 'success',
      detail: `Found: "${testNeed.title}"\nStatus: ${testNeed.status}\nRaised: $${testNeed.raisedAmount.toFixed(2)}\nGoal: $${testNeed.goalAmount.toFixed(2)}`,
      duration: Date.now() - t1,
    });

    // Step 2: Request Payout
    updateStep(setPayoutSteps, 'request_payout', { status: 'running', detail: `Requesting payout for "${testNeed.title}"...` });
    const t2 = Date.now();

    try {
      const { data, error } = await supabase.functions.invoke('stripe-checkout', {
        body: {
          action: 'request_payout',
          needId: testNeed.id,
          userId: currentUser.id,
          amount: testNeed.raisedAmount,
          needTitle: testNeed.title,
        },
      });

      const d2 = Date.now() - t2;

      if (error || !data?.success) {
        updateStep(setPayoutSteps, 'request_payout', {
          status: 'error',
          detail: `Failed: ${data?.error || error?.message || 'Unknown error'}`,
          duration: d2,
          data,
        });
        setPayoutRunning(false);
        return;
      }

      updateStep(setPayoutSteps, 'request_payout', {
        status: 'success',
        detail: `Payout ID: ${data.payoutId}\nStatus: ${data.status}\nAmount: $${testNeed.raisedAmount.toFixed(2)}\nDirect Deposit: ${data.directDeposit || false}\nReceipt Email: ${data.receiptEmailSent || false}\nMessage: ${data.message}`,
        duration: d2,
        data,
      });

      setPayoutResult(data);

      // Step 3: Verify
      updateStep(setPayoutSteps, 'verify_payout', { status: 'running', detail: 'Checking payout history...' });
      const t3 = Date.now();

      const { data: histData } = await supabase.functions.invoke('stripe-checkout', {
        body: { action: 'fetch_payout_history', userId: currentUser.id },
      });

      if (histData?.success) {
        const latest = histData.payouts?.[0];
        updateStep(setPayoutSteps, 'verify_payout', {
          status: 'success',
          detail: latest
            ? `Latest Payout:\n  ID: ${latest.id}\n  Amount: $${latest.amount.toFixed(2)}\n  Status: ${latest.status}\n  Requested: ${latest.requestedAt}\n  Receipt: ${latest.receiptEmailSent ? 'Sent to ' + latest.receiptEmailAddress : 'Not sent'}`
            : 'No payout history found',
          duration: Date.now() - t3,
          data: histData,
        });
      } else {
        updateStep(setPayoutSteps, 'verify_payout', {
          status: 'warning',
          detail: 'Could not fetch payout history',
          duration: Date.now() - t3,
        });
      }

    } catch (err: any) {
      updateStep(setPayoutSteps, 'request_payout', {
        status: 'error',
        detail: `Exception: ${err.message}`,
        duration: Date.now() - t2,
      });
    }

    setPayoutRunning(false);
  }, [currentUser, needs, payoutRunning]);

  // ============================================================
  // NAVIGATE TO CHECKOUT
  // ============================================================
  const openCheckoutWithTestCard = useCallback(() => {
    if (!paymentResult?.clientSecret) return;
    if (Platform.OS === 'web') {
      const checkoutParams = new URLSearchParams({
        client_secret: paymentResult.clientSecret,
        payment_id: paymentResult.paymentId || '',
        amount: testAmount,
        tip_amount: '0',
        need_title: 'Test Payment',
        destination_charge: String(!!paymentResult.destinationCharge),
        application_fee: '0',
        recipient_receives: testAmount,
      });
      if (paymentResult.stripeAccount) {
        checkoutParams.set('stripe_account', paymentResult.stripeAccount);
      }
      window.location.href = `/payment-checkout?${checkoutParams.toString()}`;
    }
  }, [paymentResult, testAmount]);

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Payment Test Suite</Text>
          <Text style={styles.headerSub}>Debug & Verify Stripe Integration</Text>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={checkStripeConfig}>
          <MaterialIcons name="refresh" size={22} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>

        {/* ============ STRIPE CONFIG STATUS ============ */}
        <TestSection title="Stripe Configuration" icon="settings" collapsed={collapsed.config} onToggle={() => toggleSection('config')}>
          {configLoading ? (
            <ActivityIndicator size="small" color={Colors.primary} />
          ) : stripeConfig ? (
            <View style={styles.configGrid}>
              <View style={[styles.configBadge, { backgroundColor: stripeConfig.hasStripeSecretKey ? '#E8F5E9' : '#FFF3E0' }]}>
                <MaterialIcons
                  name={stripeConfig.hasStripeSecretKey ? 'vpn-key' : 'key-off'}
                  size={20}
                  color={stripeConfig.hasStripeSecretKey ? Colors.success : Colors.accent}
                />
                <View>
                  <Text style={styles.configBadgeTitle}>Secret Key</Text>
                  <Text style={styles.configBadgeValue}>
                    {stripeConfig.hasStripeSecretKey ? `${stripeConfig.keyPrefix} (${stripeConfig.keySource})` : 'Not configured'}
                  </Text>
                </View>
              </View>

              <View style={[styles.configBadge, { backgroundColor: stripeConfig.hasGatewayKey ? '#E8F5E9' : '#FFF0F0' }]}>
                <MaterialIcons
                  name={stripeConfig.hasGatewayKey ? 'cloud-done' : 'cloud-off'}
                  size={20}
                  color={stripeConfig.hasGatewayKey ? Colors.success : Colors.error}
                />
                <View>
                  <Text style={styles.configBadgeTitle}>Gateway Key</Text>
                  <Text style={styles.configBadgeValue}>{stripeConfig.hasGatewayKey ? 'Configured' : 'Missing'}</Text>
                </View>
              </View>

              <View style={[styles.configBadge, { backgroundColor: Colors.primaryLight }]}>
                <MaterialIcons name="swap-horiz" size={20} color={Colors.primary} />
                <View>
                  <Text style={styles.configBadgeTitle}>Active Mode</Text>
                  <Text style={styles.configBadgeValue}>{stripeConfig.mode.replace(/_/g, ' ')}</Text>
                </View>
              </View>

              {stripeConfig.isTestMode !== null && (
                <View style={[styles.configBadge, { backgroundColor: stripeConfig.isTestMode ? '#E3F2FD' : '#FFF3E0' }]}>
                  <MaterialIcons
                    name={stripeConfig.isTestMode ? 'bug-report' : 'verified'}
                    size={20}
                    color={stripeConfig.isTestMode ? '#1976D2' : Colors.accent}
                  />
                  <View>
                    <Text style={styles.configBadgeTitle}>Environment</Text>
                    <Text style={styles.configBadgeValue}>{stripeConfig.isTestMode ? 'Test Mode' : 'Live Mode'}</Text>
                  </View>
                </View>
              )}

              {!stripeConfig.hasStripeSecretKey && (
                <View style={styles.configHint}>
                  <MaterialIcons name="info" size={16} color={Colors.textLight} />
                  <Text style={styles.configHintText}>
                    To enable direct Stripe API calls, add your STRIPE_SECRET_KEY via the admin panel or update the app_secrets table. The function currently uses the gateway fallback.
                  </Text>
                </View>
              )}
            </View>
          ) : (
            <Text style={styles.noData}>Unable to fetch configuration</Text>
          )}
        </TestSection>

        {/* ============ TEST CARDS ============ */}
        <TestSection title="Test Card Numbers" icon="credit-card" collapsed={collapsed.cards} onToggle={() => toggleSection('cards')}>
          {TEST_CARDS.map(card => (
            <TouchableOpacity
              key={card.number}
              style={[styles.cardRow, selectedCard.number === card.number && styles.cardRowSelected]}
              onPress={() => setSelectedCard(card)}
              activeOpacity={0.7}
            >
              <MaterialIcons name={card.icon as any} size={18} color={card.color} />
              <View style={styles.cardInfo}>
                <Text style={styles.cardLabel}>{card.label}</Text>
                <Text style={styles.cardNumber} selectable>{card.number}</Text>
                <Text style={styles.cardDesc}>{card.description}</Text>
              </View>
              {selectedCard.number === card.number && (
                <MaterialIcons name="radio-button-checked" size={20} color={Colors.primary} />
              )}
            </TouchableOpacity>
          ))}
          <View style={styles.cardHint}>
            <MaterialIcons name="info-outline" size={14} color={Colors.textLight} />
            <Text style={styles.cardHintText}>Use any future expiry (e.g. 12/34) and any 3-digit CVC</Text>
          </View>
        </TestSection>

        {/* ============ PAYMENT TEST ============ */}
        <TestSection title="Payment Flow Test" icon="payment" collapsed={collapsed.payment} onToggle={() => toggleSection('payment')}>
          {/* Amount input */}
          <View style={styles.inputRow}>
            <Text style={styles.inputLabel}>Test Amount ($)</Text>
            <TextInput
              style={styles.amountInput}
              value={testAmount}
              onChangeText={setTestAmount}
              keyboardType="decimal-pad"
              placeholder="1.00"
              placeholderTextColor={Colors.textLight}
            />
          </View>

          <View style={styles.selectedCardBanner}>
            <MaterialIcons name={selectedCard.icon as any} size={16} color={selectedCard.color} />
            <Text style={styles.selectedCardText}>Card: {selectedCard.label} ({selectedCard.number})</Text>
          </View>

          {/* Run Test Button */}
          <TouchableOpacity
            style={[styles.runBtn, paymentRunning && styles.runBtnDisabled]}
            onPress={runPaymentTest}
            activeOpacity={0.8}
            disabled={paymentRunning}
          >
            {paymentRunning ? (
              <ActivityIndicator size="small" color={Colors.white} />
            ) : (
              <MaterialIcons name="play-arrow" size={22} color={Colors.white} />
            )}
            <Text style={styles.runBtnText}>
              {paymentRunning ? 'Running...' : 'Run Payment Test'}
            </Text>
          </TouchableOpacity>

          {/* Steps */}
          {paymentSteps.length > 0 && (
            <View style={styles.stepsContainer}>
              {paymentSteps.map(step => (
                <View key={step.id}>
                  <StepDisplay step={step} />
                  {step.data && <JsonViewer data={step.data} label={`${step.label} Response`} />}
                </View>
              ))}
            </View>
          )}

          {/* Open Checkout Button */}
          {paymentResult?.clientSecret && (
            <TouchableOpacity style={styles.checkoutBtn} onPress={openCheckoutWithTestCard} activeOpacity={0.8}>
              <MaterialIcons name="launch" size={20} color={Colors.white} />
              <Text style={styles.checkoutBtnText}>Open Stripe Checkout Form</Text>
            </TouchableOpacity>
          )}

          {/* Receipt */}
          {receiptData && (
            <View style={styles.receiptCard}>
              <View style={styles.receiptHeader}>
                <MaterialIcons name="receipt" size={20} color={Colors.primary} />
                <Text style={styles.receiptTitle}>Payment Receipt</Text>
              </View>
              <View style={styles.receiptRow}>
                <Text style={styles.receiptLabel}>Payment ID</Text>
                <Text style={styles.receiptValue} selectable>{receiptData.id}</Text>
              </View>
              <View style={styles.receiptRow}>
                <Text style={styles.receiptLabel}>Amount</Text>
                <Text style={styles.receiptValue}>${Number(receiptData.amount).toFixed(2)}</Text>
              </View>
              <View style={styles.receiptRow}>
                <Text style={styles.receiptLabel}>Status</Text>
                <View style={[styles.statusBadge, { backgroundColor: receiptData.status === 'completed' ? '#E8F5E9' : '#FFF3E0' }]}>
                  <Text style={[styles.statusText, { color: receiptData.status === 'completed' ? Colors.success : Colors.accent }]}>
                    {receiptData.status}
                  </Text>
                </View>
              </View>
              <View style={styles.receiptRow}>
                <Text style={styles.receiptLabel}>Type</Text>
                <Text style={styles.receiptValue}>{receiptData.type}</Text>
              </View>
              <View style={styles.receiptRow}>
                <Text style={styles.receiptLabel}>Intent ID</Text>
                <Text style={styles.receiptValue} selectable>{receiptData.payment_intent_id || 'N/A'}</Text>
              </View>
              <View style={styles.receiptRow}>
                <Text style={styles.receiptLabel}>Created</Text>
                <Text style={styles.receiptValue}>{new Date(receiptData.created_at).toLocaleString()}</Text>
              </View>
            </View>
          )}
        </TestSection>

        {/* ============ CONNECT TEST ============ */}
        <TestSection title="Stripe Connect Test" icon="account-balance" collapsed={collapsed.connect} onToggle={() => toggleSection('connect')}>
          <TouchableOpacity
            style={[styles.runBtn, connectRunning && styles.runBtnDisabled, { backgroundColor: Colors.secondary }]}
            onPress={runConnectTest}
            activeOpacity={0.8}
            disabled={connectRunning}
          >
            {connectRunning ? (
              <ActivityIndicator size="small" color={Colors.white} />
            ) : (
              <MaterialIcons name="play-arrow" size={22} color={Colors.white} />
            )}
            <Text style={styles.runBtnText}>
              {connectRunning ? 'Running...' : 'Run Connect Test'}
            </Text>
          </TouchableOpacity>

          {connectSteps.length > 0 && (
            <View style={styles.stepsContainer}>
              {connectSteps.map(step => (
                <View key={step.id}>
                  <StepDisplay step={step} />
                  {step.data && <JsonViewer data={step.data} label={`${step.label} Response`} />}
                </View>
              ))}
            </View>
          )}
        </TestSection>

        {/* ============ PAYOUT TEST ============ */}
        <TestSection title="Payout Flow Test" icon="account-balance-wallet" collapsed={collapsed.payout} onToggle={() => toggleSection('payout')}>
          {!isLoggedIn && (
            <View style={styles.warningBanner}>
              <MaterialIcons name="warning" size={18} color={Colors.accent} />
              <Text style={styles.warningText}>Sign in to test the payout flow</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.runBtn, (payoutRunning || !isLoggedIn) && styles.runBtnDisabled, { backgroundColor: '#8B7000' }]}
            onPress={runPayoutTest}
            activeOpacity={0.8}
            disabled={payoutRunning || !isLoggedIn}
          >
            {payoutRunning ? (
              <ActivityIndicator size="small" color={Colors.white} />
            ) : (
              <MaterialIcons name="play-arrow" size={22} color={Colors.white} />
            )}
            <Text style={styles.runBtnText}>
              {payoutRunning ? 'Running...' : 'Run Payout Test'}
            </Text>
          </TouchableOpacity>

          {payoutSteps.length > 0 && (
            <View style={styles.stepsContainer}>
              {payoutSteps.map(step => (
                <View key={step.id}>
                  <StepDisplay step={step} />
                  {step.data && <JsonViewer data={step.data} label={`${step.label} Response`} />}
                </View>
              ))}
            </View>
          )}

          {payoutResult && (
            <View style={styles.receiptCard}>
              <View style={styles.receiptHeader}>
                <MaterialIcons name="account-balance-wallet" size={20} color={Colors.success} />
                <Text style={styles.receiptTitle}>Payout Result</Text>
              </View>
              <View style={styles.receiptRow}>
                <Text style={styles.receiptLabel}>Payout ID</Text>
                <Text style={styles.receiptValue} selectable>{payoutResult.payoutId}</Text>
              </View>
              <View style={styles.receiptRow}>
                <Text style={styles.receiptLabel}>Status</Text>
                <View style={[styles.statusBadge, { backgroundColor: '#E8F5E9' }]}>
                  <Text style={[styles.statusText, { color: Colors.success }]}>{payoutResult.status}</Text>
                </View>
              </View>
              <View style={styles.receiptRow}>
                <Text style={styles.receiptLabel}>Direct Deposit</Text>
                <Text style={styles.receiptValue}>{payoutResult.directDeposit ? 'Yes' : 'No'}</Text>
              </View>
              <View style={styles.receiptRow}>
                <Text style={styles.receiptLabel}>Receipt Email</Text>
                <Text style={styles.receiptValue}>{payoutResult.receiptEmailSent ? 'Sent' : 'Not sent'}</Text>
              </View>
            </View>
          )}
        </TestSection>

        {/* ============ USER INFO ============ */}
        <View style={styles.userInfo}>
          <MaterialIcons name="person" size={16} color={Colors.textLight} />
          <Text style={styles.userInfoText}>
            {isLoggedIn ? `Logged in as: ${currentUser.name} (${currentUser.id.substring(0, 8)}...)` : 'Not logged in (guest)'}
          </Text>
        </View>

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

// ============================================================
// STYLES
// ============================================================
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.borderLight, backgroundColor: Colors.surface,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.surfaceAlt, alignItems: 'center', justifyContent: 'center',
  },
  headerCenter: { flex: 1 },
  headerTitle: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.text },
  headerSub: { fontSize: FontSize.xs, color: Colors.textLight, marginTop: 1 },
  refreshBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center',
  },
  content: { flex: 1, paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg },

  // Section
  section: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.xl,
    marginBottom: Spacing.lg, overflow: 'hidden', ...Shadow.sm,
  },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    paddingHorizontal: Spacing.xl, paddingVertical: Spacing.lg,
    borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  sectionIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center',
  },
  sectionTitle: { flex: 1, fontSize: FontSize.lg, fontWeight: '800', color: Colors.text },
  sectionContent: { padding: Spacing.xl, gap: Spacing.md },

  // Config
  configGrid: { gap: Spacing.sm },
  configBadge: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    padding: Spacing.lg, borderRadius: BorderRadius.lg,
  },
  configBadgeTitle: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textLight, textTransform: 'uppercase' },
  configBadgeValue: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.text, marginTop: 1 },
  configHint: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm,
    padding: Spacing.md, backgroundColor: Colors.surfaceAlt, borderRadius: BorderRadius.lg,
  },
  configHintText: { flex: 1, fontSize: FontSize.xs, color: Colors.textLight, lineHeight: 16 },

  // Cards
  cardRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    padding: Spacing.md, borderRadius: BorderRadius.lg,
    borderWidth: 1, borderColor: Colors.borderLight,
  },
  cardRowSelected: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  cardInfo: { flex: 1 },
  cardLabel: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.text },
  cardNumber: { fontSize: FontSize.xs, color: Colors.textSecondary, fontFamily: Platform.OS === 'web' ? 'monospace' : undefined },
  cardDesc: { fontSize: FontSize.xs, color: Colors.textLight, marginTop: 1 },
  cardHint: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    padding: Spacing.sm, backgroundColor: Colors.surfaceAlt, borderRadius: BorderRadius.sm,
  },
  cardHintText: { fontSize: FontSize.xs, color: Colors.textLight },

  // Input
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  inputLabel: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textSecondary },
  amountInput: {
    flex: 1, backgroundColor: Colors.surfaceAlt, borderRadius: BorderRadius.lg,
    padding: Spacing.md, fontSize: FontSize.lg, fontWeight: '700', color: Colors.text,
    borderWidth: 1, borderColor: Colors.border,
  },

  selectedCardBanner: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    padding: Spacing.md, backgroundColor: Colors.surfaceAlt, borderRadius: BorderRadius.lg,
  },
  selectedCardText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textSecondary },

  // Buttons
  runBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
    backgroundColor: Colors.primary, paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.xl, ...Shadow.md,
  },
  runBtnDisabled: { opacity: 0.5 },
  runBtnText: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.white },
  checkoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
    backgroundColor: '#635BFF', paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.xl, ...Shadow.md,
  },
  checkoutBtnText: { fontSize: FontSize.md, fontWeight: '700', color: Colors.white },

  // Steps
  stepsContainer: { gap: Spacing.xs },
  stepRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  stepIconWrap: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  stepContent: { flex: 1 },
  stepLabel: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.text },
  stepDetail: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2, lineHeight: 16 },
  stepDuration: { fontSize: FontSize.xs, color: Colors.textLight, marginTop: 2 },

  // JSON
  jsonContainer: {
    marginLeft: 36, marginTop: Spacing.xs, marginBottom: Spacing.sm,
    backgroundColor: '#1E1E2E', borderRadius: BorderRadius.lg, overflow: 'hidden',
  },
  jsonHeader: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    backgroundColor: '#2D2D44',
  },
  jsonLabel: { flex: 1, fontSize: FontSize.xs, color: '#A0A0B0', fontWeight: '600' },
  jsonScroll: { maxHeight: 200, padding: Spacing.md },
  jsonText: { fontSize: 11, color: '#E0E0F0', fontFamily: Platform.OS === 'web' ? 'monospace' : undefined, lineHeight: 16 },

  // Receipt
  receiptCard: {
    backgroundColor: Colors.surfaceAlt, borderRadius: BorderRadius.xl,
    padding: Spacing.xl, gap: Spacing.sm,
    borderWidth: 1, borderColor: Colors.border,
  },
  receiptHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  receiptTitle: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.text },
  receiptRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 3 },
  receiptLabel: { fontSize: FontSize.sm, color: Colors.textLight },
  receiptValue: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.text, maxWidth: '60%', textAlign: 'right' },
  statusBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.full },
  statusText: { fontSize: FontSize.xs, fontWeight: '700' },

  // Warning
  warningBanner: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    padding: Spacing.md, backgroundColor: Colors.accentLight, borderRadius: BorderRadius.lg,
  },
  warningText: { flex: 1, fontSize: FontSize.sm, color: '#8B7000', fontWeight: '600' },

  // User info
  userInfo: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs,
    paddingVertical: Spacing.lg,
  },
  userInfoText: { fontSize: FontSize.xs, color: Colors.textLight },

  noData: { fontSize: FontSize.sm, color: Colors.textLight, textAlign: 'center', paddingVertical: Spacing.lg },
});
