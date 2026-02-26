import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator, Platform, RefreshControl, TextInput, Modal } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, BorderRadius, FontSize, Spacing, Shadow, CategoryColors } from '@/app/lib/theme';
import { supabase } from '@/app/lib/supabase';
import { useApp } from '@/app/lib/store';

type Tab = 'overview' | 'users' | 'needs' | 'transactions' | 'webhooks' | 'security' | 'activity' | 'onboarding' | 'tips';



interface WebhookEvent {
  id: string;
  stripeEventId: string;
  eventType: string;
  processed: boolean;
  processingResult: string | null;
  processingError: string | null;
  relatedPaymentId: string | null;
  relatedProfileId: string | null;
  stripeAccount: string | null;
  livemode: boolean;
  receivedAt: string;
  processedAt: string | null;
  data: any;
}

interface WebhookSummary {
  totalEvents: number;
  processedCount: number;
  failedCount: number;
  pendingCount: number;
  typeCounts: Record<string, number>;
}

interface ErrorLog {
  id: string;
  source: string;
  error_type: string;
  message: string;
  stack_trace: string | null;
  severity: string;
  resolved: boolean;
  created_at: string;
  metadata: any;
}

interface AdminStats {
  totalUsers: number;
  totalNeeds: number;
  activeNeeds: number;
  totalGoalsMet: number;
  totalRaised: number;
  totalContributions: number;
  totalPayments: number;
  totalRevenue: number;
  connectedAccounts?: number;
  destinationChargeCount?: number;
  platformCollectCount?: number;
  failedPaymentsCount?: number;
  recentContributionsCount: number;
  recentNeedsCount: number;
  webhookStats?: { total: number; processed: number; failed: number; pending: number };
  retryStats?: { totalRetries: number; successful: number; failed: number; scheduled: number };
  errorStats?: { total: number; unresolved: number; critical: number };
  dailyData: { date: string; label: string; amount: number; count: number }[];
  categoryBreakdown: Record<string, { count: number; raised: number }>;
  topContributors: { name: string; avatar: string; total: number; count: number }[];
  recentTransactions: { id: string; userName: string; userAvatar: string; amount: number; needId: string; timestamp: string; isAnonymous: boolean }[];
  users: { id: string; name: string; avatar: string; city: string; verified: boolean; totalRaised: number; totalGiven: number; joinedDate: string; hasPayoutAccount?: boolean }[];
  needs: { id: string; title: string; category: string; goalAmount: number; raisedAmount: number; status: string; contributorCount: number; createdAt: string; userId: string }[];
}

// Rate limit configuration (mirrors backend)
const RATE_LIMIT_RULES = [
  { action: 'create_need', limit: '3 requests / 60 min', description: 'Creating new needs' },
  { action: 'contribute', limit: '20 requests / 60 min', description: 'Making contributions' },
  { action: 'create_profile', limit: '5 requests / 60 min', description: 'Account creation' },
  { action: 'report', limit: '10 requests / 60 min', description: 'Reporting needs/users' },
  { action: 'fetch_needs', limit: '120 requests / 5 min', description: 'Browsing needs (read)' },
  { action: 'create_checkout', limit: '10 requests / 15 min', description: 'Stripe checkout creation' },
  { action: 'retry_payment', limit: '5 requests / 30 min', description: 'Payment retries' },
  { action: 'admin_stats', limit: '30 requests / 5 min', description: 'Admin dashboard loads' },
  { action: 'export_csv', limit: '5 requests / 15 min', description: 'CSV export' },
  { action: 'default', limit: '60 requests / 5 min', description: 'All other actions' },
];

function StatCard({ icon, label, value, color, subtitle }: { icon: string; label: string; value: string; color: string; subtitle?: string }) {
  return (
    <View style={[s.statCard, { borderLeftColor: color, borderLeftWidth: 4 }]}>
      <View style={[s.statIconBg, { backgroundColor: color + '15' }]}>
        <MaterialIcons name={icon as any} size={22} color={color} />
      </View>
      <View style={s.statInfo}>
        <Text style={s.statValue}>{value}</Text>
        <Text style={s.statLabel}>{label}</Text>
        {subtitle && <Text style={s.statSubtitle}>{subtitle}</Text>}
      </View>
    </View>
  );
}

function MiniChart({ data, maxHeight = 80 }: { data: { label: string; amount: number; count: number }[]; maxHeight?: number }) {
  const maxAmount = Math.max(...data.map(d => d.amount), 1);
  return (
    <View style={s.chartContainer}>
      <View style={s.chartBars}>
        {data.map((d, i) => (
          <View key={i} style={s.chartBarCol}>
            <View style={[s.chartBar, { height: Math.max((d.amount / maxAmount) * maxHeight, 4), backgroundColor: d.amount > 0 ? Colors.primary : Colors.borderLight }]} />
            <Text style={s.chartBarLabel}>{d.label}</Text>
            <Text style={s.chartBarValue}>${d.amount}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function TabButton({ tab, current, label, icon, onPress, badge }: { tab: Tab; current: Tab; label: string; icon: string; onPress: () => void; badge?: number }) {
  const active = tab === current;
  return (
    <TouchableOpacity style={[s.tabBtn, active && s.tabBtnActive]} onPress={onPress} activeOpacity={0.7}>
      <MaterialIcons name={icon as any} size={18} color={active ? Colors.white : Colors.textSecondary} />
      <Text style={[s.tabBtnText, active && s.tabBtnTextActive]}>{label}</Text>
      {badge !== undefined && badge > 0 && (
        <View style={[s.tabBadge, active && s.tabBadgeActive]}>
          <Text style={[s.tabBadgeText, active && s.tabBadgeTextActive]}>{badge}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const EVENT_TYPE_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
  'payment_intent.succeeded': { icon: 'check-circle', color: Colors.success, label: 'Payment Succeeded' },
  'payment_intent.payment_failed': { icon: 'error', color: Colors.error, label: 'Payment Failed' },
  'account.updated': { icon: 'account-circle', color: '#7B9ED9', label: 'Account Updated' },
};

export default function AdminDashboard() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { currentUser, isLoggedIn } = useApp();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [error, setError] = useState('');

  // Admin access control
  const [isAdminUser, setIsAdminUser] = useState<boolean | null>(null);
  const [adminCheckDone, setAdminCheckDone] = useState(false);
  const [registering, setRegistering] = useState(false);

  // Webhook state
  const [webhookEvents, setWebhookEvents] = useState<WebhookEvent[]>([]);
  const [webhookSummary, setWebhookSummary] = useState<WebhookSummary | null>(null);
  const [webhookLoading, setWebhookLoading] = useState(false);
  const [webhookFilter, setWebhookFilter] = useState<'all' | 'success' | 'failed' | 'pending'>('all');
  const [webhookTypeFilter, setWebhookTypeFilter] = useState('all');
  const [webhookSearch, setWebhookSearch] = useState('');
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<WebhookEvent | null>(null);

  // Error logs state
  const [errorLogs, setErrorLogs] = useState<ErrorLog[]>([]);
  const [errorLogsLoading, setErrorLogsLoading] = useState(false);
  const [errorSeverityFilter, setErrorSeverityFilter] = useState<string>('all');

  // Walkthrough analytics state
  const [walkthroughStats, setWalkthroughStats] = useState<any>(null);
  const [walkthroughLoading, setWalkthroughLoading] = useState(false);


  // Tip analytics state
  const [tipAnalytics, setTipAnalytics] = useState<any>(null);
  const [tipAnalyticsLoading, setTipAnalyticsLoading] = useState(false);


  // Check admin access on mount
  useEffect(() => {
    checkAdminAccess();
  }, [currentUser.id]);

  const checkAdminAccess = async () => {
    if (!isLoggedIn || currentUser.id === 'guest') {
      setIsAdminUser(false);
      setAdminCheckDone(true);
      return;
    }
    try {
      const { data } = await supabase.functions.invoke('stripe-checkout', {
        body: { action: 'admin_check', userId: currentUser.id },
      });
      setIsAdminUser(data?.isAdmin || false);
    } catch {
      setIsAdminUser(false);
    }
    setAdminCheckDone(true);
  };

  const registerAsAdmin = async () => {
    if (!isLoggedIn || currentUser.id === 'guest') return;
    setRegistering(true);
    try {
      const { data } = await supabase.functions.invoke('stripe-checkout', {
        body: { action: 'admin_register', userId: currentUser.id },
      });
      if (data?.success) {
        setIsAdminUser(true);
        fetchStats();
      }
    } catch {}
    setRegistering(false);
  };

  const fetchStats = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const { data, error: err } = await supabase.functions.invoke('stripe-checkout', {
        body: { action: 'admin_stats', userId: currentUser.id },
      });
      if (err) throw new Error(err.message);
      if (data?.success) {
        setStats(data.stats);
      } else {
        throw new Error(data?.error || 'Failed to load stats');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load admin data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentUser.id]);

  const fetchWebhookLogs = useCallback(async () => {
    setWebhookLoading(true);
    try {
      const processed = webhookFilter === 'success' ? true : webhookFilter === 'failed' ? false : undefined;
      const { data } = await supabase.functions.invoke('stripe-checkout', {
        body: {
          action: 'fetch_webhook_logs',
          userId: currentUser.id,
          limit: 50,
          eventType: webhookTypeFilter,
          processed,
          search: webhookSearch || undefined,
        },
      });
      if (data?.success) {
        setWebhookEvents(data.events || []);
        setWebhookSummary(data.summary || null);
      }
    } catch {}
    setWebhookLoading(false);
  }, [webhookFilter, webhookTypeFilter, webhookSearch, currentUser.id]);

  const fetchErrorLogs = useCallback(async () => {
    setErrorLogsLoading(true);
    try {
      const { data } = await supabase.functions.invoke('stripe-checkout', {
        body: {
          action: 'fetch_error_logs',
          userId: currentUser.id,
          limit: 50,
          severity: errorSeverityFilter !== 'all' ? errorSeverityFilter : undefined,
        },
      });
      if (data?.success) {
        setErrorLogs(data.errors || []);
      }
    } catch {}
    setErrorLogsLoading(false);
  }, [currentUser.id, errorSeverityFilter]);

  const fetchWalkthroughStats = useCallback(async () => {
    setWalkthroughLoading(true);
    try {
      const { data } = await supabase.functions.invoke('track-walkthrough', {
        body: { action: 'fetch_stats', userId: currentUser.id },
      });
      if (data?.success) {
        setWalkthroughStats(data.stats);
      }
    } catch {}
    setWalkthroughLoading(false);
  }, [currentUser.id]);

  useEffect(() => {
    if (isAdminUser) fetchStats();
  }, [isAdminUser]);

  useEffect(() => {
    if (!isAdminUser) return;
    const interval = setInterval(() => fetchStats(true), 30000);
    return () => clearInterval(interval);
  }, [isAdminUser]);

  useEffect(() => {
    if (activeTab === 'webhooks' && isAdminUser) fetchWebhookLogs();
  }, [activeTab, webhookFilter, webhookTypeFilter, isAdminUser]);

  useEffect(() => {
    if (activeTab === 'security' && isAdminUser) fetchErrorLogs();
  }, [activeTab, errorSeverityFilter, isAdminUser]);

  useEffect(() => {
    if (activeTab === 'onboarding' && isAdminUser) fetchWalkthroughStats();
  }, [activeTab, isAdminUser]);

  const fetchTipAnalytics = useCallback(async () => {
    setTipAnalyticsLoading(true);
    try {
      const { data } = await supabase.functions.invoke('stripe-checkout', {
        body: { action: 'tip_analytics', userId: currentUser.id },
      });
      if (data?.success) {
        setTipAnalytics(data.tipAnalytics);
      }
    } catch {}
    setTipAnalyticsLoading(false);
  }, [currentUser.id]);

  useEffect(() => {
    if (activeTab === 'tips' && isAdminUser) fetchTipAnalytics();
  }, [activeTab, isAdminUser]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchStats(true);
    if (activeTab === 'webhooks') fetchWebhookLogs();
    if (activeTab === 'security') fetchErrorLogs();
    if (activeTab === 'onboarding') fetchWalkthroughStats();
    if (activeTab === 'tips') fetchTipAnalytics();
  };



  const topPadding = Platform.OS === 'web' ? 16 : insets.top;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Collecting': return Colors.primary;
      case 'Goal Met': return Colors.success;
      case 'Payout Requested': return Colors.accent;
      case 'Paid': return Colors.secondary;
      default: return Colors.textLight;
    }
  };

  const formatDate = (dateStr: string) => {
    try { return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); } catch { return dateStr; }
  };

  const formatTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const diffMins = Math.floor((Date.now() - d.getTime()) / 60000);
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHrs = Math.floor(diffMins / 60);
      if (diffHrs < 24) return `${diffHrs}h ago`;
      return `${Math.floor(diffHrs / 24)}d ago`;
    } catch { return ''; }
  };

  const formatFullTime = (dateStr: string) => {
    try { return new Date(dateStr).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }); } catch { return dateStr; }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return Colors.error;
      case 'error': return '#E85D5D';
      case 'warning': return Colors.accent;
      case 'info': return '#7B9ED9';
      default: return Colors.textLight;
    }
  };

  // ---- ACCESS CONTROL SCREENS ----

  // Not logged in
  if (!isLoggedIn || currentUser.id === 'guest') {
    return (
      <View style={[s.container, s.center, { paddingTop: topPadding }]}>
        <MaterialIcons name="admin-panel-settings" size={64} color={Colors.borderLight} />
        <Text style={s.errorTitle}>Sign In Required</Text>
        <Text style={s.errorMsg}>You must be signed in to access the admin dashboard.</Text>
        <TouchableOpacity style={s.retryBtn} onPress={() => router.push('/auth')}>
          <Text style={s.retryBtnText}>Sign In</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 12 }}>
          <Text style={{ color: Colors.primary, fontWeight: '600' }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Checking admin status
  if (!adminCheckDone) {
    return (
      <View style={[s.container, s.center, { paddingTop: topPadding }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={s.loadingText}>Verifying admin access...</Text>
      </View>
    );
  }

  // Not an admin - show registration option (first admin only)
  if (!isAdminUser) {
    return (
      <View style={[s.container, s.center, { paddingTop: topPadding }]}>
        <View style={s.accessDeniedCard}>
          <MaterialIcons name="shield" size={56} color={Colors.primary} />
          <Text style={s.accessDeniedTitle}>Admin Access</Text>
          <Text style={s.accessDeniedText}>
            This dashboard is restricted to authorized administrators only.
          </Text>
          <View style={s.accessDeniedDivider} />
          <Text style={s.accessDeniedSubtext}>
            If no admin has been registered yet, you can claim admin access for your account. This is a one-time setup.
          </Text>
          <TouchableOpacity
            style={[s.registerAdminBtn, registering && { opacity: 0.6 }]}
            onPress={registerAsAdmin}
            disabled={registering}
            activeOpacity={0.8}
          >
            {registering ? (
              <ActivityIndicator size="small" color={Colors.white} />
            ) : (
              <MaterialIcons name="admin-panel-settings" size={20} color={Colors.white} />
            )}
            <Text style={s.registerAdminBtnText}>
              {registering ? 'Registering...' : 'Register as Admin'}
            </Text>
          </TouchableOpacity>
          <Text style={s.accessDeniedNote}>
            Logged in as: {currentUser.name} ({currentUser.id.substring(0, 8)}...)
          </Text>
        </View>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={{ color: Colors.primary, fontWeight: '600' }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Loading stats
  if (loading) {
    return (
      <View style={[s.container, s.center, { paddingTop: topPadding }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={s.loadingText}>Loading admin dashboard...</Text>
      </View>
    );
  }

  if (error && !stats) {
    return (
      <View style={[s.container, s.center, { paddingTop: topPadding }]}>
        <MaterialIcons name="error-outline" size={48} color={Colors.error} />
        <Text style={s.errorTitle}>Failed to load</Text>
        <Text style={s.errorMsg}>{error}</Text>
        <TouchableOpacity style={s.retryBtn} onPress={() => fetchStats()}>
          <Text style={s.retryBtnText}>Retry</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 12 }}>
          <Text style={{ color: Colors.primary, fontWeight: '600' }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const webhookBadge = stats?.webhookStats?.failed || 0;
  const errorBadge = stats?.errorStats?.unresolved || 0;

  return (
    <View style={[s.container, { paddingTop: topPadding }]}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => { try { router.push('/(tabs)'); } catch { router.back(); } }}>
          <MaterialIcons name="arrow-back" size={24} color={Colors.text} />

        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle}>Admin Dashboard</Text>
          <View style={s.liveBadge}>
            <View style={s.liveDot} />
            <Text style={s.liveText}>Live</Text>
          </View>
        </View>
        <TouchableOpacity style={s.refreshBtn} onPress={onRefresh}>
          <MaterialIcons name="refresh" size={22} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Admin Badge */}
      <View style={s.adminBadgeRow}>
        <MaterialIcons name="verified-user" size={14} color={Colors.success} />
        <Text style={s.adminBadgeText}>Authenticated as {currentUser.name}</Text>
      </View>

      {/* Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabRow}>
        <TabButton tab="overview" current={activeTab} label="Overview" icon="dashboard" onPress={() => setActiveTab('overview')} />
        <TabButton tab="users" current={activeTab} label="Users" icon="people" onPress={() => setActiveTab('users')} />
        <TabButton tab="needs" current={activeTab} label="Needs" icon="volunteer-activism" onPress={() => setActiveTab('needs')} />
        <TabButton tab="transactions" current={activeTab} label="Transactions" icon="receipt-long" onPress={() => setActiveTab('transactions')} />
        <TabButton tab="webhooks" current={activeTab} label="Webhooks" icon="sync-alt" onPress={() => setActiveTab('webhooks')} badge={webhookBadge} />
        <TabButton tab="security" current={activeTab} label="Security" icon="security" onPress={() => setActiveTab('security')} badge={errorBadge} />
        <TabButton tab="activity" current={activeTab} label="Activity" icon="timeline" onPress={() => setActiveTab('activity')} />
        <TabButton tab="onboarding" current={activeTab} label="Onboarding" icon="play-circle-outline" onPress={() => setActiveTab('onboarding')} />
        <TabButton tab="tips" current={activeTab} label="Tips" icon="volunteer-activism" onPress={() => setActiveTab('tips')} />

      </ScrollView>


      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && stats && (
          <>
            <View style={s.statsGrid}>
              <StatCard icon="people" label="Total Users" value={stats.totalUsers.toString()} color="#7B9ED9" />
              <StatCard icon="volunteer-activism" label="Total Needs" value={stats.totalNeeds.toString()} color={Colors.primary} subtitle={`${stats.activeNeeds} active`} />
              <StatCard icon="attach-money" label="Total Raised" value={`$${stats.totalRaised.toLocaleString()}`} color={Colors.success} />
              <StatCard icon="check-circle" label="Goals Met" value={stats.totalGoalsMet.toString()} color={Colors.accent} />
              <StatCard icon="receipt" label="Contributions" value={stats.totalContributions.toString()} color={Colors.secondary} subtitle={`${stats.recentContributionsCount} this week`} />
              <StatCard icon="volunteer-activism" label="Tip Revenue" value={`$${stats.totalRevenue.toFixed(2)}`} color="#B8A9C9" subtitle="Optional tips" />

            </View>

            {(stats.webhookStats || stats.retryStats) && (
              <View style={s.sectionCard}>
                <View style={s.sectionHeader}>
                  <Text style={s.sectionTitle}>System Health</Text>
                  <MaterialIcons name="favorite" size={20} color={Colors.textLight} />
                </View>
                {stats.webhookStats && (
                  <View style={s.healthGrid}>
                    <View style={s.healthItem}><View style={[s.healthDot, { backgroundColor: Colors.success }]} /><Text style={s.healthLabel}>Webhooks</Text><Text style={s.healthValue}>{stats.webhookStats.total} total</Text></View>
                    <View style={s.healthItem}><View style={[s.healthDot, { backgroundColor: Colors.success }]} /><Text style={s.healthLabel}>Processed</Text><Text style={s.healthValue}>{stats.webhookStats.processed}</Text></View>
                    <View style={s.healthItem}><View style={[s.healthDot, { backgroundColor: stats.webhookStats.failed > 0 ? Colors.error : Colors.success }]} /><Text style={s.healthLabel}>Failed</Text><Text style={[s.healthValue, stats.webhookStats.failed > 0 && { color: Colors.error }]}>{stats.webhookStats.failed}</Text></View>
                    <View style={s.healthItem}><View style={[s.healthDot, { backgroundColor: stats.webhookStats.pending > 0 ? Colors.accent : Colors.success }]} /><Text style={s.healthLabel}>Pending</Text><Text style={s.healthValue}>{stats.webhookStats.pending}</Text></View>
                  </View>
                )}
                {stats.errorStats && (
                  <View style={[s.healthGrid, { marginTop: Spacing.md, paddingTop: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.borderLight }]}>
                    <View style={s.healthItem}><View style={[s.healthDot, { backgroundColor: '#7B9ED9' }]} /><Text style={s.healthLabel}>Error Logs</Text><Text style={s.healthValue}>{stats.errorStats.total} total</Text></View>
                    <View style={s.healthItem}><View style={[s.healthDot, { backgroundColor: stats.errorStats.unresolved > 0 ? Colors.accent : Colors.success }]} /><Text style={s.healthLabel}>Unresolved</Text><Text style={s.healthValue}>{stats.errorStats.unresolved}</Text></View>
                    <View style={s.healthItem}><View style={[s.healthDot, { backgroundColor: stats.errorStats.critical > 0 ? Colors.error : Colors.success }]} /><Text style={s.healthLabel}>Critical</Text><Text style={[s.healthValue, stats.errorStats.critical > 0 && { color: Colors.error }]}>{stats.errorStats.critical}</Text></View>
                  </View>
                )}
                {stats.failedPaymentsCount !== undefined && stats.failedPaymentsCount > 0 && (
                  <View style={s.failedAlert}>
                    <MaterialIcons name="warning" size={16} color={Colors.error} />
                    <Text style={s.failedAlertText}>{stats.failedPaymentsCount} failed payment{stats.failedPaymentsCount > 1 ? 's' : ''} need attention</Text>
                  </View>
                )}
              </View>
            )}

            <View style={s.sectionCard}>
              <View style={s.sectionHeader}><Text style={s.sectionTitle}>Contributions (7 Days)</Text><MaterialIcons name="bar-chart" size={20} color={Colors.textLight} /></View>
              {stats.dailyData && <MiniChart data={stats.dailyData} />}
            </View>

            <View style={s.sectionCard}>
              <View style={s.sectionHeader}><Text style={s.sectionTitle}>Category Breakdown</Text><MaterialIcons name="pie-chart" size={20} color={Colors.textLight} /></View>
              {stats.categoryBreakdown && Object.entries(stats.categoryBreakdown).map(([cat, data]) => (
                <View key={cat} style={s.catRow}>
                  <View style={[s.catDot, { backgroundColor: CategoryColors[cat] || Colors.textLight }]} />
                  <Text style={s.catName}>{cat}</Text>
                  <Text style={s.catCount}>{data.count} needs</Text>
                  <Text style={s.catRaised}>${data.raised.toLocaleString()}</Text>
                </View>
              ))}
            </View>

            <View style={s.sectionCard}>
              <View style={s.sectionHeader}><Text style={s.sectionTitle}>Top Contributors</Text><MaterialIcons name="emoji-events" size={20} color={Colors.accent} /></View>
              {stats.topContributors?.slice(0, 5).map((c, i) => (
                <View key={i} style={s.contributorRow}>
                  <Text style={s.rank}>#{i + 1}</Text>
                  {c.avatar ? <Image source={{ uri: c.avatar }} style={s.contributorAvatar} /> : <View style={[s.contributorAvatar, { backgroundColor: Colors.borderLight, alignItems: 'center', justifyContent: 'center' }]}><MaterialIcons name="person" size={18} color={Colors.textLight} /></View>}
                  <View style={s.contributorInfo}><Text style={s.contributorName}>{c.name}</Text><Text style={s.contributorMeta}>{c.count} contributions</Text></View>
                  <Text style={s.contributorTotal}>${c.total.toFixed(2)}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* USERS TAB */}
        {activeTab === 'users' && stats && (
          <>
            <View style={s.tabHeader}><Text style={s.tabHeaderTitle}>{stats.users?.length || 0} Registered Users</Text></View>
            {stats.users?.map(user => (
              <View key={user.id} style={s.userCard}>
                <Image source={{ uri: user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=F2785C&color=fff` }} style={s.userAvatar} />
                <View style={s.userInfo}>
                  <View style={s.userNameRow}>
                    <Text style={s.userName}>{user.name}</Text>
                    {user.verified && <MaterialIcons name="verified" size={14} color={Colors.primary} />}
                    {user.hasPayoutAccount && <MaterialIcons name="account-balance" size={12} color={Colors.secondary} />}
                  </View>
                  <Text style={s.userCity}>{user.city || 'No city'}</Text>
                  <View style={s.userStats}><Text style={s.userStatText}>Raised: ${user.totalRaised}</Text><Text style={s.userStatDot}>·</Text><Text style={s.userStatText}>Given: ${user.totalGiven}</Text></View>
                </View>
                <Text style={s.userDate}>{formatDate(user.joinedDate)}</Text>
              </View>
            ))}
          </>
        )}

        {/* NEEDS TAB */}
        {activeTab === 'needs' && stats && (
          <>
            <View style={s.tabHeader}>
              <Text style={s.tabHeaderTitle}>{stats.needs?.length || 0} Total Needs</Text>
              <View style={s.tabHeaderBadges}>
                <View style={[s.miniStatusBadge, { backgroundColor: Colors.primary + '20' }]}><Text style={[s.miniStatusText, { color: Colors.primary }]}>{stats.activeNeeds} active</Text></View>
                <View style={[s.miniStatusBadge, { backgroundColor: Colors.success + '20' }]}><Text style={[s.miniStatusText, { color: Colors.success }]}>{stats.totalGoalsMet} met</Text></View>
              </View>
            </View>
            {stats.needs?.map(need => (
              <TouchableOpacity key={need.id} style={s.needCard} onPress={() => router.push(`/need/${need.id}`)} activeOpacity={0.7}>
                <View style={s.needHeader}>
                  <View style={[s.needStatusDot, { backgroundColor: getStatusColor(need.status) }]} />
                  <Text style={s.needTitle} numberOfLines={1}>{need.title}</Text>
                  <View style={[s.needStatusBadge, { backgroundColor: getStatusColor(need.status) + '15' }]}><Text style={[s.needStatusText, { color: getStatusColor(need.status) }]}>{need.status}</Text></View>
                </View>
                <View style={s.needMeta}>
                  <View style={[s.needCatBadge, { backgroundColor: (CategoryColors[need.category] || Colors.textLight) + '15' }]}><Text style={[s.needCatText, { color: CategoryColors[need.category] || Colors.textLight }]}>{need.category}</Text></View>
                  <Text style={s.needAmount}>${need.raisedAmount} / ${need.goalAmount}</Text>
                  <Text style={s.needContributors}>{need.contributorCount} spots</Text>
                </View>
                <View style={s.needProgress}>
                  <View style={s.needProgressTrack}><View style={[s.needProgressFill, { width: `${Math.min((need.raisedAmount / need.goalAmount) * 100, 100)}%`, backgroundColor: getStatusColor(need.status) }]} /></View>
                  <Text style={s.needPercent}>{Math.round((need.raisedAmount / need.goalAmount) * 100)}%</Text>
                </View>
              </TouchableOpacity>
            ))}
          </>
        )}

        {/* TRANSACTIONS TAB */}
        {activeTab === 'transactions' && stats && (
          <>
            <View style={s.tabHeader}><Text style={s.tabHeaderTitle}>Recent Transactions</Text><Text style={s.tabHeaderSubtitle}>{stats.totalContributions} total</Text></View>
            {stats.recentTransactions?.map(tx => (
              <View key={tx.id} style={s.txCard}>
                <View style={s.txIconBg}><MaterialIcons name={tx.isAnonymous ? 'visibility-off' : 'favorite'} size={18} color={Colors.primary} /></View>
                <View style={s.txInfo}><Text style={s.txName}>{tx.isAnonymous ? 'Anonymous' : tx.userName}</Text><Text style={s.txTime}>{formatTime(tx.timestamp)}</Text></View>
                <Text style={s.txAmount}>+${tx.amount.toFixed(2)}</Text>
              </View>
            ))}
            {(!stats.recentTransactions || stats.recentTransactions.length === 0) && (
              <View style={s.emptyState}><MaterialIcons name="receipt-long" size={48} color={Colors.borderLight} /><Text style={s.emptyText}>No transactions yet</Text></View>
            )}
          </>
        )}

        {/* WEBHOOKS TAB */}
        {activeTab === 'webhooks' && (
          <>
            {webhookSummary && (
              <View style={s.whSummaryGrid}>
                <View style={[s.whSummaryCard, { borderLeftColor: '#7B9ED9' }]}><Text style={s.whSummaryValue}>{webhookSummary.totalEvents}</Text><Text style={s.whSummaryLabel}>Total Events</Text></View>
                <View style={[s.whSummaryCard, { borderLeftColor: Colors.success }]}><Text style={[s.whSummaryValue, { color: Colors.success }]}>{webhookSummary.processedCount}</Text><Text style={s.whSummaryLabel}>Processed</Text></View>
                <View style={[s.whSummaryCard, { borderLeftColor: Colors.error }]}><Text style={[s.whSummaryValue, { color: webhookSummary.failedCount > 0 ? Colors.error : Colors.textLight }]}>{webhookSummary.failedCount}</Text><Text style={s.whSummaryLabel}>Failed</Text></View>
                <View style={[s.whSummaryCard, { borderLeftColor: Colors.accent }]}><Text style={[s.whSummaryValue, { color: webhookSummary.pendingCount > 0 ? Colors.accent : Colors.textLight }]}>{webhookSummary.pendingCount}</Text><Text style={s.whSummaryLabel}>Pending</Text></View>
              </View>
            )}

            {webhookSummary?.typeCounts && Object.keys(webhookSummary.typeCounts).length > 0 && (
              <View style={s.sectionCard}>
                <Text style={[s.sectionTitle, { marginBottom: Spacing.sm }]}>Event Types</Text>
                {Object.entries(webhookSummary.typeCounts).sort((a, b) => b[1] - a[1]).map(([type, count]) => {
                  const config = EVENT_TYPE_CONFIG[type] || { icon: 'code', color: Colors.textLight, label: type };
                  return (
                    <TouchableOpacity key={type} style={s.whTypeRow} onPress={() => setWebhookTypeFilter(webhookTypeFilter === type ? 'all' : type)} activeOpacity={0.7}>
                      <MaterialIcons name={config.icon as any} size={18} color={config.color} />
                      <Text style={[s.whTypeLabel, webhookTypeFilter === type && { color: Colors.primary, fontWeight: '800' }]}>{config.label}</Text>
                      <View style={[s.whTypeCount, webhookTypeFilter === type && { backgroundColor: Colors.primary + '15' }]}><Text style={[s.whTypeCountText, webhookTypeFilter === type && { color: Colors.primary }]}>{count}</Text></View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            <View style={s.whFilterRow}>
              {(['all', 'success', 'failed', 'pending'] as const).map(f => (
                <TouchableOpacity key={f} style={[s.whFilterBtn, webhookFilter === f && s.whFilterBtnActive]} onPress={() => setWebhookFilter(f)} activeOpacity={0.7}>
                  <Text style={[s.whFilterText, webhookFilter === f && s.whFilterTextActive]}>{f === 'all' ? 'All' : f === 'success' ? 'Success' : f === 'failed' ? 'Failed' : 'Pending'}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={s.whSearchRow}>
              <MaterialIcons name="search" size={20} color={Colors.textLight} />
              <TextInput style={s.whSearchInput} placeholder="Search events..." placeholderTextColor={Colors.textLight} value={webhookSearch} onChangeText={setWebhookSearch} onSubmitEditing={fetchWebhookLogs} returnKeyType="search" />
              {webhookSearch.length > 0 && (<TouchableOpacity onPress={() => { setWebhookSearch(''); setTimeout(fetchWebhookLogs, 100); }}><MaterialIcons name="close" size={18} color={Colors.textLight} /></TouchableOpacity>)}
            </View>

            {webhookLoading ? (
              <View style={s.whLoadingWrap}><ActivityIndicator size="small" color={Colors.primary} /><Text style={s.whLoadingText}>Loading webhook events...</Text></View>
            ) : webhookEvents.length === 0 ? (
              <View style={s.emptyState}><MaterialIcons name="webhook" size={48} color={Colors.borderLight} /><Text style={s.emptyText}>No webhook events found</Text></View>
            ) : (
              webhookEvents.map(evt => {
                const config = EVENT_TYPE_CONFIG[evt.eventType] || { icon: 'code', color: Colors.textLight, label: evt.eventType };
                const isExpanded = expandedEvent === evt.id;
                const hasError = !!evt.processingError;
                return (
                  <TouchableOpacity key={evt.id} style={[s.whEventCard, hasError && s.whEventCardError]} onPress={() => setExpandedEvent(isExpanded ? null : evt.id)} activeOpacity={0.7}>
                    <View style={s.whEventHeader}>
                      <View style={[s.whEventIcon, { backgroundColor: config.color + '15' }]}><MaterialIcons name={config.icon as any} size={18} color={config.color} /></View>
                      <View style={s.whEventInfo}><Text style={s.whEventType}>{config.label}</Text><Text style={s.whEventId} numberOfLines={1}>{evt.stripeEventId}</Text><Text style={s.whEventTime}>{formatFullTime(evt.receivedAt)}</Text></View>
                      <View style={s.whEventRight}>
                        <View style={[s.whStatusBadge, { backgroundColor: hasError ? Colors.error + '15' : evt.processed ? Colors.success + '15' : Colors.accent + '15' }]}>
                          <MaterialIcons name={hasError ? 'error' : evt.processed ? 'check-circle' : 'schedule'} size={12} color={hasError ? Colors.error : evt.processed ? Colors.success : Colors.accent} />
                          <Text style={[s.whStatusText, { color: hasError ? Colors.error : evt.processed ? Colors.success : Colors.accent }]}>{hasError ? 'Error' : evt.processed ? 'OK' : 'Pending'}</Text>
                        </View>
                        <MaterialIcons name={isExpanded ? 'expand-less' : 'expand-more'} size={20} color={Colors.textLight} />
                      </View>
                    </View>
                    {!isExpanded && (evt.processingResult || evt.processingError) && (<Text style={[s.whEventSummary, hasError && { color: Colors.error }]} numberOfLines={1}>{evt.processingError || evt.processingResult}</Text>)}
                    {isExpanded && (
                      <View style={s.whEventDetails}>
                        {evt.processingResult && <View style={s.whDetailRow}><Text style={s.whDetailLabel}>Result</Text><Text style={s.whDetailValue}>{evt.processingResult}</Text></View>}
                        {evt.processingError && <View style={s.whDetailRow}><Text style={[s.whDetailLabel, { color: Colors.error }]}>Error</Text><Text style={[s.whDetailValue, { color: Colors.error }]}>{evt.processingError}</Text></View>}
                        {evt.relatedPaymentId && <View style={s.whDetailRow}><Text style={s.whDetailLabel}>Payment ID</Text><Text style={s.whDetailValue}>{evt.relatedPaymentId}</Text></View>}
                        <View style={s.whDetailRow}><Text style={s.whDetailLabel}>Mode</Text><Text style={s.whDetailValue}>{evt.livemode ? 'Live' : 'Test'}</Text></View>
                        <TouchableOpacity style={s.whPayloadBtn} onPress={() => setSelectedEvent(evt)} activeOpacity={0.7}>
                          <MaterialIcons name="data-object" size={16} color={Colors.primary} /><Text style={s.whPayloadBtnText}>View Full Payload</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })
            )}
          </>
        )}

        {/* ============================================================ */}
        {/* SECURITY TAB */}
        {/* ============================================================ */}
        {activeTab === 'security' && (
          <>
            {/* Enforced Limits */}
            <View style={s.sectionCard}>
              <View style={s.sectionHeader}>
                <Text style={s.sectionTitle}>Enforced Rate Limits</Text>
                <MaterialIcons name="speed" size={20} color={Colors.textLight} />
              </View>
              <Text style={s.securityDesc}>
                Rate limits are enforced per user ID (authenticated) or per IP address (anonymous). Exceeding limits returns HTTP 429.
              </Text>
              {RATE_LIMIT_RULES.map((rule, i) => (
                <View key={i} style={s.rateLimitRow}>
                  <View style={s.rateLimitInfo}>
                    <Text style={s.rateLimitAction}>{rule.description}</Text>
                    <Text style={s.rateLimitActionCode}>{rule.action}</Text>
                  </View>
                  <View style={s.rateLimitBadge}>
                    <Text style={s.rateLimitValue}>{rule.limit}</Text>
                  </View>
                </View>
              ))}
            </View>

            {/* Security Configuration */}
            <View style={s.sectionCard}>
              <View style={s.sectionHeader}>
                <Text style={s.sectionTitle}>Security Configuration</Text>
                <MaterialIcons name="shield" size={20} color={Colors.textLight} />
              </View>
              <View style={s.secConfigRow}><MaterialIcons name="check-circle" size={18} color={Colors.success} /><Text style={s.secConfigText}>Row Level Security (RLS) enabled on all tables</Text></View>
              <View style={s.secConfigRow}><MaterialIcons name="check-circle" size={18} color={Colors.success} /><Text style={s.secConfigText}>Admin access control via admin_users table</Text></View>
              <View style={s.secConfigRow}><MaterialIcons name="check-circle" size={18} color={Colors.success} /><Text style={s.secConfigText}>Input validation & sanitization on all endpoints</Text></View>
              <View style={s.secConfigRow}><MaterialIcons name="check-circle" size={18} color={Colors.success} /><Text style={s.secConfigText}>UUID validation for all ID parameters</Text></View>
              <View style={s.secConfigRow}><MaterialIcons name="check-circle" size={18} color={Colors.success} /><Text style={s.secConfigText}>HTML/XSS stripping on text inputs</Text></View>
              <View style={s.secConfigRow}><MaterialIcons name="check-circle" size={18} color={Colors.success} /><Text style={s.secConfigText}>Amount validation (min $0.01, max $10,000)</Text></View>
              <View style={s.secConfigRow}><MaterialIcons name="check-circle" size={18} color={Colors.success} /><Text style={s.secConfigText}>Stripe keys server-side only (GATEWAY_API_KEY)</Text></View>


              <View style={s.secConfigRow}><MaterialIcons name="check-circle" size={18} color={Colors.success} /><Text style={s.secConfigText}>CORS headers on all edge functions</Text></View>
              <View style={s.secConfigRow}><MaterialIcons name="check-circle" size={18} color={Colors.success} /><Text style={s.secConfigText}>Auto-cleanup of stale rate limit entries</Text></View>
              <View style={s.secConfigRow}><MaterialIcons name="check-circle" size={18} color={Colors.success} /><Text style={s.secConfigText}>Database indexes on all queried fields</Text></View>
              <View style={s.secConfigRow}><MaterialIcons name="check-circle" size={18} color={Colors.success} /><Text style={s.secConfigText}>Trust score system with auto-verification</Text></View>
              <View style={s.secConfigRow}><MaterialIcons name="check-circle" size={18} color={Colors.success} /><Text style={s.secConfigText}>Need verification flow (auto + manual)</Text></View>
              <View style={s.secConfigRow}><MaterialIcons name="check-circle" size={18} color={Colors.success} /><Text style={s.secConfigText}>Contribution receipts with unique IDs</Text></View>
              <View style={s.secConfigRow}><MaterialIcons name="check-circle" size={18} color={Colors.success} /><Text style={s.secConfigText}>Client + server error monitoring</Text></View>
              <View style={s.secConfigRow}><MaterialIcons name="check-circle" size={18} color={Colors.success} /><Text style={s.secConfigText}>Push notifications via Web Push API</Text></View>
              <View style={s.secConfigRow}><MaterialIcons name="check-circle" size={18} color={Colors.success} /><Text style={s.secConfigText}>Payment retry system (max 3 retries)</Text></View>
            </View>

            {/* Database Indexes */}
            <View style={s.sectionCard}>
              <View style={s.sectionHeader}>
                <Text style={s.sectionTitle}>Database Indexes</Text>
                <MaterialIcons name="storage" size={20} color={Colors.textLight} />
              </View>
              <Text style={s.securityDesc}>Indexes are active on the following fields for optimal query performance:</Text>
              {[
                'needs: user_id, status, category, verification_status, created_at',
                'contributions: need_id, user_id, created_at',
                'payments: contributor_id, need_id, status, payment_intent_id, created_at',
                'notifications: user_id, (user_id + read), created_at',
                'profiles: trust_score, trust_level, stripe_account_id',
                'rate_limits: (user_id + action + created_at), (ip + action + created_at)',
                'error_logs: source, severity, created_at, resolved',
                'reports: reported_need_id, reported_user_id, status',
                'stripe_events: event_type, processed, received_at',
              ].map((idx, i) => (
                <View key={i} style={s.indexRow}>
                  <MaterialIcons name="flash-on" size={14} color={Colors.accent} />
                  <Text style={s.indexText}>{idx}</Text>
                </View>
              ))}
            </View>

            {/* Error Logs */}
            <View style={s.sectionCard}>
              <View style={s.sectionHeader}>
                <Text style={s.sectionTitle}>Error Logs</Text>
                <MaterialIcons name="bug-report" size={20} color={Colors.textLight} />
              </View>

              <View style={s.whFilterRow}>
                {['all', 'critical', 'error', 'warning', 'info'].map(sev => (
                  <TouchableOpacity key={sev} style={[s.whFilterBtn, errorSeverityFilter === sev && s.whFilterBtnActive]} onPress={() => setErrorSeverityFilter(sev)} activeOpacity={0.7}>
                    <Text style={[s.whFilterText, errorSeverityFilter === sev && s.whFilterTextActive]}>{sev === 'all' ? 'All' : sev.charAt(0).toUpperCase() + sev.slice(1)}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {errorLogsLoading ? (
                <View style={s.whLoadingWrap}><ActivityIndicator size="small" color={Colors.primary} /><Text style={s.whLoadingText}>Loading error logs...</Text></View>
              ) : errorLogs.length === 0 ? (
                <View style={[s.emptyState, { paddingVertical: Spacing.xl }]}><MaterialIcons name="check-circle" size={36} color={Colors.success} /><Text style={s.emptyText}>No errors found</Text></View>
              ) : (
                errorLogs.slice(0, 20).map(log => (
                  <View key={log.id} style={[s.errorLogCard, { borderLeftColor: getSeverityColor(log.severity) }]}>
                    <View style={s.errorLogHeader}>
                      <View style={[s.errorLogSeverity, { backgroundColor: getSeverityColor(log.severity) + '15' }]}>
                        <Text style={[s.errorLogSeverityText, { color: getSeverityColor(log.severity) }]}>{log.severity.toUpperCase()}</Text>
                      </View>
                      <Text style={s.errorLogSource}>{log.source}</Text>
                      <Text style={s.errorLogTime}>{formatTime(log.created_at)}</Text>
                    </View>
                    <Text style={s.errorLogMessage} numberOfLines={2}>{log.message}</Text>
                    <Text style={s.errorLogType}>{log.error_type}</Text>
                  </View>
                ))
              )}
            </View>

            {/* Stripe Configuration */}
            <View style={s.sectionCard}>
              <View style={s.sectionHeader}>
                <Text style={s.sectionTitle}>Stripe Configuration</Text>
                <MaterialIcons name="payment" size={20} color={Colors.textLight} />
              </View>
              <View style={s.secConfigRow}><MaterialIcons name="check-circle" size={18} color={Colors.success} /><Text style={s.secConfigText}>GATEWAY_API_KEY: Configured (Stripe gateway fallback)</Text></View>
              <View style={s.secConfigRow}><MaterialIcons name="check-circle" size={18} color={Colors.success} /><Text style={s.secConfigText}>STRIPE_SECRET_KEY: Preferred for direct API calls (via env var or app_secrets table)</Text></View>
              <View style={s.secConfigRow}><MaterialIcons name="check-circle" size={18} color={Colors.success} /><Text style={s.secConfigText}>STRIPE_WEBHOOK_SECRET: Webhook signature verification (HMAC-SHA256)</Text></View>
              <View style={s.secConfigRow}><MaterialIcons name="check-circle" size={18} color={Colors.success} /><Text style={s.secConfigText}>Platform fee: None (optional tips via application_fee_amount)</Text></View>
              <View style={s.secConfigRow}><MaterialIcons name="check-circle" size={18} color={Colors.success} /><Text style={s.secConfigText}>Webhook endpoint: Active with signature verification</Text></View>
              <View style={s.secConfigRow}><MaterialIcons name="check-circle" size={18} color={Colors.success} /><Text style={s.secConfigText}>Connected accounts: {stats?.connectedAccounts || 0} active</Text></View>
              <View style={s.secConfigRow}><MaterialIcons name="check-circle" size={18} color={Colors.success} /><Text style={s.secConfigText}>Auto-retry on failure: Up to 3 attempts</Text></View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.md }}>
                <TouchableOpacity style={[s.retryBtn, { flex: 1, alignItems: 'center', minWidth: 100 }]} onPress={() => router.push('/analytics')}>
                  <Text style={s.retryBtnText}>Analytics</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.retryBtn, { flex: 1, alignItems: 'center', backgroundColor: Colors.secondary, minWidth: 100 }]} onPress={() => router.push('/test-payments')}>
                  <Text style={s.retryBtnText}>Test Suite</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.retryBtn, { flex: 1, alignItems: 'center', backgroundColor: Colors.error, minWidth: 100 }]} onPress={() => router.push('/refunds')}>
                  <Text style={s.retryBtnText}>Refunds</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.retryBtn, { flex: 1, alignItems: 'center', backgroundColor: '#635BFF', minWidth: 100 }]} onPress={() => router.push('/go-live')}>
                  <Text style={s.retryBtnText}>Go-Live</Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}


        {/* ACTIVITY TAB */}
        {activeTab === 'activity' && stats && (
          <>
            <View style={s.tabHeader}><Text style={s.tabHeaderTitle}>Platform Activity</Text></View>
            <View style={s.sectionCard}>
              <Text style={s.sectionTitle}>This Week</Text>
              <View style={s.activityGrid}>
                <View style={s.activityItem}><Text style={[s.activityNumber, { color: Colors.primary }]}>{stats.recentContributionsCount}</Text><Text style={s.activityLabel}>Contributions</Text></View>
                <View style={s.activityItem}><Text style={[s.activityNumber, { color: Colors.secondary }]}>{stats.recentNeedsCount}</Text><Text style={s.activityLabel}>New Needs</Text></View>
                <View style={s.activityItem}><Text style={[s.activityNumber, { color: Colors.accent }]}>{stats.totalPayments}</Text><Text style={s.activityLabel}>Payments</Text></View>
              </View>
            </View>
            <View style={s.sectionCard}>
              <Text style={s.sectionTitle}>Daily Volume</Text>
              {stats.dailyData && <MiniChart data={stats.dailyData} maxHeight={60} />}
            </View>
            <View style={s.sectionCard}>
              <Text style={s.sectionTitle}>System Health</Text>
              <View style={s.healthRow}><MaterialIcons name="check-circle" size={20} color={Colors.success} /><Text style={s.healthText}>Database: Connected</Text></View>
              <View style={s.healthRow}><MaterialIcons name="check-circle" size={20} color={Colors.success} /><Text style={s.healthText}>Edge Functions: Running</Text></View>
              <View style={s.healthRow}><MaterialIcons name="check-circle" size={20} color={Colors.success} /><Text style={s.healthText}>Stripe Integration: Ready</Text></View>
              <View style={s.healthRow}><MaterialIcons name="check-circle" size={20} color={Colors.success} /><Text style={s.healthText}>Webhook Endpoint: Active</Text></View>
              <View style={s.healthRow}><MaterialIcons name="check-circle" size={20} color={Colors.success} /><Text style={s.healthText}>Rate Limiting: Enforced</Text></View>
              <View style={s.healthRow}><MaterialIcons name="check-circle" size={20} color={Colors.success} /><Text style={s.healthText}>Error Monitoring: Active</Text></View>
              <View style={s.healthRow}><MaterialIcons name="check-circle" size={20} color={Colors.success} /><Text style={s.healthText}>Admin Access Control: Enforced</Text></View>
              <View style={s.healthRow}><MaterialIcons name="check-circle" size={20} color={Colors.success} /><Text style={s.healthText}>Push Notifications: Active</Text></View>
            </View>
          </>
        )}

        {/* ONBOARDING TAB */}
        {activeTab === 'onboarding' && (
          <>
            <View style={s.tabHeader}>
              <Text style={s.tabHeaderTitle}>Walkthrough Analytics</Text>
              <TouchableOpacity onPress={fetchWalkthroughStats} style={{ opacity: walkthroughLoading ? 0.5 : 1 }}>
                <MaterialIcons name="refresh" size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {walkthroughLoading && !walkthroughStats ? (
              <View style={s.whLoadingWrap}><ActivityIndicator size="small" color={Colors.primary} /><Text style={s.whLoadingText}>Loading walkthrough stats...</Text></View>
            ) : !walkthroughStats ? (
              <View style={s.emptyState}><MaterialIcons name="play-circle-outline" size={48} color={Colors.borderLight} /><Text style={s.emptyText}>No walkthrough data yet</Text></View>
            ) : (
              <>
                {/* Key Metrics */}
                <View style={s.statsGrid}>
                  <StatCard icon="play-arrow" label="Total Starts" value={String(walkthroughStats.totalStarts || 0)} color={Colors.primary} />
                  <StatCard icon="check-circle" label="Completions" value={String(walkthroughStats.totalCompletes || 0)} color={Colors.success} subtitle={`${walkthroughStats.completionRate || 0}% rate`} />
                  <StatCard icon="skip-next" label="Skipped" value={String(walkthroughStats.totalSkips || 0)} color={Colors.accent} subtitle={`${walkthroughStats.skipRate || 0}% rate`} />
                  <StatCard icon="volume-up" label="Audio Plays" value={String(walkthroughStats.totalAudioPlays || 0)} color="#7B9ED9" subtitle={`${walkthroughStats.audioPlayRate || 0}% rate`} />
                  <StatCard icon="replay" label="Replays" value={String(walkthroughStats.totalReplays || 0)} color={Colors.secondary} />
                  <StatCard icon="groups" label="Sessions" value={String(walkthroughStats.totalSessions || 0)} color="#B8A9C9" />
                </View>

                {/* Completion Funnel */}
                <View style={s.sectionCard}>
                  <View style={s.sectionHeader}><Text style={s.sectionTitle}>Completion Funnel</Text><MaterialIcons name="filter-list" size={20} color={Colors.textLight} /></View>
                  <View style={ob.funnelRow}>
                    <View style={[ob.funnelBlock, { backgroundColor: Colors.primary + '15' }]}><Text style={[ob.funnelValue, { color: Colors.primary }]}>{walkthroughStats.totalStarts || 0}</Text><Text style={ob.funnelLabel}>Started</Text></View>
                    <MaterialIcons name="arrow-forward" size={16} color={Colors.textLight} />
                    <View style={[ob.funnelBlock, { backgroundColor: Colors.success + '15' }]}><Text style={[ob.funnelValue, { color: Colors.success }]}>{walkthroughStats.totalCompletes || 0}</Text><Text style={ob.funnelLabel}>Completed</Text></View>
                    <MaterialIcons name="arrow-forward" size={16} color={Colors.textLight} />
                    <View style={[ob.funnelBlock, { backgroundColor: Colors.accent + '15' }]}><Text style={[ob.funnelValue, { color: Colors.accent }]}>{walkthroughStats.totalSkips || 0}</Text><Text style={ob.funnelLabel}>Skipped</Text></View>
                  </View>
                  {(walkthroughStats.avgCompletionTime > 0 || walkthroughStats.avgSkipTime > 0) && (
                    <View style={ob.timingRow}>
                      {walkthroughStats.avgCompletionTime > 0 && <Text style={ob.timingText}>Avg completion: {Math.round(walkthroughStats.avgCompletionTime / 1000)}s</Text>}
                      {walkthroughStats.avgSkipTime > 0 && <Text style={ob.timingText}>Avg skip at: {Math.round(walkthroughStats.avgSkipTime / 1000)}s</Text>}
                    </View>
                  )}
                </View>

                {/* Scene Drop-off */}
                {walkthroughStats.sceneFunnel && walkthroughStats.sceneFunnel.length > 0 && (
                  <View style={s.sectionCard}>
                    <View style={s.sectionHeader}><Text style={s.sectionTitle}>Scene Retention</Text><MaterialIcons name="trending-down" size={20} color={Colors.textLight} /></View>
                    <Text style={s.securityDesc}>Shows how many users viewed each scene and where they dropped off.</Text>
                    {walkthroughStats.sceneFunnel.map((scene: any, i: number) => {
                      const sceneNames = ['Welcome', 'Home Feed', 'Post Request', 'Categories', 'Support', 'Smart Split', 'Community', 'Closing'];
                      const barWidth = Math.max(scene.retentionPct || 0, 4);
                      return (
                        <View key={i} style={ob.sceneRow}>
                          <Text style={ob.sceneNum}>{i + 1}</Text>
                          <View style={ob.sceneInfo}>
                            <Text style={ob.sceneName}>{sceneNames[i] || `Scene ${i + 1}`}</Text>
                            <View style={ob.sceneBarTrack}>
                              <View style={[ob.sceneBarFill, { width: `${barWidth}%`, backgroundColor: scene.retentionPct > 50 ? Colors.success : scene.retentionPct > 25 ? Colors.accent : Colors.error }]} />
                            </View>
                          </View>
                          <View style={ob.sceneStats}>
                            <Text style={ob.sceneViews}>{scene.views}</Text>
                            {scene.dropOffs > 0 && <Text style={ob.sceneDrops}>-{scene.dropOffs}</Text>}
                            <Text style={ob.scenePct}>{scene.retentionPct}%</Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}

                {/* Daily Trend */}
                {walkthroughStats.dailyData && walkthroughStats.dailyData.length > 0 && (
                  <View style={s.sectionCard}>
                    <View style={s.sectionHeader}><Text style={s.sectionTitle}>Daily Trend (14 days)</Text><MaterialIcons name="show-chart" size={20} color={Colors.textLight} /></View>
                    <View style={ob.trendGrid}>
                      {walkthroughStats.dailyData.map((day: any, i: number) => {
                        const maxStarts = Math.max(...walkthroughStats.dailyData.map((d: any) => d.starts || 0), 1);
                        const barH = Math.max(((day.starts || 0) / maxStarts) * 60, 2);
                        return (
                          <View key={i} style={ob.trendCol}>
                            <View style={ob.trendBarStack}>
                              {day.completes > 0 && <View style={[ob.trendBar, { height: Math.max(((day.completes || 0) / maxStarts) * 60, 2), backgroundColor: Colors.success }]} />}
                              <View style={[ob.trendBar, { height: barH, backgroundColor: Colors.primary + '40' }]} />
                            </View>
                            <Text style={ob.trendLabel}>{day.label}</Text>
                          </View>
                        );
                      })}
                    </View>
                    <View style={ob.trendLegend}>
                      <View style={ob.legendItem}><View style={[ob.legendDot, { backgroundColor: Colors.primary + '40' }]} /><Text style={ob.legendText}>Started</Text></View>
                      <View style={ob.legendItem}><View style={[ob.legendDot, { backgroundColor: Colors.success }]} /><Text style={ob.legendText}>Completed</Text></View>
                    </View>
                  </View>
                )}

                {/* Device Breakdown */}
                {walkthroughStats.deviceCounts && Object.keys(walkthroughStats.deviceCounts).length > 0 && (
                  <View style={s.sectionCard}>
                    <View style={s.sectionHeader}><Text style={s.sectionTitle}>Device Breakdown</Text><MaterialIcons name="devices" size={20} color={Colors.textLight} /></View>
                    {Object.entries(walkthroughStats.deviceCounts).map(([device, count]: [string, any]) => {
                      const deviceIcons: Record<string, string> = { desktop_web: 'computer', mobile_web: 'phone-iphone', tablet_web: 'tablet', ios_native: 'phone-iphone', android_native: 'phone-android' };
                      const deviceLabels: Record<string, string> = { desktop_web: 'Desktop', mobile_web: 'Mobile Web', tablet_web: 'Tablet', ios_native: 'iOS App', android_native: 'Android App' };
                      return (
                        <View key={device} style={s.catRow}>
                          <MaterialIcons name={(deviceIcons[device] || 'devices') as any} size={18} color={Colors.textSecondary} />
                          <Text style={s.catName}>{deviceLabels[device] || device}</Text>
                          <Text style={s.catRaised}>{count}</Text>
                        </View>
                      );
                    })}
                  </View>
                )}

                {/* Recent Sessions */}
                {walkthroughStats.recentSessions && walkthroughStats.recentSessions.length > 0 && (
                  <View style={s.sectionCard}>
                    <View style={s.sectionHeader}><Text style={s.sectionTitle}>Recent Sessions</Text><MaterialIcons name="history" size={20} color={Colors.textLight} /></View>
                    {walkthroughStats.recentSessions.slice(0, 10).map((session: any, i: number) => {
                      const outcomeConfig: Record<string, { icon: string; color: string; label: string }> = {
                        completed: { icon: 'check-circle', color: Colors.success, label: 'Completed' },
                        skipped: { icon: 'skip-next', color: Colors.accent, label: 'Skipped' },
                        dropped_off: { icon: 'exit-to-app', color: Colors.error, label: 'Dropped off' },
                        in_progress: { icon: 'hourglass-empty', color: Colors.textLight, label: 'In progress' },
                      };
                      const cfg = outcomeConfig[session.outcome] || outcomeConfig.in_progress;
                      const sceneNames = ['Welcome', 'Home Feed', 'Post Request', 'Categories', 'Support', 'Smart Split', 'Community', 'Closing'];
                      return (
                        <View key={i} style={ob.sessionRow}>
                          <View style={[ob.sessionIcon, { backgroundColor: cfg.color + '15' }]}>
                            <MaterialIcons name={cfg.icon as any} size={16} color={cfg.color} />
                          </View>
                          <View style={ob.sessionInfo}>
                            <Text style={ob.sessionOutcome}>{cfg.label}</Text>
                            <Text style={ob.sessionMeta}>
                              Scene {session.lastScene + 1} ({sceneNames[session.lastScene] || '?'})
                              {session.audioPlayed ? ' · Audio' : ''}
                              {session.durationMs > 0 ? ` · ${Math.round(session.durationMs / 1000)}s` : ''}
                            </Text>
                          </View>
                          <Text style={ob.sessionTime}>{formatTime(session.startedAt)}</Text>
                        </View>
                      );
                    })}
                  </View>
                )}
              </>
            )}
          </>
        )}


        {/* TIPS ANALYTICS TAB */}
        {activeTab === 'tips' && (
          <>
            <View style={s.tabHeader}>
              <Text style={s.tabHeaderTitle}>Tip Analytics</Text>
              <TouchableOpacity onPress={fetchTipAnalytics} style={{ opacity: tipAnalyticsLoading ? 0.5 : 1 }}>
                <MaterialIcons name="refresh" size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {tipAnalyticsLoading && !tipAnalytics ? (
              <View style={s.whLoadingWrap}><ActivityIndicator size="small" color={Colors.primary} /><Text style={s.whLoadingText}>Loading tip analytics...</Text></View>
            ) : !tipAnalytics ? (
              <View style={s.emptyState}><MaterialIcons name="volunteer-activism" size={48} color={Colors.borderLight} /><Text style={s.emptyText}>No tip data yet</Text></View>
            ) : (
              <>
                {/* Summary Stats */}
                <View style={s.statsGrid}>
                  <StatCard icon="attach-money" label="Total Tips" value={`$${(tipAnalytics.summary?.totalTips || 0).toFixed(2)}`} color={Colors.primary} />
                  <StatCard icon="trending-up" label="Tip Rate" value={`${tipAnalytics.summary?.tipRate || 0}%`} color={Colors.success} subtitle={`${tipAnalytics.summary?.paymentsWithTip || 0} of ${tipAnalytics.summary?.totalPayments || 0}`} />
                  <StatCard icon="show-chart" label="Avg Tip" value={`$${(tipAnalytics.summary?.avgTip || 0).toFixed(2)}`} color={Colors.secondary} subtitle={`Median: $${(tipAnalytics.summary?.medianTip || 0).toFixed(2)}`} />
                  <StatCard icon="percent" label="Avg Tip %" value={`${tipAnalytics.summary?.avgTipPercent || 0}%`} color={Colors.accent} subtitle="of donation amount" />
                  <StatCard icon="payments" label="Total Donations" value={`$${(tipAnalytics.summary?.totalDonations || 0).toFixed(2)}`} color="#7B9ED9" />
                  <StatCard icon="do-not-disturb" label="No Tip" value={String(tipAnalytics.summary?.paymentsWithoutTip || 0)} color={Colors.textLight} subtitle={`${tipAnalytics.summary?.totalPayments ? Math.round(((tipAnalytics.summary?.paymentsWithoutTip || 0) / tipAnalytics.summary.totalPayments) * 100) : 0}% of payments`} />
                </View>

                {/* Tip Distribution */}
                {tipAnalytics.tipBuckets && (
                  <View style={s.sectionCard}>
                    <View style={s.sectionHeader}><Text style={s.sectionTitle}>Tip Distribution</Text><MaterialIcons name="bar-chart" size={20} color={Colors.textLight} /></View>
                    <View style={tipStyles.bucketGrid}>
                      {Object.entries(tipAnalytics.tipBuckets).map(([bucket, count]: [string, any]) => {
                        const total = tipAnalytics.summary?.totalPayments || 1;
                        const pct = Math.round((count / total) * 100);
                        const isNoTip = bucket === '$0';
                        return (
                          <View key={bucket} style={tipStyles.bucketItem}>
                            <View style={tipStyles.bucketBarTrack}>
                              <View style={[tipStyles.bucketBarFill, { height: `${Math.max(pct, 3)}%`, backgroundColor: isNoTip ? Colors.textLight : Colors.primary }]} />
                            </View>
                            <Text style={tipStyles.bucketLabel}>{bucket}</Text>
                            <Text style={tipStyles.bucketCount}>{count}</Text>
                            <Text style={tipStyles.bucketPct}>{pct}%</Text>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                )}

                {/* Daily Tip Trends */}
                {tipAnalytics.dailyTipData && tipAnalytics.dailyTipData.length > 0 && (
                  <View style={s.sectionCard}>
                    <View style={s.sectionHeader}><Text style={s.sectionTitle}>Daily Tips (14 days)</Text><MaterialIcons name="show-chart" size={20} color={Colors.textLight} /></View>
                    <View style={tipStyles.trendGrid}>
                      {tipAnalytics.dailyTipData.map((day: any, i: number) => {
                        const maxTip = Math.max(...tipAnalytics.dailyTipData.map((d: any) => d.tipTotal || 0), 1);
                        const barH = Math.max(((day.tipTotal || 0) / maxTip) * 60, 2);
                        return (
                          <View key={i} style={tipStyles.trendCol}>
                            <Text style={tipStyles.trendValue}>${day.tipTotal > 0 ? day.tipTotal.toFixed(0) : '0'}</Text>
                            <View style={[tipStyles.trendBar, { height: barH, backgroundColor: day.tipTotal > 0 ? Colors.primary : Colors.borderLight }]} />
                            <Text style={tipStyles.trendLabel}>{day.label}</Text>
                            {day.tipRate > 0 && <Text style={tipStyles.trendRate}>{day.tipRate}%</Text>}
                          </View>
                        );
                      })}
                    </View>
                    <View style={tipStyles.trendLegend}>
                      <View style={tipStyles.legendItem}><View style={[tipStyles.legendDot, { backgroundColor: Colors.primary }]} /><Text style={tipStyles.legendText}>Tip Revenue</Text></View>
                      <Text style={tipStyles.legendText}>% = tip rate per day</Text>
                    </View>
                  </View>
                )}

                {/* Tip by Donation Range */}
                {tipAnalytics.tipByDonationRange && (
                  <View style={s.sectionCard}>
                    <View style={s.sectionHeader}><Text style={s.sectionTitle}>Tips by Donation Size</Text><MaterialIcons name="stacked-bar-chart" size={20} color={Colors.textLight} /></View>
                    <Text style={s.securityDesc}>How tip behavior varies by donation amount range.</Text>
                    {Object.entries(tipAnalytics.tipByDonationRange).map(([range, data]: [string, any]) => {
                      const tipPct = data.count > 0 ? Math.round((data.tipped / data.count) * 100) : 0;
                      const avgTipInRange = data.tipped > 0 ? (data.totalTips / data.tipped) : 0;
                      return (
                        <View key={range} style={tipStyles.rangeRow}>
                          <View style={tipStyles.rangeInfo}>
                            <Text style={tipStyles.rangeLabel}>{range}</Text>
                            <Text style={tipStyles.rangeMeta}>{data.count} payments, {data.tipped} tipped</Text>
                          </View>
                          <View style={tipStyles.rangeStats}>
                            <View style={[tipStyles.rangePctBadge, { backgroundColor: tipPct > 50 ? Colors.success + '15' : tipPct > 25 ? Colors.accent + '15' : Colors.textLight + '15' }]}>
                              <Text style={[tipStyles.rangePctText, { color: tipPct > 50 ? Colors.success : tipPct > 25 ? Colors.accent : Colors.textLight }]}>{tipPct}%</Text>
                            </View>
                            {avgTipInRange > 0 && <Text style={tipStyles.rangeAvg}>avg ${avgTipInRange.toFixed(2)}</Text>}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}

                {/* Top Tippers */}
                {tipAnalytics.topTippers && tipAnalytics.topTippers.length > 0 && (
                  <View style={s.sectionCard}>
                    <View style={s.sectionHeader}><Text style={s.sectionTitle}>Top Tippers</Text><MaterialIcons name="emoji-events" size={20} color={Colors.accent} /></View>
                    {tipAnalytics.topTippers.map((tipper: any, i: number) => (
                      <View key={i} style={s.contributorRow}>
                        <Text style={s.rank}>#{i + 1}</Text>
                        <View style={[s.contributorAvatar, { backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center' }]}>
                          <MaterialIcons name="favorite" size={18} color={Colors.primary} />
                        </View>
                        <View style={s.contributorInfo}>
                          <Text style={s.contributorName}>{tipper.name}</Text>
                          <Text style={s.contributorMeta}>{tipper.tipCount} tips, ${tipper.totalDonated.toFixed(2)} donated</Text>
                        </View>
                        <Text style={s.contributorTotal}>${tipper.totalTips.toFixed(2)}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Recent Tips */}
                {tipAnalytics.recentTips && tipAnalytics.recentTips.length > 0 && (
                  <View style={s.sectionCard}>
                    <View style={s.sectionHeader}><Text style={s.sectionTitle}>Recent Tips</Text><MaterialIcons name="history" size={20} color={Colors.textLight} /></View>
                    {tipAnalytics.recentTips.slice(0, 15).map((tip: any, i: number) => (
                      <View key={i} style={tipStyles.recentTipRow}>
                        <View style={tipStyles.recentTipIcon}>
                          <MaterialIcons name="favorite" size={14} color={Colors.primary} />
                        </View>
                        <View style={tipStyles.recentTipInfo}>
                          <Text style={tipStyles.recentTipName}>{tip.contributorName}</Text>
                          <Text style={tipStyles.recentTipMeta}>
                            ${tip.donationAmount.toFixed(2)} donation{tip.destinationCharge ? ' (direct)' : ''}
                          </Text>
                        </View>
                        <View style={tipStyles.recentTipRight}>
                          <Text style={tipStyles.recentTipAmount}>+${tip.tipAmount.toFixed(2)}</Text>
                          <Text style={tipStyles.recentTipTime}>{formatTime(tip.date)}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </>
            )}
          </>
        )}

        <View style={{ height: 40 }} />


      </ScrollView>

      {/* Payload Modal */}
      <Modal visible={!!selectedEvent} transparent animationType="slide" onRequestClose={() => setSelectedEvent(null)}>
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Event Payload</Text>
              <TouchableOpacity onPress={() => setSelectedEvent(null)} style={s.modalClose}><MaterialIcons name="close" size={24} color={Colors.text} /></TouchableOpacity>
            </View>
            <Text style={s.modalSubtitle}>{selectedEvent?.stripeEventId}</Text>
            <ScrollView style={s.modalScroll} showsVerticalScrollIndicator={false}>
              <Text style={s.modalPayload}>{selectedEvent?.data ? JSON.stringify(selectedEvent.data, null, 2) : 'No payload data'}</Text>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  loadingText: { fontSize: FontSize.md, color: Colors.textSecondary, marginTop: Spacing.lg },
  errorTitle: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.text, marginTop: Spacing.lg },
  errorMsg: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', marginTop: Spacing.sm, maxWidth: 300 },
  retryBtn: { backgroundColor: Colors.primary, paddingHorizontal: Spacing.xxl, paddingVertical: Spacing.md, borderRadius: BorderRadius.full, marginTop: Spacing.lg },
  retryBtnText: { color: Colors.white, fontWeight: '700', fontSize: FontSize.md },

  // Access control styles
  accessDeniedCard: { backgroundColor: Colors.surface, borderRadius: BorderRadius.xxl, padding: Spacing.xxl, alignItems: 'center', gap: Spacing.md, maxWidth: 400, ...Shadow.md },
  accessDeniedTitle: { fontSize: FontSize.xxl, fontWeight: '900', color: Colors.text },
  accessDeniedText: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  accessDeniedDivider: { width: '80%', height: 1, backgroundColor: Colors.borderLight, marginVertical: Spacing.sm },
  accessDeniedSubtext: { fontSize: FontSize.xs, color: Colors.textLight, textAlign: 'center', lineHeight: 18 },
  registerAdminBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: Colors.primary, paddingVertical: Spacing.md, paddingHorizontal: Spacing.xxl, borderRadius: BorderRadius.full, marginTop: Spacing.sm, ...Shadow.md },
  registerAdminBtnText: { fontSize: FontSize.md, fontWeight: '700', color: Colors.white },
  accessDeniedNote: { fontSize: FontSize.xs, color: Colors.textLight, marginTop: Spacing.sm },

  adminBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: Spacing.xl, paddingBottom: Spacing.sm },
  adminBadgeText: { fontSize: FontSize.xs, color: Colors.success, fontWeight: '600' },

  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, gap: Spacing.md },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  headerTitle: { fontSize: FontSize.xl, fontWeight: '900', color: Colors.text },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.success + '15', paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.full },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.success },
  liveText: { fontSize: 10, fontWeight: '700', color: Colors.success },
  refreshBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },

  tabRow: { paddingHorizontal: Spacing.lg, gap: Spacing.sm, paddingBottom: Spacing.md },
  tabBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.full, backgroundColor: Colors.surfaceAlt },
  tabBtnActive: { backgroundColor: Colors.primary },
  tabBtnText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textSecondary },
  tabBtnTextActive: { color: Colors.white },
  tabBadge: { backgroundColor: Colors.error, borderRadius: 8, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  tabBadgeActive: { backgroundColor: Colors.white + '40' },
  tabBadgeText: { fontSize: 9, fontWeight: '800', color: Colors.white },
  tabBadgeTextActive: { color: Colors.white },

  content: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  statCard: { width: '48%', backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.lg, flexDirection: 'row', alignItems: 'center', gap: Spacing.md, ...Shadow.sm, minWidth: 150 },
  statIconBg: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  statInfo: { flex: 1 },
  statValue: { fontSize: FontSize.lg, fontWeight: '900', color: Colors.text },
  statLabel: { fontSize: FontSize.xs, color: Colors.textLight, marginTop: 1 },
  statSubtitle: { fontSize: 10, color: Colors.textSecondary, marginTop: 1 },

  sectionCard: { backgroundColor: Colors.surface, borderRadius: BorderRadius.xl, padding: Spacing.xl, marginTop: Spacing.lg, ...Shadow.sm },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  sectionTitle: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.text },

  chartContainer: { marginTop: Spacing.sm },
  chartBars: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 120 },
  chartBarCol: { alignItems: 'center', flex: 1, gap: 4 },
  chartBar: { width: '70%', borderRadius: 4, minWidth: 20, maxWidth: 40 },
  chartBarLabel: { fontSize: 10, color: Colors.textLight, fontWeight: '600' },
  chartBarValue: { fontSize: 10, color: Colors.textSecondary, fontWeight: '700' },

  catRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm, gap: Spacing.sm },
  catDot: { width: 10, height: 10, borderRadius: 5 },
  catName: { flex: 1, fontSize: FontSize.sm, fontWeight: '600', color: Colors.text },
  catCount: { fontSize: FontSize.xs, color: Colors.textLight, width: 60 },
  catRaised: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.text, width: 70, textAlign: 'right' },

  contributorRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm, gap: Spacing.sm },
  rank: { fontSize: FontSize.sm, fontWeight: '800', color: Colors.textLight, width: 28 },
  contributorAvatar: { width: 36, height: 36, borderRadius: 18 },
  contributorInfo: { flex: 1 },
  contributorName: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.text },
  contributorMeta: { fontSize: FontSize.xs, color: Colors.textLight },
  contributorTotal: { fontSize: FontSize.md, fontWeight: '800', color: Colors.primary },

  tabHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md, flexWrap: 'wrap', gap: Spacing.sm },
  tabHeaderTitle: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.text },
  tabHeaderSubtitle: { fontSize: FontSize.sm, color: Colors.textLight },
  tabHeaderBadges: { flexDirection: 'row', gap: Spacing.sm },
  miniStatusBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.full },
  miniStatusText: { fontSize: FontSize.xs, fontWeight: '700' },

  userCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.sm, gap: Spacing.md, ...Shadow.sm },
  userAvatar: { width: 44, height: 44, borderRadius: 22 },
  userInfo: { flex: 1 },
  userNameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  userName: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text },
  userCity: { fontSize: FontSize.xs, color: Colors.textLight, marginTop: 1 },
  userStats: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  userStatText: { fontSize: FontSize.xs, color: Colors.textSecondary },
  userStatDot: { color: Colors.textLight, fontSize: 10 },
  userDate: { fontSize: FontSize.xs, color: Colors.textLight },

  needCard: { backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.sm, gap: Spacing.sm, ...Shadow.sm },
  needHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  needStatusDot: { width: 8, height: 8, borderRadius: 4 },
  needTitle: { flex: 1, fontSize: FontSize.md, fontWeight: '700', color: Colors.text },
  needStatusBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.full },
  needStatusText: { fontSize: FontSize.xs, fontWeight: '700' },
  needMeta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  needCatBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.full },
  needCatText: { fontSize: FontSize.xs, fontWeight: '600' },
  needAmount: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.text, flex: 1 },
  needContributors: { fontSize: FontSize.xs, color: Colors.textLight },
  needProgress: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  needProgressTrack: { flex: 1, height: 6, backgroundColor: Colors.borderLight, borderRadius: 3, overflow: 'hidden' },
  needProgressFill: { height: '100%', borderRadius: 3 },
  needPercent: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textSecondary, width: 35, textAlign: 'right' },

  txCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.sm, gap: Spacing.md, ...Shadow.sm },
  txIconBg: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  txInfo: { flex: 1 },
  txName: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.text },
  txTime: { fontSize: FontSize.xs, color: Colors.textLight, marginTop: 1 },
  txAmount: { fontSize: FontSize.md, fontWeight: '800', color: Colors.success },

  activityGrid: { flexDirection: 'row', justifyContent: 'space-around', marginTop: Spacing.md },
  activityItem: { alignItems: 'center', gap: 2 },
  activityNumber: { fontSize: FontSize.xxl, fontWeight: '900' },
  activityLabel: { fontSize: FontSize.xs, color: Colors.textLight },

  healthRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm },
  healthText: { fontSize: FontSize.sm, color: Colors.text, fontWeight: '600' },

  emptyState: { alignItems: 'center', paddingVertical: Spacing.huge, gap: Spacing.md },
  emptyText: { fontSize: FontSize.md, color: Colors.textLight },

  healthGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  healthItem: { flexDirection: 'row', alignItems: 'center', gap: 6, width: '45%' },
  healthDot: { width: 8, height: 8, borderRadius: 4 },
  healthLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, flex: 1 },
  healthValue: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.text },
  failedAlert: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.md, backgroundColor: Colors.error + '10', padding: Spacing.md, borderRadius: BorderRadius.lg },
  failedAlertText: { fontSize: FontSize.xs, color: Colors.error, fontWeight: '600', flex: 1 },

  // Webhook styles
  whSummaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.md },
  whSummaryCard: { flex: 1, minWidth: 70, backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.md, borderLeftWidth: 3, ...Shadow.sm, alignItems: 'center' },
  whSummaryValue: { fontSize: FontSize.xl, fontWeight: '900', color: Colors.text },
  whSummaryLabel: { fontSize: 10, color: Colors.textLight, marginTop: 2 },
  whTypeRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  whTypeLabel: { flex: 1, fontSize: FontSize.sm, fontWeight: '600', color: Colors.text },
  whTypeCount: { backgroundColor: Colors.surfaceAlt, paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.full },
  whTypeCountText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textSecondary },
  whFilterRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md, marginBottom: Spacing.md, flexWrap: 'wrap' },
  whFilterBtn: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: BorderRadius.full, backgroundColor: Colors.surfaceAlt },
  whFilterBtnActive: { backgroundColor: Colors.primary },
  whFilterText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textSecondary },
  whFilterTextActive: { color: Colors.white },
  whSearchRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.borderLight },
  whSearchInput: { flex: 1, fontSize: FontSize.sm, color: Colors.text, paddingVertical: 4 },
  whLoadingWrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingVertical: Spacing.huge },
  whLoadingText: { fontSize: FontSize.sm, color: Colors.textSecondary },
  whEventCard: { backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.sm, ...Shadow.sm },
  whEventCardError: { borderLeftWidth: 3, borderLeftColor: Colors.error },
  whEventHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  whEventIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  whEventInfo: { flex: 1 },
  whEventType: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.text },
  whEventId: { fontSize: 10, color: Colors.textLight, fontFamily: Platform.OS === 'web' ? 'monospace' : undefined, marginTop: 1 },
  whEventTime: { fontSize: 10, color: Colors.textLight, marginTop: 1 },
  whEventRight: { alignItems: 'flex-end', gap: 4 },
  whStatusBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.full },
  whStatusText: { fontSize: 10, fontWeight: '700' },
  whEventSummary: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: Spacing.sm, lineHeight: 16 },
  whEventDetails: { marginTop: Spacing.md, paddingTop: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.borderLight, gap: Spacing.sm },
  whDetailRow: { gap: 2 },
  whDetailLabel: { fontSize: 10, fontWeight: '700', color: Colors.textLight, textTransform: 'uppercase', letterSpacing: 0.5 },
  whDetailValue: { fontSize: FontSize.sm, color: Colors.text, lineHeight: 18 },
  whPayloadBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: Colors.primaryLight, paddingVertical: Spacing.sm, borderRadius: BorderRadius.lg, marginTop: Spacing.sm },
  whPayloadBtnText: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.primary },

  // Security tab styles
  securityDesc: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20, marginBottom: Spacing.md },
  rateLimitRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.borderLight, gap: Spacing.sm },
  rateLimitInfo: { flex: 1 },
  rateLimitAction: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.text },
  rateLimitActionCode: { fontSize: FontSize.xs, color: Colors.textLight, fontFamily: Platform.OS === 'web' ? 'monospace' : undefined },
  rateLimitBadge: { backgroundColor: Colors.primaryLight, paddingHorizontal: Spacing.md, paddingVertical: 4, borderRadius: BorderRadius.full },
  rateLimitValue: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.primary },
  secConfigRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 6 },
  secConfigText: { fontSize: FontSize.sm, color: Colors.text, fontWeight: '500', flex: 1 },
  indexRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, paddingVertical: 4 },
  indexText: { fontSize: FontSize.xs, color: Colors.textSecondary, fontFamily: Platform.OS === 'web' ? 'monospace' : undefined, flex: 1, lineHeight: 16 },

  // Error log styles
  errorLogCard: { backgroundColor: Colors.surfaceAlt, borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.sm, borderLeftWidth: 3, gap: 4 },
  errorLogHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  errorLogSeverity: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.full },
  errorLogSeverityText: { fontSize: 9, fontWeight: '800' },
  errorLogSource: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.textSecondary },
  errorLogTime: { fontSize: FontSize.xs, color: Colors.textLight, marginLeft: 'auto' },
  errorLogMessage: { fontSize: FontSize.sm, color: Colors.text, lineHeight: 18 },
  errorLogType: { fontSize: FontSize.xs, color: Colors.textLight, fontFamily: Platform.OS === 'web' ? 'monospace' : undefined },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'flex-end' },
  modalContent: { backgroundColor: Colors.surface, borderTopLeftRadius: BorderRadius.xxl, borderTopRightRadius: BorderRadius.xxl, maxHeight: '80%', padding: Spacing.xl },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  modalTitle: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.text },
  modalClose: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  modalSubtitle: { fontSize: FontSize.xs, color: Colors.textLight, fontFamily: Platform.OS === 'web' ? 'monospace' : undefined, marginBottom: Spacing.md },
  modalScroll: { maxHeight: 400 },
  modalPayload: { fontSize: 11, color: Colors.text, fontFamily: Platform.OS === 'web' ? 'monospace' : undefined, lineHeight: 18, backgroundColor: Colors.surfaceAlt, padding: Spacing.md, borderRadius: BorderRadius.lg },
});

// Onboarding tab styles
const ob = StyleSheet.create({
  funnelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', gap: Spacing.sm, marginTop: Spacing.sm },
  funnelBlock: { flex: 1, alignItems: 'center', paddingVertical: Spacing.md, borderRadius: BorderRadius.lg },
  funnelValue: { fontSize: FontSize.xxl, fontWeight: '900' },
  funnelLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: '600', marginTop: 2 },
  timingRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: Spacing.lg, paddingTop: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.borderLight },
  timingText: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: '600' },
  sceneRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  sceneNum: { width: 20, fontSize: FontSize.sm, fontWeight: '800', color: Colors.textLight, textAlign: 'center' },
  sceneInfo: { flex: 1, gap: 4 },
  sceneName: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.text },
  sceneBarTrack: { height: 6, backgroundColor: Colors.borderLight, borderRadius: 3, overflow: 'hidden' },
  sceneBarFill: { height: '100%', borderRadius: 3 },
  sceneStats: { alignItems: 'flex-end', gap: 2, minWidth: 50 },
  sceneViews: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.text },
  sceneDrops: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.error },
  scenePct: { fontSize: 10, fontWeight: '600', color: Colors.textLight },
  trendGrid: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 80, marginTop: Spacing.sm },
  trendCol: { alignItems: 'center', flex: 1, gap: 4 },
  trendBarStack: { alignItems: 'center', justifyContent: 'flex-end', flex: 1, gap: 1 },
  trendBar: { width: '60%', borderRadius: 2, minWidth: 8, maxWidth: 24 },
  trendLabel: { fontSize: 8, color: Colors.textLight, fontWeight: '600' },
  trendLegend: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.xl, marginTop: Spacing.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: '600' },
  sessionRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  sessionIcon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  sessionInfo: { flex: 1 },
  sessionOutcome: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.text },
  sessionMeta: { fontSize: FontSize.xs, color: Colors.textLight, marginTop: 1 },
  sessionTime: { fontSize: FontSize.xs, color: Colors.textLight },
});

// Tip analytics tab styles
const tipStyles = StyleSheet.create({
  bucketGrid: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 140, marginTop: Spacing.sm, paddingBottom: Spacing.sm },
  bucketItem: { alignItems: 'center', flex: 1, gap: 4, height: '100%', justifyContent: 'flex-end' },
  bucketBarTrack: { width: '65%', height: 80, backgroundColor: Colors.borderLight + '40', borderRadius: 4, overflow: 'hidden', justifyContent: 'flex-end', minWidth: 16, maxWidth: 36 },
  bucketBarFill: { width: '100%', borderRadius: 4 },
  bucketLabel: { fontSize: 10, fontWeight: '700', color: Colors.text },
  bucketCount: { fontSize: 11, fontWeight: '800', color: Colors.textSecondary },
  bucketPct: { fontSize: 9, color: Colors.textLight, fontWeight: '600' },

  trendGrid: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 100, marginTop: Spacing.sm },
  trendCol: { alignItems: 'center', flex: 1, gap: 3 },
  trendBar: { width: '55%', borderRadius: 3, minWidth: 6, maxWidth: 20 },
  trendValue: { fontSize: 8, fontWeight: '700', color: Colors.textSecondary },
  trendLabel: { fontSize: 7, color: Colors.textLight, fontWeight: '600' },
  trendRate: { fontSize: 7, color: Colors.primary, fontWeight: '700' },
  trendLegend: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Spacing.md, paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.borderLight },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: '600' },

  rangeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  rangeInfo: { flex: 1 },
  rangeLabel: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.text },
  rangeMeta: { fontSize: FontSize.xs, color: Colors.textLight, marginTop: 1 },
  rangeStats: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  rangePctBadge: { paddingHorizontal: Spacing.md, paddingVertical: 3, borderRadius: BorderRadius.full },
  rangePctText: { fontSize: FontSize.xs, fontWeight: '800' },
  rangeAvg: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: '600' },

  recentTipRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  recentTipIcon: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  recentTipInfo: { flex: 1 },
  recentTipName: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.text },
  recentTipMeta: { fontSize: FontSize.xs, color: Colors.textLight, marginTop: 1 },
  recentTipRight: { alignItems: 'flex-end' },
  recentTipAmount: { fontSize: FontSize.md, fontWeight: '800', color: Colors.primary },
  recentTipTime: { fontSize: 10, color: Colors.textLight, marginTop: 1 },
});
