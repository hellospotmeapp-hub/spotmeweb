import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, FlatList, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, BorderRadius, FontSize, Spacing, Shadow } from '@/app/lib/theme';
import { useApp } from '@/app/lib/store';

interface ReceiptItem {
  id: string;
  paymentId: string;
  paymentIntentId: string;
  recipientEmail: string;
  receiptType: string;
  amount: number;
  tipAmount: number;
  totalCharged: number;
  needId: string;
  needTitle: string;
  contributorName: string;
  transactionRef: string;
  status: string;
  resendCount: number;
  firstSentAt: string;
  lastSentAt: string;
  createdAt: string;
}

export default function ReceiptHistory() {
  const router = useRouter();
  const { fetchEmailReceiptHistory, emailReceipts, resendContributionReceipt } = useApp();

  const [loading, setLoading] = useState(true);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [resendResults, setResendResults] = useState<Record<string, { success: boolean; msg: string }>>({});

  useEffect(() => {
    loadReceipts();
  }, []);

  const loadReceipts = async () => {
    setLoading(true);
    try {
      await fetchEmailReceiptHistory();
    } catch {}
    setLoading(false);
  };

  const handleResend = async (receipt: ReceiptItem) => {
    if (resendingId) return;
    setResendingId(receipt.id);
    try {
      const result = await resendContributionReceipt({
        paymentId: receipt.paymentId || undefined,
        paymentIntentId: receipt.paymentIntentId || undefined,
        amount: receipt.amount,
        tipAmount: receipt.tipAmount,
        needTitle: receipt.needTitle,
        needId: receipt.needId,
        recipientName: receipt.contributorName,
      });
      setResendResults(prev => ({
        ...prev,
        [receipt.id]: {
          success: !!result.emailSent,
          msg: result.emailSent ? 'Receipt resent!' : (result.error || 'Failed to resend'),
        },
      }));
      // Refresh list after resend
      setTimeout(() => loadReceipts(), 1500);
    } catch (err: any) {
      setResendResults(prev => ({
        ...prev,
        [receipt.id]: { success: false, msg: err.message || 'Failed to resend' },
      }));
    }
    setResendingId(null);
  };

  const getStatusIcon = (status: string): { name: string; color: string } => {
    switch (status) {
      case 'sent': return { name: 'check-circle', color: Colors.success };
      case 'resent': return { name: 'mark-email-read', color: Colors.primary };
      case 'failed': return { name: 'error-outline', color: Colors.error };
      case 'resend_failed': return { name: 'error-outline', color: Colors.error };
      default: return { name: 'schedule', color: Colors.textLight };
    }
  };

  const getStatusLabel = (status: string): string => {
    switch (status) {
      case 'sent': return 'Sent';
      case 'resent': return 'Resent';
      case 'failed': return 'Failed';
      case 'resend_failed': return 'Resend Failed';
      default: return 'Pending';
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatTime = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  const renderReceipt = ({ item }: { item: ReceiptItem }) => {
    const statusInfo = getStatusIcon(item.status);
    const resendResult = resendResults[item.id];
    const isResending = resendingId === item.id;

    return (
      <View style={styles.receiptCard}>
        {/* Header Row */}
        <View style={styles.receiptHeader}>
          <View style={styles.receiptAmountRow}>
            <Text style={styles.receiptAmount}>${item.totalCharged > 0 ? item.totalCharged.toFixed(2) : item.amount.toFixed(2)}</Text>
            <View style={[styles.statusBadge, { backgroundColor: statusInfo.color + '18' }]}>
              <MaterialIcons name={statusInfo.name as any} size={12} color={statusInfo.color} />
              <Text style={[styles.statusText, { color: statusInfo.color }]}>{getStatusLabel(item.status)}</Text>
            </View>
          </View>
          <Text style={styles.receiptDate}>{formatDate(item.createdAt)} at {formatTime(item.createdAt)}</Text>
        </View>

        {/* Need Info */}
        {item.needTitle ? (
          <TouchableOpacity
            style={styles.needRow}
            onPress={() => item.needId && router.push(`/need/${item.needId}` as any)}
            activeOpacity={item.needId ? 0.7 : 1}
            disabled={!item.needId}
          >
            <View style={styles.needIcon}>
              <MaterialIcons name="favorite" size={14} color={Colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.needTitle} numberOfLines={1}>{item.needTitle}</Text>
              {item.recipientEmail && (
                <Text style={styles.emailText} numberOfLines={1}>{item.recipientEmail}</Text>
              )}
            </View>
            {item.needId && <MaterialIcons name="chevron-right" size={18} color={Colors.textLight} />}
          </TouchableOpacity>
        ) : null}

        {/* Breakdown */}
        <View style={styles.breakdownRow}>
          <View style={styles.breakdownItem}>
            <Text style={styles.breakdownLabel}>Contribution</Text>
            <Text style={styles.breakdownValue}>${item.amount.toFixed(2)}</Text>
          </View>
          {item.tipAmount > 0 && (
            <View style={styles.breakdownItem}>
              <Text style={[styles.breakdownLabel, { color: Colors.primary }]}>Tip</Text>
              <Text style={[styles.breakdownValue, { color: Colors.primary }]}>${item.tipAmount.toFixed(2)}</Text>
            </View>
          )}
          {item.resendCount > 0 && (
            <View style={styles.breakdownItem}>
              <Text style={styles.breakdownLabel}>Resends</Text>
              <Text style={styles.breakdownValue}>{item.resendCount}</Text>
            </View>
          )}
        </View>

        {/* Transaction Ref */}
        {item.transactionRef ? (
          <View style={styles.refRow}>
            <MaterialIcons name="tag" size={12} color={Colors.textLight} />
            <Text style={styles.refText}>
              {item.transactionRef.length > 24
                ? item.transactionRef.slice(0, 10) + '...' + item.transactionRef.slice(-10)
                : item.transactionRef}
            </Text>
          </View>
        ) : null}

        {/* Resend Result */}
        {resendResult && (
          <View style={[styles.resendResultRow, { backgroundColor: resendResult.success ? '#E8F5E9' : '#FFF3E0' }]}>
            <MaterialIcons
              name={resendResult.success ? 'check-circle' : 'warning'}
              size={14}
              color={resendResult.success ? Colors.success : '#E65100'}
            />
            <Text style={[styles.resendResultText, { color: resendResult.success ? Colors.success : '#E65100' }]}>
              {resendResult.msg}
            </Text>
          </View>
        )}

        {/* Resend Button */}
        <TouchableOpacity
          style={[styles.resendBtn, isResending && { opacity: 0.6 }]}
          onPress={() => handleResend(item)}
          disabled={isResending || !!resendingId}
          activeOpacity={0.7}
        >
          {isResending ? (
            <ActivityIndicator size="small" color={Colors.primary} />
          ) : (
            <MaterialIcons name="send" size={14} color={Colors.primary} />
          )}
          <Text style={styles.resendBtnText}>
            {isResending ? 'Sending...' : 'Resend Receipt'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading receipts...</Text>
      </View>
    );
  }

  if (!emailReceipts || emailReceipts.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIconCircle}>
          <MaterialIcons name="receipt-long" size={36} color={Colors.borderLight} />
        </View>
        <Text style={styles.emptyTitle}>No receipts yet</Text>
        <Text style={styles.emptySub}>
          Email receipts are automatically sent when you make a contribution. They'll appear here for your records.
        </Text>
      </View>
    );
  }

  // Summary stats
  const totalSent = emailReceipts.filter((r: any) => r.status === 'sent' || r.status === 'resent').length;
  const totalAmount = emailReceipts.reduce((sum: number, r: any) => sum + (r.totalCharged || r.amount || 0), 0);

  return (
    <View style={styles.container}>
      {/* Summary Bar */}
      <View style={styles.summaryBar}>
        <View style={styles.summaryItem}>
          <MaterialIcons name="receipt" size={16} color={Colors.primary} />
          <Text style={styles.summaryValue}>{emailReceipts.length}</Text>
          <Text style={styles.summaryLabel}>Total</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <MaterialIcons name="check-circle" size={16} color={Colors.success} />
          <Text style={styles.summaryValue}>{totalSent}</Text>
          <Text style={styles.summaryLabel}>Delivered</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <MaterialIcons name="attach-money" size={16} color={Colors.accent} />
          <Text style={styles.summaryValue}>${totalAmount.toFixed(0)}</Text>
          <Text style={styles.summaryLabel}>Total Given</Text>
        </View>
      </View>

      {/* Receipt List */}
      <FlatList
        data={emailReceipts as ReceiptItem[]}
        renderItem={renderReceipt}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 20 }}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      />

      {/* Refresh Button */}
      <TouchableOpacity
        style={styles.refreshBtn}
        onPress={loadReceipts}
        activeOpacity={0.7}
      >
        <MaterialIcons name="refresh" size={16} color={Colors.textSecondary} />
        <Text style={styles.refreshBtnText}>Refresh</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { alignItems: 'center', paddingVertical: Spacing.huge, gap: Spacing.md },
  loadingText: { fontSize: FontSize.sm, color: Colors.textLight },

  // Empty State
  emptyContainer: { alignItems: 'center', paddingVertical: Spacing.huge, gap: Spacing.md, paddingHorizontal: Spacing.xl },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textSecondary },
  emptySub: { fontSize: FontSize.sm, color: Colors.textLight, textAlign: 'center', lineHeight: 20 },

  // Summary Bar
  summaryBar: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    alignItems: 'center',
    ...Shadow.sm,
  },
  summaryItem: { flex: 1, alignItems: 'center', gap: 2 },
  summaryValue: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.text },
  summaryLabel: { fontSize: FontSize.xs, color: Colors.textLight },
  summaryDivider: { width: 1, height: 32, backgroundColor: Colors.borderLight },

  // Receipt Card
  receiptCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    gap: Spacing.sm,
    ...Shadow.sm,
  },
  receiptHeader: { gap: 2 },
  receiptAmountRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  receiptAmount: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.text },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  statusText: { fontSize: FontSize.xs, fontWeight: '700' },
  receiptDate: { fontSize: FontSize.xs, color: Colors.textLight },

  // Need Row
  needRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
  },
  needIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  needTitle: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.text },
  emailText: { fontSize: FontSize.xs, color: Colors.textLight, marginTop: 1 },

  // Breakdown
  breakdownRow: { flexDirection: 'row', gap: Spacing.lg },
  breakdownItem: { gap: 1 },
  breakdownLabel: { fontSize: FontSize.xs, color: Colors.textLight },
  breakdownValue: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.text },

  // Ref
  refRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  refText: { fontSize: 10, color: Colors.textLight, fontFamily: Platform.OS === 'web' ? 'monospace' : undefined },

  // Resend Result
  resendResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  resendResultText: { fontSize: FontSize.xs, fontWeight: '600' },

  // Resend Button
  resendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.primaryLight,
    borderWidth: 1,
    borderColor: Colors.primary + '20',
  },
  resendBtnText: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.primary },

  // Refresh
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.md,
    marginTop: Spacing.sm,
  },
  refreshBtnText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textSecondary },
});
