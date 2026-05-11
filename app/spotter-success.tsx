import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, BorderRadius, FontSize, Spacing } from '@/app/lib/theme';
import { supabase } from '@/app/lib/supabase';

export default function SpotterSuccessScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [tier, setTier] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const confirm = async () => {
      try {
        let sessionId = '';
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          const p = new URLSearchParams(window.location.search);
          sessionId = p.get('session_id') || '';
        }

        if (!sessionId) {
          setStatus('error');
          setErrorMsg('No session information found.');
          return;
        }

        const { data, error } = await supabase.functions.invoke('spotter-subscription', {
          body: { action: 'confirm_spotter_subscription', sessionId },
        });

        if (error || !data?.success) {
          setStatus('error');
          setErrorMsg(error?.message || data?.error || 'Could not confirm subscription.');
          return;
        }

        setTier(data.tier || 'Spotter');
        setStatus('success');
      } catch (err: any) {
        setStatus('error');
        setErrorMsg(err.message || 'An error occurred.');
      }
    };
    confirm();
  }, []);

  const tierLabel = tier
    ? tier.charAt(0).toUpperCase() + tier.slice(1) + ' Spotter'
    : 'Spotter';

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {status === 'loading' && (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Confirming your subscription…</Text>
        </View>
      )}

      {status === 'success' && (
        <View style={styles.center}>
          <Text style={styles.bigEmoji}>🧡</Text>
          <Text style={styles.title}>You're a {tierLabel}!</Text>
          <Text style={styles.sub}>
            Every month your contribution will automatically spot needs throughout the community.
            You'll receive a monthly impact report showing exactly who you helped.
          </Text>
          <View style={styles.featuresBox}>
            <Text style={styles.featureItem}>👀 Track every need you spot</Text>
            <Text style={styles.featureItem}>📊 Monthly impact report in your email</Text>
            <Text style={styles.featureItem}>🥇 Spotter badge now active on your profile</Text>
          </View>
          <TouchableOpacity style={styles.btn} onPress={() => router.replace('/(tabs)')}>
            <Text style={styles.btnText}>Go to Home</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.linkBtn} onPress={() => router.replace('/spotter-tiers')}>
            <Text style={styles.linkBtnText}>Manage subscription</Text>
          </TouchableOpacity>
        </View>
      )}

      {status === 'error' && (
        <View style={styles.center}>
          <Text style={styles.bigEmoji}>💛</Text>
          <Text style={styles.title}>Almost there!</Text>
          <Text style={styles.sub}>
            {errorMsg || 'Your subscription may still be processing. Check your email for confirmation from Stripe.'}
          </Text>
          <TouchableOpacity style={styles.btn} onPress={() => router.replace('/(tabs)')}>
            <Text style={styles.btnText}>Go to Home</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  bigEmoji: { fontSize: 64, marginBottom: 20 },
  title: {
    fontSize: 26, fontWeight: '800', color: Colors.text,
    textAlign: 'center', marginBottom: 14,
  },
  sub: {
    fontSize: FontSize.sm, color: Colors.textSecondary,
    textAlign: 'center', lineHeight: 22, marginBottom: 24,
  },
  loadingText: {
    marginTop: 16, fontSize: FontSize.sm, color: Colors.textSecondary,
  },
  featuresBox: {
    backgroundColor: Colors.primaryLight,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    width: '100%',
    marginBottom: 28,
    gap: 10,
  },
  featureItem: { fontSize: FontSize.sm, color: Colors.text, fontWeight: '500' },
  btn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    paddingVertical: 15,
    paddingHorizontal: 40,
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  btnText: { color: '#fff', fontSize: FontSize.md, fontWeight: '700' },
  linkBtn: { paddingVertical: 8 },
  linkBtnText: { color: Colors.textSecondary, fontSize: FontSize.sm, textDecorationLine: 'underline' },
});
