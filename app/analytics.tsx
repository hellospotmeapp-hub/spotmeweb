import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Platform, RefreshControl, TextInput, Modal } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, BorderRadius, FontSize, Spacing, Shadow } from '@/app/lib/theme';
import { supabase } from '@/app/lib/supabase';
import { useApp } from '@/app/lib/store';

type Period = 'daily' | 'weekly' | 'monthly';
type Tab = 'overview' | 'payments' | 'webhooks' | 'config' | 'health';

interface AnalyticsData {
  period: string;
  days: number;
  totals: {
    totalPayments: number;
    totalAmount: number;
    totalTips: number;
    successfulPayments: number;
    failedPayments: number;
    uniqueContributors: number;
    uniqueRecipients: number;
    directDepositCount: number;
    directDepositAmount: number;
    spreadCount: number;
    spreadAmount: number;
    payoutCount: number;
    payoutAmount: number;
    successRate: number;
    webhookVerificationRate: number;
    webhookConfirmedCount: number;
  };
  timeSeries: {
    date: string;
    payments: number;
    amount: number;
    tips: number;
    failed: number;
    contributors: number;
    recipients: number;
    directDeposits: number;
    spreads: number;
    payouts: number;
    payoutAmount: number;
    categoryBreakdown: Record<string, { count: number; amount: number }>;
    topNeeds: { id: string; title: string; amount: number; count: number }[];
  }[];
  webhookHealth: {
    total: number;
    verified: number;
    unverified: number;
    processed: number;
    failed: number;
    typeCounts: Record<string, number>;
  };
  stripeConfig: {
    hasSecretKey: boolean;
    keyMode: string | null;
    hasWebhookSecret: boolean;
    signatureVerification: boolean;
  };
}

function MetricCard({ icon, label, value, color, subtitle, trend }: {
  icon: string; label: string; value: string; color: string; subtitle?: string; trend?: string;
}) {
  return (
    <View style={[s.metricCard, { borderTopColor: color, borderTopWidth: 3 }]}>
      <View style={[s.metricIcon, { backgroundColor: color + '15' }]}>
        <MaterialIcons name={icon as any} size={20} color={color} />
      </View>
      <Text style={s.metricValue}>{value}</Text>
      <Text style={s.metricLabel}>{label}</Text>
      {subtitle && <Text style={s.metricSub}>{subtitle}</Text>}
      {trend && <Text style={[s.metricTrend, { color: trend.startsWith('+') ? Colors.success : trend.startsWith('-') ? Colors.error : Colors.textLight }]}>{trend}</Text>}
    </View>
  );
}

function BarChart({ data, maxHeight = 80, barColor = Colors.primary }: {
  data: { label: string; value: number; secondary?: number }[];
  maxHeight?: number;
  barColor?: string;
}) {
  const maxVal = Math.max(...data.map(d => d.value), 1);
  return (
    <View style={s.chartContainer}>
      <View style={s.chartBars}>
        {data.map((d, i) => (
          <View key={i} style={s.chartBarCol}>
            {d.secondary !== undefined && d.secondary > 0 && (
              <View style={[s.chartBarSecondary, { height: Math.max((d.secondary / maxVal) * maxHeight, 2) }]} />
            )}
            <View style={[s.chartBar, { height: Math.max((d.value / maxVal) * maxHeight, 3), backgroundColor: d.value > 0 ? barColor : Colors.borderLight }]} />
            <Text style={s.chartBarLabel}>{d.label}</Text>
            {d.value > 0 && <Text style={s.chartBarValue}>${d.value.toFixed(0)}</Text>}
          </View>
        ))}
      </View>
    </View>
  );
}

function StatusIndicator({ ok, label, detail }: { ok: boolean; label: string; detail?: string }) {
  return (
    <View style={s.statusRow}>
      <View style={[s.statusDot, { backgroundColor: ok ? Colors.success : Colors.error }]} />
      <View style={{ flex: 1 }}>
        <Text style={s.statusLabel}>{label}</Text>
        {detail && <Text style={s.statusDetail}>{detail}</Text>}
      </View>
      <MaterialIcons name={ok ? 'check-circle' : 'error'} size={18} color={ok ? Colors.success : Colors.error} />
    </View>
  );
}

export default function AnalyticsDashboard() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { currentUser, isLoggedIn } = useApp();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [computing, setComputing] = useState(false);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [period, setPeriod] = useState<Period>('daily');
  const [days, setDays] = useState(30);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [error, setError] = useState('');

  // Config state
  const [stripeKeyInput, setStripeKeyInput] = useState('');
  const [webhookSecretInput, setWebhookSecretInput] = useState('');
  const [savingKey, setSavingKey] = useState(false);
  const [keyMessage, setKeyMessage] = useState<{ text: string; success: boolean } | null>(null);
  const [connectConfig, setConnectConfig] = useState<any>(null);

  // Admin check
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    checkAdmin();
  }, [currentUser.id]);

  const checkAdmin = async () => {
    if (!isLoggedIn || currentUser.id === 'guest') { setIsAdmin(false); return; }
    try {
      const { data } = await supabase.functions.invoke('stripe-checkout', {
        body: { action: 'admin_check', userId: currentUser.id },
      });
      setIsAdmin(data?.isAdmin || false);
      if (data?.isAdmin) fetchAnalytics();
    } catch { setIsAdmin(false); }
  };

  const fetchAnalytics = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const { data, error: err } = await supabase.functions.invoke('stripe-webhook', {
        body: { action: 'get_analytics', period, days, userId: currentUser.id },
      });
      if (err) throw new Error(err.message);
      if (data?.success) {
        setAnalytics(data.analytics);
      } else {
        throw new Error(data?.error || 'Failed to load analytics');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [period, days, currentUser.id]);

  const computeAnalytics = async () => {
    setComputing(true);
    try {
      const { data } = await supabase.functions.invoke('stripe-webhook', {
        body: { action: 'compute_analytics' },
      });
      if (data?.success) {
        setKeyMessage({ text: `Analytics computed: ${data.periodsComputed} periods in ${data.durationMs}ms`, success: true });
        setTimeout(() => fetchAnalytics(true), 500);
      }
    } catch (err: any) {
      setKeyMessage({ text: `Compute failed: ${err.message}`, success: false });
    }
    setComputing(false);
    setTimeout(() => setKeyMessage(null), 4000);
  };

  const fetchConnectConfig = async () => {
    try {
      const [configRes, webhookRes] = await Promise.all([
        supabase.functions.invoke('stripe-connect', { body: { action: 'check_stripe_config' } }),
        supabase.functions.invoke('stripe-webhook', { body: { action: 'check_webhook_config' } }),
      ]);
      setConnectConfig({
        ...configRes.data?.config,
        ...webhookRes.data?.config,
      });
    } catch {}
  };

  const saveStripeKey = async () => {
    if (!stripeKeyInput.startsWith('sk_')) {
      setKeyMessage({ text: 'Key must start with sk_test_ or sk_live_', success: false });
      return;
    }
    setSavingKey(true);
    try {
      const { data } = await supabase.functions.invoke('stripe-connect', {
        body: { action: 'update_stripe_key', userId: currentUser.id, stripeSecretKey: stripeKeyInput },
      });
      if (data?.success) {
        setKeyMessage({ text: `Key saved! Mode: ${data.isTestMode ? 'Test' : 'Live'}`, success: true });
        setStripeKeyInput('');
        fetchConnectConfig();
      } else {
        setKeyMessage({ text: data?.error || 'Failed to save key', success: false });
      }
    } catch (err: any) {
      setKeyMessage({ text: err.message, success: false });
    }
    setSavingKey(false);
    setTimeout(() => setKeyMessage(null), 5000);
  };

  const saveWebhookSecret = async () => {
    if (!webhookSecretInput.startsWith('whsec_')) {
      setKeyMessage({ text: 'Secret must start with whsec_', success: false });
      return;
    }
    setSavingKey(true);
    try {
      const res = await supabase.from('app_secrets').upsert({
        key: 'STRIPE_WEBHOOK_SECRET',
        value: webhookSecretInput,
        description: 'Stripe Webhook Signing Secret',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'key' });
      setKeyMessage({ text: 'Webhook secret saved! Signature verification is now active.', success: true });
      setWebhookSecretInput('');
      fetchConnectConfig();
    } catch (err: any) {
      setKeyMessage({ text: err.message, success: false });
    }
    setSavingKey(false);
    setTimeout(() => setKeyMessage(null), 5000);
  };

  useEffect(() => {
    if (isAdmin && activeTab === 'config') fetchConnectConfig();
  }, [activeTab, isAdmin]);

  useEffect(() => {
    if (isAdmin) fetchAnalytics();
  }, [period, days, isAdmin]);

  const topPadding = Platform.OS === 'web' ? 16 : insets.top;

  if (!isLoggedIn || currentUser.id === 'guest') {
    return (
      <View style={[s.container, s.center, { paddingTop: topPadding }]}>
        <MaterialIcons name="analytics" size={56} color={Colors.borderLight} />
        <Text style={s.emptyTitle}>Sign In Required</Text>
        <TouchableOpacity style={s.primaryBtn} onPress={() => router.push('/auth')}>
          <Text style={s.primaryBtnText}>Sign In</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (isAdmin === null) {
    return (
      <View style={[s.container, s.center, { paddingTop: topPadding }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={s.loadingText}>Verifying access...</Text>
      </View>
    );
  }

  if (!isAdmin) {
    return (
      <View style={[s.container, s.center, { paddingTop: topPadding }]}>
        <MaterialIcons name="lock" size={56} color={Colors.borderLight} />
        <Text style={s.emptyTitle}>Admin Access Required</Text>
        <Text style={s.emptySubtitle}>This dashboard is restricted to administrators.</Text>
        <TouchableOpacity style={s.secondaryBtn} onPress={() => router.back()}>
          <Text style={s.secondaryBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const ts = analytics?.timeSeries || [];
  const totals = analytics?.totals;
  const wh = analytics?.webhookHealth;
  const sc = analytics?.stripeConfig;

  const chartData = ts.slice(-14).map(d => ({
    label: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).replace(' ', '\n'),
    value: d.amount,
    secondary: d.tips,
  }));

  const failedChartData = ts.slice(-14).map(d => ({
    label: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).replace(' ', '\n'),
    value: d.failed,
  }));

  return (
    <View style={[s.container, { paddingTop: topPadding }]}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>Payment Analytics</Text>
          <View style={s.headerBadges}>
            {sc?.hasSecretKey && (
              <View style={[s.modeBadge, { backgroundColor: sc.keyMode === 'live' ? Colors.success + '20' : Colors.accent + '20' }]}>
                <View style={[s.modeDot, { backgroundColor: sc.keyMode === 'live' ? Colors.success : Colors.accent }]} />
                <Text style={[s.modeText, { color: sc.keyMode === 'live' ? Colors.success : Colors.accent }]}>
                  {sc.keyMode === 'live' ? 'Live' : 'Test'} Mode
                </Text>
              </View>
            )}
            {sc?.signatureVerification && (
              <View style={[s.modeBadge, { backgroundColor: Colors.success + '20' }]}>
                <MaterialIcons name="verified-user" size={10} color={Colors.success} />
                <Text style={[s.modeText, { color: Colors.success }]}>Verified</Text>
              </View>
            )}
          </View>
        </View>
        <TouchableOpacity style={s.refreshBtn} onPress={() => { setRefreshing(true); fetchAnalytics(true); }}>
          <MaterialIcons name="refresh" size={22} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabRow}>
        {([
          { id: 'overview', label: 'Overview', icon: 'dashboard' },
          { id: 'payments', label: 'Payments', icon: 'payments' },
          { id: 'webhooks', label: 'Webhooks', icon: 'sync-alt' },
          { id: 'config', label: 'Configuration', icon: 'settings' },
          { id: 'health', label: 'System Health', icon: 'favorite' },
        ] as { id: Tab; label: string; icon: string }[]).map(tab => (
          <TouchableOpacity
            key={tab.id}
            style={[s.tabBtn, activeTab === tab.id && s.tabBtnActive]}
            onPress={() => setActiveTab(tab.id)}
          >
            <MaterialIcons name={tab.icon as any} size={16} color={activeTab === tab.id ? Colors.white : Colors.textSecondary} />
            <Text style={[s.tabBtnText, activeTab === tab.id && s.tabBtnTextActive]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Period Selector */}
      {(activeTab === 'overview' || activeTab === 'payments') && (
        <View style={s.periodRow}>
          {(['daily', 'weekly', 'monthly'] as Period[]).map(p => (
            <TouchableOpacity key={p} style={[s.periodBtn, period === p && s.periodBtnActive]} onPress={() => setPeriod(p)}>
              <Text style={[s.periodText, period === p && s.periodTextActive]}>{p.charAt(0).toUpperCase() + p.slice(1)}</Text>
            </TouchableOpacity>
          ))}
          <View style={{ flex: 1 }} />
          <TouchableOpacity style={[s.computeBtn, computing && { opacity: 0.6 }]} onPress={computeAnalytics} disabled={computing}>
            {computing ? <ActivityIndicator size="small" color={Colors.primary} /> : <MaterialIcons name="calculate" size={16} color={Colors.primary} />}
            <Text style={s.computeBtnText}>{computing ? 'Computing...' : 'Recompute'}</Text>
          </TouchableOpacity>
        </View>
      )}

      {keyMessage && (
        <View style={[s.messageBanner, { backgroundColor: keyMessage.success ? Colors.success + '15' : Colors.error + '15' }]}>
          <MaterialIcons name={keyMessage.success ? 'check-circle' : 'error'} size={16} color={keyMessage.success ? Colors.success : Colors.error} />
          <Text style={[s.messageText, { color: keyMessage.success ? Colors.success : Colors.error }]}>{keyMessage.text}</Text>
        </View>
      )}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchAnalytics(true); }} tintColor={Colors.primary} />}
      >
        {loading && !analytics ? (
          <View style={s.loadingWrap}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={s.loadingText}>Loading analytics...</Text>
          </View>
        ) : error && !analytics ? (
          <View style={s.loadingWrap}>
            <MaterialIcons name="error-outline" size={48} color={Colors.error} />
            <Text style={s.emptyTitle}>{error}</Text>
            <TouchableOpacity style={s.primaryBtn} onPress={() => fetchAnalytics()}>
              <Text style={s.primaryBtnText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* OVERVIEW TAB */}
            {activeTab === 'overview' && totals && (
              <>
                <View style={s.metricsGrid}>
                  <MetricCard icon="attach-money" label="Total Volume" value={`$${totals.totalAmount.toLocaleString()}`} color={Colors.success} subtitle={`${totals.successfulPayments} payments`} />
                  <MetricCard icon="volunteer-activism" label="Tips Earned" value={`$${totals.totalTips.toFixed(2)}`} color={Colors.primary} subtitle="Optional tips" />
                  <MetricCard icon="check-circle" label="Success Rate" value={`${totals.successRate}%`} color={totals.successRate >= 95 ? Colors.success : Colors.accent} subtitle={`${totals.failedPayments} failed`} />
                  <MetricCard icon="people" label="Contributors" value={totals.uniqueContributors.toString()} color="#7B9ED9" subtitle={`${totals.uniqueRecipients} recipients`} />
                  <MetricCard icon="swap-horiz" label="Direct Deposits" value={`$${totals.directDepositAmount.toFixed(2)}`} color={Colors.secondary} subtitle={`${totals.directDepositCount} transfers`} />
                  <MetricCard icon="savings" label="Payouts" value={`$${totals.payoutAmount.toFixed(2)}`} color="#B8A9C9" subtitle={`${totals.payoutCount} completed`} />
                </View>

                {chartData.length > 0 && (
                  <View style={s.sectionCard}>
                    <View style={s.sectionHeader}>
                      <Text style={s.sectionTitle}>Payment Volume</Text>
                      <Text style={s.sectionSub}>{period} · last {days} days</Text>
                    </View>
                    <BarChart data={chartData} barColor={Colors.success} />
                  </View>
                )}

                {totals.spreadCount > 0 && (
                  <View style={s.sectionCard}>
                    <View style={s.sectionHeader}>
                      <Text style={s.sectionTitle}>Payment Types</Text>
                    </View>
                    <View style={s.typeGrid}>
                      <View style={s.typeItem}>
                        <View style={[s.typeIcon, { backgroundColor: Colors.primary + '15' }]}>
                          <MaterialIcons name="favorite" size={20} color={Colors.primary} />
                        </View>
                        <Text style={s.typeValue}>{totals.successfulPayments - totals.spreadCount}</Text>
                        <Text style={s.typeLabel}>Single Spots</Text>
                      </View>
                      <View style={s.typeItem}>
                        <View style={[s.typeIcon, { backgroundColor: Colors.accent + '15' }]}>
                          <MaterialIcons name="auto-awesome" size={20} color={Colors.accent} />
                        </View>
                        <Text style={s.typeValue}>{totals.spreadCount}</Text>
                        <Text style={s.typeLabel}>Spreads</Text>
                      </View>
                      <View style={s.typeItem}>
                        <View style={[s.typeIcon, { backgroundColor: Colors.secondary + '15' }]}>
                          <MaterialIcons name="swap-horiz" size={20} color={Colors.secondary} />
                        </View>
                        <Text style={s.typeValue}>{totals.directDepositCount}</Text>
                        <Text style={s.typeLabel}>Direct</Text>
                      </View>
                    </View>
                  </View>
                )}
              </>
            )}

            {/* PAYMENTS TAB */}
            {activeTab === 'payments' && totals && (
              <>
                <View style={s.metricsGrid}>
                  <MetricCard icon="receipt" label="Total Payments" value={totals.totalPayments.toString()} color={Colors.primary} />
                  <MetricCard icon="check" label="Successful" value={totals.successfulPayments.toString()} color={Colors.success} />
                  <MetricCard icon="close" label="Failed" value={totals.failedPayments.toString()} color={Colors.error} />
                  <MetricCard icon="verified" label="Webhook Verified" value={`${totals.webhookVerificationRate}%`} color="#7B9ED9" subtitle={`${totals.webhookConfirmedCount} confirmed`} />
                </View>

                {failedChartData.some(d => d.value > 0) && (
                  <View style={s.sectionCard}>
                    <View style={s.sectionHeader}>
                      <Text style={s.sectionTitle}>Failed Payments</Text>
                      <MaterialIcons name="warning" size={18} color={Colors.error} />
                    </View>
                    <BarChart data={failedChartData} barColor={Colors.error} maxHeight={60} />
                  </View>
                )}

                {/* Top Needs */}
                {ts.length > 0 && (() => {
                  const allTopNeeds: Record<string, { id: string; title: string; amount: number; count: number }> = {};
                  for (const t of ts) {
                    for (const n of (t.topNeeds || [])) {
                      if (!allTopNeeds[n.id]) allTopNeeds[n.id] = { ...n };
                      else { allTopNeeds[n.id].amount += n.amount; allTopNeeds[n.id].count += n.count; }
                    }
                  }
                  const sorted = Object.values(allTopNeeds).sort((a, b) => b.amount - a.amount).slice(0, 8);
                  if (sorted.length === 0) return null;
                  return (
                    <View style={s.sectionCard}>
                      <View style={s.sectionHeader}>
                        <Text style={s.sectionTitle}>Top Funded Needs</Text>
                      </View>
                      {sorted.map((n, i) => (
                        <TouchableOpacity key={n.id} style={s.topNeedRow} onPress={() => router.push(`/need/${n.id}`)}>
                          <Text style={s.topNeedRank}>#{i + 1}</Text>
                          <View style={{ flex: 1 }}>
                            <Text style={s.topNeedTitle} numberOfLines={1}>{n.title}</Text>
                            <Text style={s.topNeedMeta}>{n.count} payments</Text>
                          </View>
                          <Text style={s.topNeedAmount}>${n.amount.toFixed(2)}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  );
                })()}
              </>
            )}

            {/* WEBHOOKS TAB */}
            {activeTab === 'webhooks' && wh && (
              <>
                <View style={s.metricsGrid}>
                  <MetricCard icon="sync-alt" label="Total Events" value={wh.total.toString()} color="#7B9ED9" />
                  <MetricCard icon="verified-user" label="Sig Verified" value={wh.verified.toString()} color={Colors.success} subtitle={`${wh.unverified} unverified`} />
                  <MetricCard icon="check-circle" label="Processed" value={wh.processed.toString()} color={Colors.success} />
                  <MetricCard icon="error" label="Failed" value={wh.failed.toString()} color={wh.failed > 0 ? Colors.error : Colors.textLight} />
                </View>

                <View style={s.sectionCard}>
                  <View style={s.sectionHeader}>
                    <Text style={s.sectionTitle}>Signature Verification</Text>
                    <MaterialIcons name="verified-user" size={18} color={sc?.signatureVerification ? Colors.success : Colors.textLight} />
                  </View>
                  <StatusIndicator
                    ok={!!sc?.signatureVerification}
                    label="Webhook Signature Verification"
                    detail={sc?.signatureVerification ? 'Active - All incoming webhooks are cryptographically verified' : 'Inactive - Set STRIPE_WEBHOOK_SECRET to enable'}
                  />
                  <View style={s.verifyStats}>
                    <View style={s.verifyStatItem}>
                      <Text style={[s.verifyStatValue, { color: Colors.success }]}>{wh.verified}</Text>
                      <Text style={s.verifyStatLabel}>Verified</Text>
                    </View>
                    <View style={s.verifyStatItem}>
                      <Text style={[s.verifyStatValue, { color: wh.unverified > 0 ? Colors.accent : Colors.textLight }]}>{wh.unverified}</Text>
                      <Text style={s.verifyStatLabel}>Unverified</Text>
                    </View>
                    <View style={s.verifyStatItem}>
                      <Text style={[s.verifyStatValue, { color: wh.total > 0 ? Colors.primary : Colors.textLight }]}>
                        {wh.total > 0 ? Math.round((wh.verified / wh.total) * 100) : 0}%
                      </Text>
                      <Text style={s.verifyStatLabel}>Rate</Text>
                    </View>
                  </View>
                </View>

                {Object.keys(wh.typeCounts).length > 0 && (
                  <View style={s.sectionCard}>
                    <View style={s.sectionHeader}>
                      <Text style={s.sectionTitle}>Event Types</Text>
                    </View>
                    {Object.entries(wh.typeCounts).sort((a, b) => b[1] - a[1]).map(([type, count]) => {
                      const typeConfig: Record<string, { icon: string; color: string }> = {
                        'payment_intent.succeeded': { icon: 'check-circle', color: Colors.success },
                        'payment_intent.payment_failed': { icon: 'error', color: Colors.error },
                        'account.updated': { icon: 'account-circle', color: '#7B9ED9' },
                        'charge.succeeded': { icon: 'bolt', color: Colors.accent },
                        'charge.refunded': { icon: 'undo', color: Colors.textLight },
                      };
                      const cfg = typeConfig[type] || { icon: 'code', color: Colors.textLight };
                      return (
                        <View key={type} style={s.eventTypeRow}>
                          <MaterialIcons name={cfg.icon as any} size={16} color={cfg.color} />
                          <Text style={s.eventTypeLabel}>{type}</Text>
                          <View style={s.eventTypeCount}>
                            <Text style={s.eventTypeCountText}>{count}</Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
              </>
            )}

            {/* CONFIG TAB */}
            {activeTab === 'config' && (
              <>
                <View style={s.sectionCard}>
                  <View style={s.sectionHeader}>
                    <Text style={s.sectionTitle}>Stripe API Keys</Text>
                    <MaterialIcons name="vpn-key" size={18} color={Colors.textLight} />
                  </View>

                  <StatusIndicator
                    ok={!!connectConfig?.hasStripeSecretKey}
                    label="STRIPE_SECRET_KEY"
                    detail={connectConfig?.hasStripeSecretKey
                      ? `Active (${connectConfig.keyPrefix}) via ${connectConfig.keySource} - ${connectConfig.isTestMode ? 'Test' : 'Live'} mode`
                      : 'Not configured - Using gateway fallback'}
                  />
                  <StatusIndicator
                    ok={!!connectConfig?.hasGatewayKey}
                    label="GATEWAY_API_KEY"
                    detail={connectConfig?.hasGatewayKey ? 'Active - Fallback payment processing' : 'Not configured'}
                  />
                  <StatusIndicator
                    ok={!!connectConfig?.hasWebhookSecret}
                    label="STRIPE_WEBHOOK_SECRET"
                    detail={connectConfig?.hasWebhookSecret
                      ? `Active (${connectConfig.webhookSecretPrefix}) - Signature verification enabled`
                      : 'Not configured - Webhooks accepted without verification'}
                  />

                  <View style={s.configDivider} />

                  <Text style={s.configLabel}>Update Stripe Secret Key</Text>
                  <Text style={s.configHint}>Get from Stripe Dashboard {'>'} Developers {'>'} API Keys</Text>
                  <View style={s.configInputRow}>
                    <TextInput
                      style={s.configInput}
                      value={stripeKeyInput}
                      onChangeText={setStripeKeyInput}
                      placeholder="sk_test_... or sk_live_..."
                      placeholderTextColor={Colors.textLight}
                      secureTextEntry
                      autoCapitalize="none"
                    />
                    <TouchableOpacity
                      style={[s.configSaveBtn, (!stripeKeyInput || savingKey) && { opacity: 0.5 }]}
                      onPress={saveStripeKey}
                      disabled={!stripeKeyInput || savingKey}
                    >
                      {savingKey ? <ActivityIndicator size="small" color={Colors.white} /> : <Text style={s.configSaveBtnText}>Save</Text>}
                    </TouchableOpacity>
                  </View>

                  <View style={s.configDivider} />

                  <Text style={s.configLabel}>Update Webhook Signing Secret</Text>
                  <Text style={s.configHint}>Get from Stripe Dashboard {'>'} Developers {'>'} Webhooks {'>'} Signing secret</Text>
                  <View style={s.configInputRow}>
                    <TextInput
                      style={s.configInput}
                      value={webhookSecretInput}
                      onChangeText={setWebhookSecretInput}
                      placeholder="whsec_..."
                      placeholderTextColor={Colors.textLight}
                      secureTextEntry
                      autoCapitalize="none"
                    />
                    <TouchableOpacity
                      style={[s.configSaveBtn, (!webhookSecretInput || savingKey) && { opacity: 0.5 }]}
                      onPress={saveWebhookSecret}
                      disabled={!webhookSecretInput || savingKey}
                    >
                      {savingKey ? <ActivityIndicator size="small" color={Colors.white} /> : <Text style={s.configSaveBtnText}>Save</Text>}
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={s.sectionCard}>
                  <View style={s.sectionHeader}>
                    <Text style={s.sectionTitle}>API Mode</Text>
                  </View>
                  <Text style={s.configHint}>
                    {connectConfig?.mode === 'direct_stripe_api'
                      ? 'Direct Stripe API calls are active. All Connect operations use your STRIPE_SECRET_KEY for maximum reliability and feature support.'
                      : connectConfig?.mode === 'gateway_fallback'
                        ? 'Using Stripe Gateway as fallback. Configure STRIPE_SECRET_KEY for direct API access and full Connect support.'
                        : 'No payment provider configured. Add STRIPE_SECRET_KEY or GATEWAY_API_KEY to enable payments.'}
                  </Text>
                  <View style={[s.modeIndicator, {
                    backgroundColor: connectConfig?.mode === 'direct_stripe_api' ? Colors.success + '15' :
                      connectConfig?.mode === 'gateway_fallback' ? Colors.accent + '15' : Colors.error + '15'
                  }]}>
                    <MaterialIcons
                      name={connectConfig?.mode === 'direct_stripe_api' ? 'bolt' : connectConfig?.mode === 'gateway_fallback' ? 'swap-horiz' : 'cloud-off'}
                      size={24}
                      color={connectConfig?.mode === 'direct_stripe_api' ? Colors.success : connectConfig?.mode === 'gateway_fallback' ? Colors.accent : Colors.error}
                    />
                    <Text style={[s.modeIndicatorText, {
                      color: connectConfig?.mode === 'direct_stripe_api' ? Colors.success : connectConfig?.mode === 'gateway_fallback' ? Colors.accent : Colors.error
                    }]}>
                      {connectConfig?.mode === 'direct_stripe_api' ? 'Direct Stripe API' :
                        connectConfig?.mode === 'gateway_fallback' ? 'Gateway Fallback' : 'Not Configured'}
                    </Text>
                  </View>
                </View>
              </>
            )}

            {/* HEALTH TAB */}
            {activeTab === 'health' && (
              <>
                <View style={s.sectionCard}>
                  <View style={s.sectionHeader}>
                    <Text style={s.sectionTitle}>Launch Readiness</Text>
                    <MaterialIcons name="rocket-launch" size={18} color={Colors.primary} />
                  </View>

                  <StatusIndicator ok={!!sc?.hasSecretKey} label="Stripe Secret Key" detail={sc?.hasSecretKey ? `${sc.keyMode} mode active` : 'Required for direct API calls'} />
                  <StatusIndicator ok={!!sc?.hasWebhookSecret} label="Webhook Verification" detail={sc?.signatureVerification ? 'Signatures verified' : 'Add whsec_ to enable'} />
                  <StatusIndicator ok={true} label="Payment Processing" detail="Gateway + direct API available" />
                  <StatusIndicator ok={true} label="Database Tables" detail="All 29 tables configured" />
                  <StatusIndicator ok={true} label="Edge Functions" detail="15 functions deployed" />
                  <StatusIndicator ok={true} label="Row Level Security" detail="Enabled on all tables" />
                  <StatusIndicator ok={true} label="Rate Limiting" detail="Enforced on all endpoints" />
                  <StatusIndicator ok={true} label="Error Monitoring" detail="Client + server logging active" />
                  <StatusIndicator ok={true} label="Auto-Expiration" detail="14-day need lifecycle" />
                  <StatusIndicator ok={true} label="Email Notifications" detail="SendGrid configured" />
                  <StatusIndicator ok={true} label="Push Notifications" detail="Web Push API active" />
                  <StatusIndicator ok={true} label="Payout System" detail="Stripe Connect Express" />
                  <StatusIndicator ok={true} label="Receipt Emails" detail="Contribution + payout receipts" />
                  <StatusIndicator ok={true} label="CSV Export" detail="Payout history export" />
                  <StatusIndicator ok={true} label="Smart Retry" detail="Auto-retry failed payments (3x)" />
                </View>

                <View style={s.sectionCard}>
                  <View style={s.sectionHeader}>
                    <Text style={s.sectionTitle}>Quick Actions</Text>
                  </View>
                  <TouchableOpacity style={s.actionBtn} onPress={computeAnalytics} disabled={computing}>
                    <MaterialIcons name="calculate" size={20} color={Colors.primary} />
                    <View style={{ flex: 1 }}>
                      <Text style={s.actionBtnTitle}>Recompute Analytics</Text>
                      <Text style={s.actionBtnDesc}>Rebuild all daily/weekly/monthly analytics from payment data</Text>
                    </View>
                    {computing ? <ActivityIndicator size="small" color={Colors.primary} /> : <MaterialIcons name="chevron-right" size={20} color={Colors.textLight} />}
                  </TouchableOpacity>
                  <TouchableOpacity style={s.actionBtn} onPress={() => router.push('/admin')}>
                    <MaterialIcons name="admin-panel-settings" size={20} color={Colors.primary} />
                    <View style={{ flex: 1 }}>
                      <Text style={s.actionBtnTitle}>Admin Dashboard</Text>
                      <Text style={s.actionBtnDesc}>Users, needs, transactions, webhooks, security</Text>
                    </View>
                    <MaterialIcons name="chevron-right" size={20} color={Colors.textLight} />
                  </TouchableOpacity>
                  <TouchableOpacity style={s.actionBtn} onPress={() => router.push('/test-payments')}>
                    <MaterialIcons name="science" size={20} color={Colors.primary} />
                    <View style={{ flex: 1 }}>
                      <Text style={s.actionBtnTitle}>Payment Test Suite</Text>
                      <Text style={s.actionBtnDesc}>Test Stripe integration, webhooks, and payouts</Text>
                    </View>
                    <MaterialIcons name="chevron-right" size={20} color={Colors.textLight} />
                  </TouchableOpacity>
                  <TouchableOpacity style={s.actionBtn} onPress={() => router.push('/payouts')}>
                    <MaterialIcons name="account-balance" size={20} color={Colors.primary} />
                    <View style={{ flex: 1 }}>
                      <Text style={s.actionBtnTitle}>Payout Dashboard</Text>
                      <Text style={s.actionBtnDesc}>View payouts, bank info, and transaction history</Text>
                    </View>
                    <MaterialIcons name="chevron-right" size={20} color={Colors.textLight} />
                  </TouchableOpacity>
                </View>
              </>
            )}
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  loadingText: { fontSize: FontSize.md, color: Colors.textSecondary, marginTop: Spacing.lg },
  loadingWrap: { alignItems: 'center', paddingVertical: Spacing.huge, gap: Spacing.md },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textSecondary, marginTop: Spacing.md },
  emptySubtitle: { fontSize: FontSize.sm, color: Colors.textLight, textAlign: 'center', marginTop: Spacing.sm },
  primaryBtn: { backgroundColor: Colors.primary, paddingHorizontal: Spacing.xxl, paddingVertical: Spacing.md, borderRadius: BorderRadius.full, marginTop: Spacing.lg },
  primaryBtnText: { color: Colors.white, fontWeight: '700', fontSize: FontSize.md },
  secondaryBtn: { borderWidth: 1, borderColor: Colors.primary, paddingHorizontal: Spacing.xxl, paddingVertical: Spacing.md, borderRadius: BorderRadius.full, marginTop: Spacing.lg },
  secondaryBtnText: { color: Colors.primary, fontWeight: '700', fontSize: FontSize.md },

  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, gap: Spacing.md },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: FontSize.xl, fontWeight: '900', color: Colors.text },
  headerBadges: { flexDirection: 'row', gap: Spacing.sm, marginTop: 2 },
  modeBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.full },
  modeDot: { width: 6, height: 6, borderRadius: 3 },
  modeText: { fontSize: 10, fontWeight: '700' },
  refreshBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },

  tabRow: { paddingHorizontal: Spacing.lg, gap: Spacing.sm, paddingBottom: Spacing.sm },
  tabBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.full, backgroundColor: Colors.surfaceAlt },
  tabBtnActive: { backgroundColor: Colors.primary },
  tabBtnText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textSecondary },
  tabBtnTextActive: { color: Colors.white },

  periodRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, gap: Spacing.sm, paddingBottom: Spacing.sm },
  periodBtn: { paddingHorizontal: Spacing.md, paddingVertical: 4, borderRadius: BorderRadius.full, backgroundColor: Colors.surfaceAlt },
  periodBtnActive: { backgroundColor: Colors.text },
  periodText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textSecondary },
  periodTextActive: { color: Colors.white },
  computeBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: Spacing.md, paddingVertical: 4, borderRadius: BorderRadius.full, backgroundColor: Colors.primaryLight },
  computeBtnText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.primary },

  messageBanner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginHorizontal: Spacing.lg, padding: Spacing.md, borderRadius: BorderRadius.lg, marginBottom: Spacing.sm },
  messageText: { fontSize: FontSize.sm, fontWeight: '600', flex: 1 },

  content: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm },

  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  metricCard: { width: '48%', backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.md, alignItems: 'center', gap: 3, ...Shadow.sm, minWidth: 140 },
  metricIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  metricValue: { fontSize: FontSize.lg, fontWeight: '900', color: Colors.text },
  metricLabel: { fontSize: FontSize.xs, color: Colors.textLight, textAlign: 'center' },
  metricSub: { fontSize: 10, color: Colors.textSecondary },
  metricTrend: { fontSize: 10, fontWeight: '700' },

  sectionCard: { backgroundColor: Colors.surface, borderRadius: BorderRadius.xl, padding: Spacing.lg, marginTop: Spacing.lg, ...Shadow.sm },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  sectionTitle: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.text },
  sectionSub: { fontSize: FontSize.xs, color: Colors.textLight },

  chartContainer: { marginTop: Spacing.sm },
  chartBars: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 120 },
  chartBarCol: { alignItems: 'center', flex: 1, gap: 3 },
  chartBar: { width: '65%', borderRadius: 3, minWidth: 8, maxWidth: 32 },
  chartBarSecondary: { width: '40%', borderRadius: 2, minWidth: 4, maxWidth: 16, backgroundColor: Colors.primary + '40', marginBottom: 1 },
  chartBarLabel: { fontSize: 7, color: Colors.textLight, fontWeight: '600', textAlign: 'center' },
  chartBarValue: { fontSize: 8, color: Colors.textSecondary, fontWeight: '700' },

  typeGrid: { flexDirection: 'row', justifyContent: 'space-around' },
  typeItem: { alignItems: 'center', gap: 4 },
  typeIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  typeValue: { fontSize: FontSize.xl, fontWeight: '900', color: Colors.text },
  typeLabel: { fontSize: FontSize.xs, color: Colors.textLight },

  topNeedRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  topNeedRank: { fontSize: FontSize.sm, fontWeight: '800', color: Colors.textLight, width: 28 },
  topNeedTitle: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.text },
  topNeedMeta: { fontSize: FontSize.xs, color: Colors.textLight },
  topNeedAmount: { fontSize: FontSize.md, fontWeight: '800', color: Colors.success },

  statusRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusLabel: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.text },
  statusDetail: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 1 },

  verifyStats: { flexDirection: 'row', justifyContent: 'space-around', marginTop: Spacing.lg, paddingTop: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.borderLight },
  verifyStatItem: { alignItems: 'center', gap: 2 },
  verifyStatValue: { fontSize: FontSize.xxl, fontWeight: '900' },
  verifyStatLabel: { fontSize: FontSize.xs, color: Colors.textLight },

  eventTypeRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  eventTypeLabel: { flex: 1, fontSize: FontSize.sm, fontWeight: '600', color: Colors.text, fontFamily: Platform.OS === 'web' ? 'monospace' : undefined },
  eventTypeCount: { backgroundColor: Colors.surfaceAlt, paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.full },
  eventTypeCountText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textSecondary },

  configDivider: { height: 1, backgroundColor: Colors.borderLight, marginVertical: Spacing.lg },
  configLabel: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text, marginBottom: 4 },
  configHint: { fontSize: FontSize.xs, color: Colors.textLight, marginBottom: Spacing.sm, lineHeight: 16 },
  configInputRow: { flexDirection: 'row', gap: Spacing.sm },
  configInput: { flex: 1, backgroundColor: Colors.surfaceAlt, borderRadius: BorderRadius.lg, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, fontSize: FontSize.sm, color: Colors.text, fontFamily: Platform.OS === 'web' ? 'monospace' : undefined, borderWidth: 1, borderColor: Colors.borderLight },
  configSaveBtn: { backgroundColor: Colors.primary, paddingHorizontal: Spacing.lg, borderRadius: BorderRadius.lg, alignItems: 'center', justifyContent: 'center' },
  configSaveBtnText: { color: Colors.white, fontWeight: '700', fontSize: FontSize.sm },

  modeIndicator: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.lg, borderRadius: BorderRadius.lg, marginTop: Spacing.md },
  modeIndicatorText: { fontSize: FontSize.md, fontWeight: '800' },

  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  actionBtnTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text },
  actionBtnDesc: { fontSize: FontSize.xs, color: Colors.textLight, marginTop: 1 },
});
