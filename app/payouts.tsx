import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Platform, RefreshControl, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, BorderRadius, FontSize, Spacing, Shadow, CategoryColors } from '@/app/lib/theme';
import { useApp } from '@/app/lib/store';
import { supabase } from '@/app/lib/supabase';

function StatBox({ label, value, color, icon, subtitle }: { label: string; value: string; color: string; icon: string; subtitle?: string }) {
  return (
    <View style={s.statBox}>
      <View style={[s.statBoxIcon, { backgroundColor: color + '15' }]}>
        <MaterialIcons name={icon as any} size={20} color={color} />
      </View>
      <Text style={s.statBoxValue}>{value}</Text>
      <Text style={s.statBoxLabel}>{label}</Text>
      {subtitle ? <Text style={s.statBoxSub}>{subtitle}</Text> : null}
    </View>
  );
}

function MiniBarChart({ data, maxHeight = 70 }: { data: { month: string; net: number; count: number }[]; maxHeight?: number }) {
  const maxVal = Math.max(...data.map(d => d.net), 1);
  return (
    <View style={s.chartWrap}>
      {data.map((d, i) => (
        <View key={i} style={s.chartCol}>
          <View style={[s.chartBar, { height: Math.max((d.net / maxVal) * maxHeight, 3), backgroundColor: d.net > 0 ? Colors.success : Colors.borderLight }]} />
          <Text style={s.chartLabel}>{d.month}</Text>
          {d.net > 0 && <Text style={s.chartVal}>${d.net.toFixed(0)}</Text>}
        </View>
      ))}
    </View>
  );
}

export default function PayoutDashboard() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { payoutDashboard, fetchPayoutDashboard, payoutStatus, setupPayouts, isLoggedIn, currentUser } = useApp();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [setupLoading, setSetupLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    await fetchPayoutDashboard();
    setLoading(false);
    setRefreshing(false);
  }, [fetchPayoutDashboard]);

  useEffect(() => { loadData(); }, []);

  const handleSetup = async () => {
    setSetupLoading(true);
    const result = await setupPayouts();
    if (result.onboardingUrl && Platform.OS === 'web') {
      window.location.href = result.onboardingUrl;
    }
    setSetupLoading(false);
  };

  const handleExportCSV = async () => {
    if (currentUser.id === 'guest') return;
    setExporting(true);
    setExportSuccess(false);
    try {
      const { data, error } = await supabase.functions.invoke('stripe-checkout', {
        body: { action: 'export_payout_csv', userId: currentUser.id },
      });
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || 'Export failed');

      const csvContent = data.csv;
      const filename = data.filename || `spotme-payouts-${new Date().toISOString().split('T')[0]}.csv`;

      if (Platform.OS === 'web') {
        // Create blob and download
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        setExportSuccess(true);
        setTimeout(() => setExportSuccess(false), 3000);
      } else {
        Alert.alert('Export Ready', 'CSV export is available on web. Please use the web version to download.');
      }
    } catch (err: any) {
      if (Platform.OS === 'web') {
        alert('Export failed: ' + (err.message || 'Unknown error'));
      } else {
        Alert.alert('Export Failed', err.message || 'Unknown error');
      }
    }
    setExporting(false);
  };

  const topPadding = Platform.OS === 'web' ? 16 : insets.top;
  const db = payoutDashboard;
  const isActive = payoutStatus?.payoutsEnabled || db?.account?.payoutsEnabled;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Collecting': return Colors.primary;
      case 'Goal Met': return Colors.success;
      case 'Payout Requested': return Colors.accent;
      case 'Paid': return Colors.secondary;
      default: return Colors.textLight;
    }
  };

  const formatTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch { return ''; }
  };

  if (!isLoggedIn) {
    return (
      <View style={[s.container, s.center, { paddingTop: topPadding }]}>
        <MaterialIcons name="lock" size={48} color={Colors.textLight} />
        <Text style={s.emptyTitle}>Sign in to view payouts</Text>
        <TouchableOpacity style={s.signInBtn} onPress={() => router.push('/auth')}>
          <Text style={s.signInBtnText}>Sign In</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[s.container, s.center, { paddingTop: topPadding }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={s.loadingText}>Loading payout dashboard...</Text>
      </View>
    );
  }

  const hasData = db?.needs && db.needs.length > 0;

  return (
    <View style={[s.container, { paddingTop: topPadding }]}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Payout Dashboard</Text>
        <View style={s.headerActions}>
          {/* Export CSV Button */}
          {hasData && (
            <TouchableOpacity
              style={[s.exportBtn, exportSuccess && s.exportBtnSuccess]}
              onPress={handleExportCSV}
              disabled={exporting}
              activeOpacity={0.7}
            >
              {exporting ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : exportSuccess ? (
                <>
                  <MaterialIcons name="check-circle" size={18} color={Colors.success} />
                  <Text style={[s.exportBtnText, { color: Colors.success }]}>Downloaded</Text>
                </>
              ) : (
                <>
                  <MaterialIcons name="file-download" size={18} color={Colors.primary} />
                  <Text style={s.exportBtnText}>CSV</Text>
                </>
              )}
            </TouchableOpacity>
          )}
          <TouchableOpacity style={s.refreshBtn} onPress={() => { setRefreshing(true); loadData(true); }}>
            <MaterialIcons name="refresh" size={22} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(true); }} tintColor={Colors.primary} />}
      >
        {/* Account Status */}
        <View style={[s.statusBanner, isActive ? s.statusActive : s.statusInactive]}>
          <MaterialIcons
            name={isActive ? 'check-circle' : 'account-balance-wallet'}
            size={28}
            color={isActive ? Colors.success : Colors.accent}
          />
          <View style={s.statusContent}>
            <Text style={s.statusTitle}>
              {isActive ? 'Stripe Connect Active' : 'Set Up Direct Payouts'}
            </Text>
            <Text style={s.statusDesc}>
              {isActive
                ? 'Contributions go directly to your bank. 5% platform fee auto-deducted.'
                : 'Connect your bank to receive funds directly from contributors.'}
            </Text>
          </View>
          {!isActive && (
            <TouchableOpacity style={s.setupBtn} onPress={handleSetup} disabled={setupLoading}>
              {setupLoading ? (
                <ActivityIndicator size="small" color={Colors.white} />
              ) : (
                <Text style={s.setupBtnText}>Set Up</Text>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Summary Stats */}
        {db?.summary && (
          <View style={s.statsGrid}>
            <StatBox icon="attach-money" label="Net Received" value={`$${db.summary.netReceived.toFixed(2)}`} color={Colors.success} />
            <StatBox icon="receipt" label="Total Payments" value={db.summary.totalPayments.toString()} color={Colors.primary} />
            <StatBox icon="swap-horiz" label="Direct Deposits" value={`$${db.summary.directDeposits.toFixed(2)}`} color={Colors.secondary} subtitle={`${db.summary.directDepositCount} transfers`} />
            <StatBox icon="hourglass-empty" label="Pending" value={`$${db.summary.pendingAmount.toFixed(2)}`} color={Colors.accent} />
            <StatBox icon="savings" label="Paid Out" value={`$${db.summary.paidAmount.toFixed(2)}`} color="#7B9ED9" />
            <StatBox icon="percent" label="Platform Fees" value={`$${db.summary.totalFees.toFixed(2)}`} color={Colors.textLight} subtitle="5% rate" />
          </View>
        )}

        {/* Monthly Chart */}
        {db?.monthlyData && db.monthlyData.some(m => m.net > 0) && (
          <View style={s.sectionCard}>
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>Monthly Earnings</Text>
              <MaterialIcons name="bar-chart" size={20} color={Colors.textLight} />
            </View>
            <MiniBarChart data={db.monthlyData} />
          </View>
        )}

        {/* Your Needs */}
        {db?.needs && db.needs.length > 0 && (
          <View style={s.sectionCard}>
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>Your Needs</Text>
              <Text style={s.sectionCount}>{db.needs.length}</Text>
            </View>
            {db.needs.map(need => (
              <TouchableOpacity key={need.id} style={s.needRow} onPress={() => router.push(`/need/${need.id}`)} activeOpacity={0.7}>
                <View style={s.needInfo}>
                  <View style={s.needTitleRow}>
                    <View style={[s.needDot, { backgroundColor: getStatusColor(need.status) }]} />
                    <Text style={s.needTitle} numberOfLines={1}>{need.title}</Text>
                  </View>
                  <View style={s.needMeta}>
                    <View style={[s.needCatBadge, { backgroundColor: (CategoryColors[need.category] || Colors.textLight) + '15' }]}>
                      <Text style={[s.needCatText, { color: CategoryColors[need.category] || Colors.textLight }]}>{need.category}</Text>
                    </View>
                    <Text style={s.needMetaText}>${need.raisedAmount} / ${need.goalAmount}</Text>
                    <Text style={s.needMetaText}>{need.contributorCount} spots</Text>
                  </View>
                  <View style={s.needProgress}>
                    <View style={s.needProgressTrack}>
                      <View style={[s.needProgressFill, { width: `${Math.min((need.raisedAmount / need.goalAmount) * 100, 100)}%`, backgroundColor: getStatusColor(need.status) }]} />
                    </View>
                  </View>
                  {need.directPayments > 0 && (
                    <View style={s.directBadge}>
                      <MaterialIcons name="swap-horiz" size={12} color={Colors.secondary} />
                      <Text style={s.directBadgeText}>{need.directPayments} direct deposit{need.directPayments > 1 ? 's' : ''}</Text>
                    </View>
                  )}
                </View>
                <View style={s.needRight}>
                  <View style={[s.needStatusBadge, { backgroundColor: getStatusColor(need.status) + '15' }]}>
                    <Text style={[s.needStatusText, { color: getStatusColor(need.status) }]}>{need.status}</Text>
                  </View>
                  <MaterialIcons name="chevron-right" size={20} color={Colors.textLight} />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Recent Transactions */}
        {db?.recentTransactions && db.recentTransactions.length > 0 && (
          <View style={s.sectionCard}>
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>Recent Transactions</Text>
              <Text style={s.sectionCount}>{db.recentTransactions.length}</Text>
            </View>
            {db.recentTransactions.map(tx => (
              <View key={tx.id} style={s.txRow}>
                <View style={[s.txIcon, { backgroundColor: tx.destinationCharge ? Colors.secondaryLight : Colors.primaryLight }]}>
                  <MaterialIcons
                    name={tx.destinationCharge ? 'swap-horiz' : 'favorite'}
                    size={16}
                    color={tx.destinationCharge ? Colors.secondaryDark : Colors.primary}
                  />
                </View>
                <View style={s.txInfo}>
                  <Text style={s.txName}>{tx.contributorName}</Text>
                  <Text style={s.txNeed} numberOfLines={1}>{tx.needTitle}</Text>
                  <View style={s.txBadges}>
                    {tx.destinationCharge && (
                      <View style={s.txDirectBadge}>
                        <Text style={s.txDirectBadgeText}>Direct</Text>
                      </View>
                    )}
                    {tx.webhookConfirmed && (
                      <View style={s.txVerifiedBadge}>
                        <MaterialIcons name="verified" size={10} color={Colors.success} />
                        <Text style={s.txVerifiedText}>Verified</Text>
                      </View>
                    )}
                  </View>
                </View>
                <View style={s.txAmounts}>
                  <Text style={s.txGross}>+${tx.amount.toFixed(2)}</Text>
                  <Text style={s.txNet}>${tx.net.toFixed(2)} net</Text>
                  {tx.completedAt && <Text style={s.txDate}>{formatTime(tx.completedAt)}</Text>}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Export CTA (when there's data) */}
        {hasData && (
          <TouchableOpacity style={s.exportCTA} onPress={handleExportCSV} disabled={exporting} activeOpacity={0.7}>
            <View style={s.exportCTAIcon}>
              <MaterialIcons name="file-download" size={24} color={Colors.primary} />
            </View>
            <View style={s.exportCTAContent}>
              <Text style={s.exportCTATitle}>Export Payout History</Text>
              <Text style={s.exportCTADesc}>Download a CSV with all transactions, fees, and summaries</Text>
            </View>
            {exporting ? (
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : (
              <MaterialIcons name="chevron-right" size={24} color={Colors.textLight} />
            )}
          </TouchableOpacity>
        )}

        {/* Empty State */}
        {(!db?.needs || db.needs.length === 0) && !loading && (
          <View style={s.emptyState}>
            <MaterialIcons name="account-balance-wallet" size={56} color={Colors.borderLight} />
            <Text style={s.emptyTitle}>No payout activity yet</Text>
            <Text style={s.emptySubtitle}>
              Create a need and receive contributions to see your payout dashboard.
            </Text>
            <TouchableOpacity style={s.createBtn} onPress={() => router.push('/(tabs)/create')}>
              <MaterialIcons name="add" size={20} color={Colors.white} />
              <Text style={s.createBtnText}>Create a Need</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Security Footer */}
        <View style={s.securityFooter}>
          <MaterialIcons name="verified-user" size={16} color={Colors.textLight} />
          <Text style={s.securityText}>
            All transfers are handled securely by Stripe. SpotMe never stores your banking information.
          </Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { alignItems: 'center', justifyContent: 'center' },
  loadingText: { fontSize: FontSize.md, color: Colors.textSecondary, marginTop: Spacing.lg },

  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, gap: Spacing.md },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: FontSize.xl, fontWeight: '900', color: Colors.text },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  exportBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full, backgroundColor: Colors.primaryLight,
    borderWidth: 1, borderColor: Colors.primary + '30',
  },
  exportBtnSuccess: { backgroundColor: '#E8F5E8', borderColor: Colors.success + '30' },
  exportBtnText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.primary },
  refreshBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },

  content: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm },

  // Status Banner
  statusBanner: { flexDirection: 'row', alignItems: 'center', borderRadius: BorderRadius.xl, padding: Spacing.lg, gap: Spacing.md, marginBottom: Spacing.lg },
  statusActive: { backgroundColor: Colors.secondaryLight },
  statusInactive: { backgroundColor: Colors.accentLight },
  statusContent: { flex: 1 },
  statusTitle: { fontSize: FontSize.md, fontWeight: '800', color: Colors.text },
  statusDesc: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2, lineHeight: 16 },
  setupBtn: { backgroundColor: Colors.primary, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm + 2, borderRadius: BorderRadius.full },
  setupBtnText: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.white },

  // Stats Grid
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.lg },
  statBox: { width: '31%', backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.md, alignItems: 'center', gap: 4, ...Shadow.sm, minWidth: 100 },
  statBoxIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  statBoxValue: { fontSize: FontSize.md, fontWeight: '900', color: Colors.text },
  statBoxLabel: { fontSize: 10, color: Colors.textLight, textAlign: 'center' },
  statBoxSub: { fontSize: 9, color: Colors.textSecondary },

  // Section Card
  sectionCard: { backgroundColor: Colors.surface, borderRadius: BorderRadius.xl, padding: Spacing.lg, marginBottom: Spacing.lg, ...Shadow.sm },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  sectionTitle: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.text },
  sectionCount: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textLight, backgroundColor: Colors.surfaceAlt, paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.full },

  // Chart
  chartWrap: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 110, paddingTop: Spacing.md },
  chartCol: { alignItems: 'center', flex: 1, gap: 3 },
  chartBar: { width: '65%', borderRadius: 3, minWidth: 16, maxWidth: 36 },
  chartLabel: { fontSize: 9, color: Colors.textLight, fontWeight: '600' },
  chartVal: { fontSize: 9, color: Colors.success, fontWeight: '700' },

  // Need Row
  needRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.borderLight, gap: Spacing.sm },
  needInfo: { flex: 1 },
  needTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  needDot: { width: 8, height: 8, borderRadius: 4 },
  needTitle: { flex: 1, fontSize: FontSize.md, fontWeight: '700', color: Colors.text },
  needMeta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: 4 },
  needCatBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 1, borderRadius: BorderRadius.full },
  needCatText: { fontSize: 10, fontWeight: '600' },
  needMetaText: { fontSize: FontSize.xs, color: Colors.textLight },
  needProgress: { marginTop: 6 },
  needProgressTrack: { height: 4, backgroundColor: Colors.borderLight, borderRadius: 2, overflow: 'hidden' },
  needProgressFill: { height: '100%', borderRadius: 2 },
  directBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4 },
  directBadgeText: { fontSize: 10, color: Colors.secondary, fontWeight: '600' },
  needRight: { alignItems: 'flex-end', gap: 4 },
  needStatusBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.full },
  needStatusText: { fontSize: 10, fontWeight: '700' },

  // Transaction Row
  txRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.borderLight, gap: Spacing.sm },
  txIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  txInfo: { flex: 1 },
  txName: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.text },
  txNeed: { fontSize: FontSize.xs, color: Colors.textLight, marginTop: 1 },
  txBadges: { flexDirection: 'row', gap: Spacing.xs, marginTop: 3 },
  txDirectBadge: { backgroundColor: Colors.secondaryLight, paddingHorizontal: 6, paddingVertical: 1, borderRadius: BorderRadius.full },
  txDirectBadgeText: { fontSize: 9, fontWeight: '700', color: Colors.secondaryDark },
  txVerifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: '#E8F5E8', paddingHorizontal: 6, paddingVertical: 1, borderRadius: BorderRadius.full },
  txVerifiedText: { fontSize: 9, fontWeight: '700', color: Colors.success },
  txAmounts: { alignItems: 'flex-end' },
  txGross: { fontSize: FontSize.md, fontWeight: '800', color: Colors.success },
  txNet: { fontSize: FontSize.xs, color: Colors.textSecondary },
  txDate: { fontSize: 10, color: Colors.textLight, marginTop: 2 },

  // Export CTA
  exportCTA: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.surface, borderRadius: BorderRadius.xl,
    padding: Spacing.lg, marginBottom: Spacing.lg,
    borderWidth: 1, borderColor: Colors.primary + '20',
    ...Shadow.sm,
  },
  exportCTAIcon: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center',
  },
  exportCTAContent: { flex: 1 },
  exportCTATitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text },
  exportCTADesc: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2, lineHeight: 16 },

  // Empty
  emptyState: { alignItems: 'center', paddingVertical: Spacing.huge, gap: Spacing.md },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textSecondary },
  emptySubtitle: { fontSize: FontSize.sm, color: Colors.textLight, textAlign: 'center', lineHeight: 20, paddingHorizontal: Spacing.xxl },
  signInBtn: { backgroundColor: Colors.primary, paddingHorizontal: Spacing.xxl, paddingVertical: Spacing.md, borderRadius: BorderRadius.full, marginTop: Spacing.md },
  signInBtnText: { fontSize: FontSize.md, fontWeight: '700', color: Colors.white },
  createBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.primary, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, borderRadius: BorderRadius.full, marginTop: Spacing.sm },
  createBtnText: { fontSize: FontSize.md, fontWeight: '700', color: Colors.white },

  // Security Footer
  securityFooter: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, paddingVertical: Spacing.lg, paddingHorizontal: Spacing.sm },
  securityText: { flex: 1, fontSize: FontSize.xs, color: Colors.textLight, lineHeight: 16 },
});
