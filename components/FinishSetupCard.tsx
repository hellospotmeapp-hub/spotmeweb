import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { Colors, BorderRadius, FontSize, Spacing } from '@/lib/theme';
import { useApp } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import VerificationRequestModal from './VerificationRequestModal';

type StripeState = 'none' | 'incomplete' | 'ready';
type SetupStatus = { phoneOnFile: boolean; stripeState: StripeState };

interface FinishSetupCardProps {
  /** Where Stripe should send the person back to, e.g. `/need/abc`. */
  returnPath: string;
  /** Called once both steps are done, so the parent can update its own UI. */
  onReady?: () => void;
  /** 'live': the need is already approved, so this is about receiving the money, not approval. */
  mode?: 'pending' | 'live';
}

/**
 * Checklist a poster sees while their need waits for review:
 * the admin can only approve once their Stripe payout account is connected.
 */
export default function FinishSetupCard({ returnPath, onReady, mode = 'pending' }: FinishSetupCardProps) {
  const { currentUser, setupPayouts, completePayoutOnboarding, checkPayoutStatus } = useApp();
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState('');
  const [showPhone, setShowPhone] = useState(false);

  const refresh = useCallback(async () => {
    const { data } = await supabase.functions.invoke('process-contribution', { body: { action: 'get_setup_status' } })
      .catch(() => ({ data: null }));
    if (data?.success) {
      setStatus({ phoneOnFile: data.phoneOnFile, stripeState: data.stripeState });
      if (data.stripeState === 'ready' && data.phoneOnFile) onReady?.();
      return;
    }
    // Server couldn't answer: fall back to what the app already knows about payouts
    const p = await checkPayoutStatus();
    setStatus(prev => ({
      phoneOnFile: prev?.phoneOnFile ?? false,
      stripeState: p.onboardingComplete ? 'ready' : p.hasAccount ? 'incomplete' : 'none',
    }));
  }, [onReady, checkPayoutStatus]);

  useEffect(() => {
    (async () => {
      // Coming back from Stripe on the web: let the server confirm the account first
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        if (params.get('setup_payout') === 'true') {
          window.history.replaceState({}, '', window.location.pathname);
          await completePayoutOnboarding();
        }
      }
      await refresh();
    })();
  }, []);

  const handleConnect = async () => {
    setConnecting(true);
    setError('');
    const result = await setupPayouts(returnPath);
    if (!result.success) {
      setError(result.error || 'Could not open Stripe. Please try again.');
    } else if (result.onboardingUrl) {
      if (Platform.OS === 'web') {
        window.location.href = result.onboardingUrl;
        return;
      }
      await WebBrowser.openBrowserAsync(result.onboardingUrl);
      await completePayoutOnboarding();
    }
    await refresh();
    setConnecting(false);
  };

  if (!status) {
    return (
      <View style={styles.card}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  const stripeDone = status.stripeState === 'ready';
  const allDone = stripeDone && status.phoneOnFile;
  const live = mode === 'live';

  // Live needs only need payouts; once connected there's nothing left to show
  if (live && stripeDone) return null;

  if (allDone) {
    return (
      <View style={[styles.card, styles.cardDone]}>
        <View style={styles.headerRow}>
          <MaterialIcons name="check-circle" size={22} color={Colors.success} />
          <Text style={styles.title}>You're all set</Text>
        </View>
        <Text style={styles.subtitle}>Our team is reviewing your need. We'll notify you the moment it's live.</Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <MaterialIcons name={live ? 'account-balance' : 'pending-actions'} size={22} color={Colors.primary} />
        <Text style={styles.title}>{live ? 'Connect payouts to get your money' : 'Waiting on you'}</Text>
      </View>
      <Text style={styles.subtitle}>
        {live
          ? 'Your need is live and people can donate. Donations are held safely until you connect Stripe, then sent to your bank.'
          : "We can't approve your need until you finish these steps. Without them we'd have no way to send you the money."}
      </Text>

      {!live && <Step
        done={status.phoneOnFile}
        title="Add your phone number"
        detail={status.phoneOnFile ? 'On file' : 'So our team can reach you if we have questions'}
        action={status.phoneOnFile ? undefined : { label: 'Add phone', onPress: () => setShowPhone(true) }}
      />}
      <Step
        done={stripeDone}
        required
        title="Connect Stripe payouts"
        detail={
          stripeDone ? 'Connected'
            : status.stripeState === 'incomplete' ? 'Started. Finish the remaining steps on Stripe.'
            : 'Required. This is how donations reach your bank account.'
        }
        action={stripeDone ? undefined : {
          label: status.stripeState === 'incomplete' ? 'Finish setup' : 'Connect Stripe',
          onPress: handleConnect,
          loading: connecting,
        }}
      />

      {!!error && <Text style={styles.error}>{error}</Text>}

      <VerificationRequestModal
        visible={showPhone}
        onClose={() => { setShowPhone(false); refresh(); }}
        defaultName={currentUser.name}
        defaultCity={currentUser.city}
      />
    </View>
  );
}

function Step({ done, required, title, detail, action }: {
  done: boolean;
  required?: boolean;
  title: string;
  detail: string;
  action?: { label: string; onPress: () => void; loading?: boolean };
}) {
  return (
    <View style={styles.step}>
      <MaterialIcons
        name={done ? 'check-circle' : 'radio-button-unchecked'}
        size={22}
        color={done ? Colors.success : required ? Colors.primary : Colors.textLight}
      />
      <View style={styles.stepText}>
        <Text style={[styles.stepTitle, done && styles.stepTitleDone]}>{title}</Text>
        <Text style={styles.stepDetail}>{detail}</Text>
      </View>
      {action && (
        <TouchableOpacity
          style={[styles.stepBtn, action.loading && { opacity: 0.6 }]}
          onPress={action.onPress}
          disabled={action.loading}
          activeOpacity={0.8}
        >
          {action.loading
            ? <ActivityIndicator size="small" color={Colors.white} />
            : <Text style={styles.stepBtnText}>{action.label}</Text>}
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.primaryLight,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.primary + '40',
    padding: Spacing.lg,
    gap: Spacing.md,
    width: '100%',
  },
  cardDone: {
    backgroundColor: Colors.secondaryLight,
    borderColor: Colors.success + '40',
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  title: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.text },
  subtitle: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 19 },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
  stepText: { flex: 1 },
  stepTitle: { fontSize: FontSize.md, fontWeight: '600', color: Colors.text },
  stepTitleDone: { color: Colors.textSecondary },
  stepDetail: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  stepBtn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    minWidth: 96,
    alignItems: 'center',
  },
  stepBtnText: { color: Colors.white, fontSize: FontSize.sm, fontWeight: '700' },
  error: { fontSize: FontSize.sm, color: Colors.error },
});
