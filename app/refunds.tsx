import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Platform, RefreshControl, TextInput, Modal, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, BorderRadius, FontSize, Spacing, Shadow } from '@/app/lib/theme';
import { useApp } from '@/app/lib/store';
import { supabase } from '@/app/lib/supabase';

type Tab = 'eligible' | 'history' | 'disputes';

interface RefundablePayment {
  id: string;
  paymentIntentId: string;
  amount: number;
  tipAmount: number;
  netAmount: number;
  status: string;
  needId: string;
  needTitle: string;
  contributorId: string;
  contributorName: string;
  isAnonymous: boolean;
  destinationCharge: boolean;
  stripeAccount: string | null;
  createdAt: string;
  completedAt: string | null;
  refundedAmount: number;
  refundable: number;
}

interface RefundRecord {
  id: string;
  paymentId: string;
  paymentIntentId: string;
  stripeRefundId: string | null;
  amount: number;
  reason: string;
  status: string;
  needId: string;
  needTitle: string;
  contributorName: string;
  isPartial: boolean;
  processedBy: string;
  createdAt: string;
  processedAt: string | null;
  error: string | null;
}

interface RefundSummary {
  totalRefunded: number;
  refundCount: number;
  pendingRefunds: number;
  pendingAmount: number;
  failedRefunds: number;
  avgRefundAmount: number;
  refundRate: number;
  totalPayments: number;
}

const REFUND_REASONS = [
  { value: 'requested_by_customer', label: 'Contributor requested', icon: 'person' },
  { value: 'duplicate', label: 'Duplicate payment', icon: 'content-copy' },
  { value: 'fraudulent', label: 'Fraudulent charge', icon: 'report' },
  { value: 'need_cancelled', label: 'Need cancelled/removed', icon: 'cancel' },
  { value: 'goal_exceeded', label: 'Over-funded (excess)', icon: 'trending-up' },
  { value: 'other', label: 'Other reason', icon: 'more-horiz' },
];

export default function RefundManager() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isLoggedIn, currentUser } = useApp();
  const [activeTab, setActiveTab] = useState<Tab>('eligible');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Data
  const [payments, setPayments] = useState<RefundablePayment[]>([]);
  const [refundHistory, setRefundHistory] = useState<RefundRecord[]>([]);
  const [summary, setSummary] = useState<RefundSummary | null>(null);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Refund Modal
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<RefundablePayment | null>(null);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('requested_by_customer');
  const [refundNote, setRefundNote] = useState('');
  const [isFullRefund, setIsFullRefund] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [refundResult, setRefundResult] = useState<{ success: boolean; message: string } | null>(null);

  // Batch refund
  const [selectedPayments, setSelectedPayments] = useState<Set<string>>(new Set());
  const [batchProcessing, setBatchProcessing] = useState(false);

  const fetchRefundData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      // Fetch refundable payments
      const { data: paymentsData } = await supabase.functions.invoke('stripe-checkout', {
        body: { action: 'fetch_refundable_payments', userId: currentUser.id },
      });
      if (paymentsData?.success) {
        setPayments(paymentsData.payments || []);
      }

      // Fetch refund history
      const { data: historyData } = await supabase.functions.invoke('stripe-checkout', {
        body: { action: 'fetch_refund_history', userId: currentUser.id },
      });
      if (historyData?.success) {
        setRefundHistory(historyData.refunds || []);
        setSummary(historyData.summary || null);
      }
    } catch (err) {
      console.error('Failed to fetch refund data:', err);
    }
    setLoading(false);
    setRefreshing(false);
  }, [currentUser.id]);

  useEffect(() => {
    if (isLoggedIn && currentUser.id !== 'guest') {
      fetchRefundData();
    }
  }, []);

  const openRefundModal = (payment: RefundablePayment) => {
    setSelectedPayment(payment);
    setRefundAmount(payment.refundable.toFixed(2));
    setIsFullRefund(true);
    setRefundReason('requested_by_customer');
    setRefundNote('');
    setRefundResult(null);
    setShowRefundModal(true);
  };

  const processRefund = async () => {
    if (!selectedPayment) return;
    const amount = parseFloat(refundAmount);
    if (isNaN(amount) || amount <= 0) {
      setRefundResult({ success: false, message: 'Please enter a valid refund amount' });
      return;
    }
    if (amount > selectedPayment.refundable) {
      setRefundResult({ success: false, message: `Maximum refundable amount is $${selectedPayment.refundable.toFixed(2)}` });
      return;
    }

    setProcessing(true);
    setRefundResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('stripe-checkout', {
        body: {
          action: 'process_refund',
          userId: currentUser.id,
          paymentId: selectedPayment.id,
          paymentIntentId: selectedPayment.paymentIntentId,
          amount,
          reason: refundReason,
          note: refundNote,
          isPartial: !isFullRefund,
          stripeAccount: selectedPayment.stripeAccount,
        },
      });

      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || 'Refund failed');

      setRefundResult({
        success: true,
        message: `Refund of $${amount.toFixed(2)} processed successfully${data.stripeRefundId ? ` (${data.stripeRefundId})` : ''}`,
      });

      // Refresh data after short delay
      setTimeout(() => {
        fetchRefundData(true);
        setShowRefundModal(false);
      }, 2000);
    } catch (err: any) {
      setRefundResult({ success: false, message: err.message || 'Failed to process refund' });
    }
    setProcessing(false);
  };

  const processBatchRefund = async () => {
    if (selectedPayments.size === 0) return;

    const confirmMsg = `Process refunds for ${selectedPayments.size} payment(s)?`;
    if (Platform.OS === 'web') {
      if (!window.confirm(confirmMsg)) return;
    }

    setBatchProcessing(true);
    let successCount = 0;
    let failCount = 0;

    for (const paymentId of selectedPayments) {
      const payment = payments.find(p => p.id === paymentId);
      if (!payment) continue;

      try {
        const { data, error } = await supabase.functions.invoke('stripe-checkout', {
          body: {
            action: 'process_refund',
            userId: currentUser.id,
            paymentId: payment.id,
            paymentIntentId: payment.paymentIntentId,
            amount: payment.refundable,
            reason: 'requested_by_customer',
            isPartial: false,
            stripeAccount: payment.stripeAccount,
          },
        });
        if (!error && data?.success) successCount++;
        else failCount++;
      } catch {
        failCount++;
      }
    }

    setBatchProcessing(false);
    setSelectedPayments(new Set());

    if (Platform.OS === 'web') {
      alert(`Batch refund complete: ${successCount} succeeded, ${failCount} failed`);
    } else {
      Alert.alert('Batch Refund', `${successCount} succeeded, ${failCount} failed`);
    }

    fetchRefundData(true);
  };

  const togglePaymentSelection = (id: string) => {
    setSelectedPayments(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Filter payments
  const filteredPayments = payments.filter(p => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      if (!p.needTitle.toLowerCase().includes(q) && !p.contributorName.toLowerCase().includes(q) && !p.paymentIntentId.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const filteredHistory = refundHistory.filter(r => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      if (!r.needTitle.toLowerCase().includes(q) && !r.contributorName.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const topPadding = Platform.OS === 'web' ? 16 : insets.top;

  const formatDate = (d: string) => {
    try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch { return d; }
  };

  const getRefundStatusColor = (status: string) => {
    switch (status) {
      case 'succeeded': case 'completed': return Colors.success;
      case 'pending': return Colors.accent;
      case 'failed': return Colors.error;
      case 'cancelled': return Colors.textLight;
      default: return Colors.textSecondary;
    }
  };

  if (!isLoggedIn) {
    return (
      <View style={[st.container, st.center, { paddingTop: topPadding }]}>
        <MaterialIcons name="lock" size={48} color={Colors.textLight} />
        <Text style={st.emptyTitle}>Sign in to manage refunds</Text>
        <TouchableOpacity style={st.primaryBtn} onPress={() => router.push('/auth')}>
          <Text style={st.primaryBtnText}>Sign In</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[st.container, st.center, { paddingTop: topPadding }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={st.loadingText}>Loading refund manager...</Text>
      </View>
    );
  }

  return (
    <View style={[st.container, { paddingTop: topPadding }]}>
      {/* Header */}
      <View style={st.header}>
        <TouchableOpacity style={st.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={st.headerTitle}>Refund Manager</Text>
        <TouchableOpacity style={st.refreshBtn} onPress={() => { setRefreshing(true); fetchRefundData(true); }}>
          <MaterialIcons name="refresh" size={22} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Summary Cards */}
      {summary && (
        <View style={st.summaryRow}>
          <View style={[st.summaryCard, { borderLeftColor: Colors.error }]}>
            <Text style={st.summaryValue}>${summary.totalRefunded.toFixed(2)}</Text>
            <Text style={st.summaryLabel}>Total Refunded</Text>
          </View>
          <View style={[st.summaryCard, { borderLeftColor: Colors.success }]}>
            <Text style={st.summaryValue}>{summary.refundCount}</Text>
            <Text style={st.summaryLabel}>Refunds</Text>
          </View>
          <View style={[st.summaryCard, { borderLeftColor: Colors.accent }]}>
            <Text style={st.summaryValue}>{summary.pendingRefunds}</Text>
            <Text style={st.summaryLabel}>Pending</Text>
          </View>
          <View style={[st.summaryCard, { borderLeftColor: '#7B9ED9' }]}>
            <Text style={st.summaryValue}>{summary.refundRate.toFixed(1)}%</Text>
            <Text style={st.summaryLabel}>Rate</Text>
          </View>
        </View>
      )}

      {/* Tabs */}
      <View style={st.tabRow}>
        {([
          { key: 'eligible', label: 'Eligible', icon: 'payments', count: payments.length },
          { key: 'history', label: 'History', icon: 'history', count: refundHistory.length },
          { key: 'disputes', label: 'Disputes', icon: 'gavel', count: 0 },
        ] as const).map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[st.tabBtn, activeTab === tab.key && st.tabBtnActive]}
            onPress={() => setActiveTab(tab.key)}
            activeOpacity={0.7}
          >
            <MaterialIcons name={tab.icon as any} size={16} color={activeTab === tab.key ? Colors.white : Colors.textSecondary} />
            <Text style={[st.tabText, activeTab === tab.key && st.tabTextActive]}>{tab.label}</Text>
            {tab.count > 0 && (
              <View style={[st.tabBadge, activeTab === tab.key && st.tabBadgeActive]}>
                <Text style={[st.tabBadgeText, activeTab === tab.key && st.tabBadgeTextActive]}>{tab.count}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Search */}
      <View style={st.searchRow}>
        <MaterialIcons name="search" size={20} color={Colors.textLight} />
        <TextInput
          style={st.searchInput}
          placeholder="Search by need, contributor, or payment ID..."
          placeholderTextColor={Colors.textLight}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <MaterialIcons name="close" size={18} color={Colors.textLight} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={st.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchRefundData(true); }} tintColor={Colors.primary} />}
      >
        {/* ELIGIBLE TAB */}
        {activeTab === 'eligible' && (
          <>
            {/* Batch Actions */}
            {selectedPayments.size > 0 && (
              <View style={st.batchBar}>
                <Text style={st.batchText}>{selectedPayments.size} selected</Text>
                <TouchableOpacity
                  style={[st.batchBtn, batchProcessing && { opacity: 0.6 }]}
                  onPress={processBatchRefund}
                  disabled={batchProcessing}
                >
                  {batchProcessing ? (
                    <ActivityIndicator size="small" color={Colors.white} />
                  ) : (
                    <>
                      <MaterialIcons name="replay" size={16} color={Colors.white} />
                      <Text style={st.batchBtnText}>Refund All</Text>
                    </>
                  )}
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setSelectedPayments(new Set())}>
                  <Text style={st.batchClear}>Clear</Text>
                </TouchableOpacity>
              </View>
            )}

            {filteredPayments.length === 0 ? (
              <View style={st.emptyState}>
                <MaterialIcons name="check-circle" size={56} color={Colors.success} />
                <Text style={st.emptyTitle}>No refundable payments</Text>
                <Text style={st.emptyDesc}>All payments are either already refunded or not eligible for refund.</Text>
              </View>
            ) : (
              filteredPayments.map(payment => {
                const isSelected = selectedPayments.has(payment.id);
                return (
                  <View key={payment.id} style={[st.paymentCard, isSelected && st.paymentCardSelected]}>
                    <TouchableOpacity
                      style={st.paymentCheckbox}
                      onPress={() => togglePaymentSelection(payment.id)}
                    >
                      <MaterialIcons
                        name={isSelected ? 'check-box' : 'check-box-outline-blank'}
                        size={22}
                        color={isSelected ? Colors.primary : Colors.textLight}
                      />
                    </TouchableOpacity>
                    <View style={st.paymentInfo}>
                      <Text style={st.paymentTitle} numberOfLines={1}>{payment.needTitle}</Text>
                      <Text style={st.paymentContributor}>
                        {payment.isAnonymous ? 'Anonymous' : payment.contributorName}
                      </Text>
                      <View style={st.paymentMeta}>
                        <Text style={st.paymentDate}>{formatDate(payment.createdAt)}</Text>
                        {payment.destinationCharge && (
                          <View style={st.directBadge}>
                            <Text style={st.directBadgeText}>Direct</Text>
                          </View>
                        )}
                        {payment.refundedAmount > 0 && (
                          <View style={st.partialBadge}>
                            <Text style={st.partialBadgeText}>Partial ${payment.refundedAmount.toFixed(2)}</Text>
                          </View>
                        )}
                      </View>
                      <Text style={st.paymentId} numberOfLines={1}>{payment.paymentIntentId}</Text>
                    </View>
                    <View style={st.paymentRight}>
                      <Text style={st.paymentAmount}>${payment.amount.toFixed(2)}</Text>
                      {payment.tipAmount > 0 && (
                        <Text style={st.paymentTip}>+${payment.tipAmount.toFixed(2)} tip</Text>
                      )}
                      <Text style={st.paymentRefundable}>
                        ${payment.refundable.toFixed(2)} refundable
                      </Text>
                      <TouchableOpacity
                        style={st.refundBtn}
                        onPress={() => openRefundModal(payment)}
                        activeOpacity={0.7}
                      >
                        <MaterialIcons name="replay" size={14} color={Colors.white} />
                        <Text style={st.refundBtnText}>Refund</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </>
        )}

        {/* HISTORY TAB */}
        {activeTab === 'history' && (
          <>
            {/* Status Filter */}
            <View style={st.filterRow}>
              {['all', 'succeeded', 'pending', 'failed'].map(f => (
                <TouchableOpacity
                  key={f}
                  style={[st.filterBtn, statusFilter === f && st.filterBtnActive]}
                  onPress={() => setStatusFilter(f)}
                >
                  <Text style={[st.filterText, statusFilter === f && st.filterTextActive]}>
                    {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {filteredHistory.length === 0 ? (
              <View style={st.emptyState}>
                <MaterialIcons name="history" size={56} color={Colors.borderLight} />
                <Text style={st.emptyTitle}>No refund history</Text>
                <Text style={st.emptyDesc}>Processed refunds will appear here.</Text>
              </View>
            ) : (
              filteredHistory.map(refund => (
                <View key={refund.id} style={st.refundCard}>
                  <View style={[st.refundIcon, { backgroundColor: getRefundStatusColor(refund.status) + '15' }]}>
                    <MaterialIcons
                      name={refund.status === 'succeeded' ? 'check-circle' : refund.status === 'pending' ? 'schedule' : 'error'}
                      size={20}
                      color={getRefundStatusColor(refund.status)}
                    />
                  </View>
                  <View style={st.refundInfo}>
                    <Text style={st.refundTitle}>{refund.needTitle}</Text>
                    <Text style={st.refundContributor}>{refund.contributorName}</Text>
                    <View style={st.refundMeta}>
                      <View style={[st.refundStatusBadge, { backgroundColor: getRefundStatusColor(refund.status) + '15' }]}>
                        <Text style={[st.refundStatusText, { color: getRefundStatusColor(refund.status) }]}>{refund.status}</Text>
                      </View>
                      {refund.isPartial && (
                        <View style={st.partialBadge}>
                          <Text style={st.partialBadgeText}>Partial</Text>
                        </View>
                      )}
                      <Text style={st.refundDate}>{formatDate(refund.createdAt)}</Text>
                    </View>
                    <Text style={st.refundReason}>
                      {REFUND_REASONS.find(r => r.value === refund.reason)?.label || refund.reason}
                    </Text>
                    {refund.error && <Text style={st.refundError}>{refund.error}</Text>}
                    {refund.stripeRefundId && (
                      <Text style={st.refundStripeId}>{refund.stripeRefundId}</Text>
                    )}
                  </View>
                  <Text style={st.refundAmount}>-${refund.amount.toFixed(2)}</Text>
                </View>
              ))
            )}
          </>
        )}

        {/* DISPUTES TAB */}
        {activeTab === 'disputes' && (
          <View style={st.emptyState}>
            <MaterialIcons name="gavel" size={56} color={Colors.borderLight} />
            <Text style={st.emptyTitle}>No disputes</Text>
            <Text style={st.emptyDesc}>
              Stripe disputes and chargebacks will appear here when they occur.
              Disputes are automatically synced via webhooks.
            </Text>
            <View style={st.disputeInfo}>
              <View style={st.disputeRow}>
                <MaterialIcons name="info" size={16} color={Colors.textSecondary} />
                <Text style={st.disputeText}>Disputes are created when a cardholder questions a charge</Text>
              </View>
              <View style={st.disputeRow}>
                <MaterialIcons name="schedule" size={16} color={Colors.textSecondary} />
                <Text style={st.disputeText}>You have 7-21 days to respond with evidence</Text>
              </View>
              <View style={st.disputeRow}>
                <MaterialIcons name="attach-money" size={16} color={Colors.textSecondary} />
                <Text style={st.disputeText}>Stripe charges a $15 dispute fee (refunded if you win)</Text>
              </View>
            </View>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Refund Modal */}
      <Modal visible={showRefundModal} transparent animationType="slide" onRequestClose={() => setShowRefundModal(false)}>
        <View style={st.modalOverlay}>
          <View style={st.modalContent}>
            <View style={st.modalHeader}>
              <Text style={st.modalTitle}>Process Refund</Text>
              <TouchableOpacity onPress={() => setShowRefundModal(false)} style={st.modalClose}>
                <MaterialIcons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>

            {selectedPayment && (
              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 500 }}>
                {/* Payment Info */}
                <View style={st.modalSection}>
                  <Text style={st.modalSectionTitle}>Payment Details</Text>
                  <View style={st.modalDetailRow}>
                    <Text style={st.modalLabel}>Need</Text>
                    <Text style={st.modalValue}>{selectedPayment.needTitle}</Text>
                  </View>
                  <View style={st.modalDetailRow}>
                    <Text style={st.modalLabel}>Contributor</Text>
                    <Text style={st.modalValue}>{selectedPayment.isAnonymous ? 'Anonymous' : selectedPayment.contributorName}</Text>
                  </View>
                  <View style={st.modalDetailRow}>
                    <Text style={st.modalLabel}>Amount</Text>
                    <Text style={st.modalValue}>${selectedPayment.amount.toFixed(2)}</Text>
                  </View>
                  {selectedPayment.tipAmount > 0 && (
                    <View style={st.modalDetailRow}>
                      <Text style={st.modalLabel}>Tip</Text>
                      <Text style={st.modalValue}>${selectedPayment.tipAmount.toFixed(2)}</Text>
                    </View>
                  )}
                  <View style={st.modalDetailRow}>
                    <Text style={st.modalLabel}>Refundable</Text>
                    <Text style={[st.modalValue, { color: Colors.success, fontWeight: '800' }]}>${selectedPayment.refundable.toFixed(2)}</Text>
                  </View>
                </View>

                {/* Refund Type */}
                <View style={st.modalSection}>
                  <Text style={st.modalSectionTitle}>Refund Type</Text>
                  <View style={st.refundTypeRow}>
                    <TouchableOpacity
                      style={[st.refundTypeBtn, isFullRefund && st.refundTypeBtnActive]}
                      onPress={() => { setIsFullRefund(true); setRefundAmount(selectedPayment.refundable.toFixed(2)); }}
                    >
                      <MaterialIcons name="replay" size={18} color={isFullRefund ? Colors.white : Colors.textSecondary} />
                      <Text style={[st.refundTypeText, isFullRefund && st.refundTypeTextActive]}>Full Refund</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[st.refundTypeBtn, !isFullRefund && st.refundTypeBtnActive]}
                      onPress={() => setIsFullRefund(false)}
                    >
                      <MaterialIcons name="tune" size={18} color={!isFullRefund ? Colors.white : Colors.textSecondary} />
                      <Text style={[st.refundTypeText, !isFullRefund && st.refundTypeTextActive]}>Partial</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Amount */}
                <View style={st.modalSection}>
                  <Text style={st.modalSectionTitle}>Refund Amount</Text>
                  <View style={st.amountInputRow}>
                    <Text style={st.amountPrefix}>$</Text>
                    <TextInput
                      style={st.amountInput}
                      value={refundAmount}
                      onChangeText={setRefundAmount}
                      keyboardType="decimal-pad"
                      editable={!isFullRefund}
                      selectTextOnFocus
                    />
                  </View>
                  {!isFullRefund && (
                    <Text style={st.amountHint}>Max: ${selectedPayment.refundable.toFixed(2)}</Text>
                  )}
                </View>

                {/* Reason */}
                <View style={st.modalSection}>
                  <Text style={st.modalSectionTitle}>Reason</Text>
                  <View style={st.reasonGrid}>
                    {REFUND_REASONS.map(reason => (
                      <TouchableOpacity
                        key={reason.value}
                        style={[st.reasonBtn, refundReason === reason.value && st.reasonBtnActive]}
                        onPress={() => setRefundReason(reason.value)}
                        activeOpacity={0.7}
                      >
                        <MaterialIcons
                          name={reason.icon as any}
                          size={16}
                          color={refundReason === reason.value ? Colors.white : Colors.textSecondary}
                        />
                        <Text style={[st.reasonText, refundReason === reason.value && st.reasonTextActive]}>
                          {reason.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Note */}
                <View style={st.modalSection}>
                  <Text style={st.modalSectionTitle}>Internal Note (optional)</Text>
                  <TextInput
                    style={st.noteInput}
                    value={refundNote}
                    onChangeText={setRefundNote}
                    placeholder="Add a note about this refund..."
                    placeholderTextColor={Colors.textLight}
                    multiline
                    numberOfLines={3}
                  />
                </View>

                {/* Result */}
                {refundResult && (
                  <View style={[st.resultBanner, refundResult.success ? st.resultSuccess : st.resultError]}>
                    <MaterialIcons
                      name={refundResult.success ? 'check-circle' : 'error'}
                      size={20}
                      color={refundResult.success ? Colors.success : Colors.error}
                    />
                    <Text style={[st.resultText, { color: refundResult.success ? Colors.success : Colors.error }]}>
                      {refundResult.message}
                    </Text>
                  </View>
                )}

                {/* Process Button */}
                <TouchableOpacity
                  style={[st.processBtn, processing && { opacity: 0.6 }]}
                  onPress={processRefund}
                  disabled={processing || refundResult?.success === true}
                  activeOpacity={0.8}
                >
                  {processing ? (
                    <ActivityIndicator size="small" color={Colors.white} />
                  ) : (
                    <>
                      <MaterialIcons name="replay" size={20} color={Colors.white} />
                      <Text style={st.processBtnText}>
                        Process ${parseFloat(refundAmount || '0').toFixed(2)} Refund
                      </Text>
                    </>
                  )}
                </TouchableOpacity>

                {/* Warning */}
                <View style={st.warningRow}>
                  <MaterialIcons name="info" size={14} color={Colors.textLight} />
                  <Text style={st.warningText}>
                    Refunds are processed through Stripe and typically take 5-10 business days to appear on the contributor's statement.
                  </Text>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  loadingText: { fontSize: FontSize.md, color: Colors.textSecondary, marginTop: Spacing.lg },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textSecondary, marginTop: Spacing.md },
  emptyDesc: { fontSize: FontSize.sm, color: Colors.textLight, textAlign: 'center', maxWidth: 300, lineHeight: 20, marginTop: Spacing.sm },
  primaryBtn: { backgroundColor: Colors.primary, paddingHorizontal: Spacing.xxl, paddingVertical: Spacing.md, borderRadius: BorderRadius.full, marginTop: Spacing.lg },
  primaryBtnText: { fontSize: FontSize.md, fontWeight: '700', color: Colors.white },

  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, gap: Spacing.md },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: FontSize.xl, fontWeight: '900', color: Colors.text },
  refreshBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },

  // Summary
  summaryRow: { flexDirection: 'row', paddingHorizontal: Spacing.lg, gap: Spacing.sm, marginBottom: Spacing.md },
  summaryCard: { flex: 1, backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.md, borderLeftWidth: 3, alignItems: 'center', ...Shadow.sm },
  summaryValue: { fontSize: FontSize.lg, fontWeight: '900', color: Colors.text },
  summaryLabel: { fontSize: 10, color: Colors.textLight, marginTop: 2 },

  // Tabs
  tabRow: { flexDirection: 'row', paddingHorizontal: Spacing.lg, gap: Spacing.sm, marginBottom: Spacing.md },
  tabBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: Spacing.sm + 2, borderRadius: BorderRadius.full, backgroundColor: Colors.surfaceAlt },
  tabBtnActive: { backgroundColor: Colors.primary },
  tabText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textSecondary },
  tabTextActive: { color: Colors.white },
  tabBadge: { backgroundColor: Colors.primary + '20', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 8 },
  tabBadgeActive: { backgroundColor: Colors.white + '30' },
  tabBadgeText: { fontSize: 9, fontWeight: '800', color: Colors.primary },
  tabBadgeTextActive: { color: Colors.white },

  // Search
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginHorizontal: Spacing.lg, backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.borderLight },
  searchInput: { flex: 1, fontSize: FontSize.sm, color: Colors.text, paddingVertical: 4 },

  content: { paddingHorizontal: Spacing.lg },

  // Batch
  batchBar: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: Colors.primary + '10', borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.md },
  batchText: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.primary, flex: 1 },
  batchBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.error, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: BorderRadius.full },
  batchBtnText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.white },
  batchClear: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textSecondary },

  // Payment Card
  paymentCard: { flexDirection: 'row', backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.sm, gap: Spacing.sm, ...Shadow.sm },
  paymentCardSelected: { borderWidth: 2, borderColor: Colors.primary },
  paymentCheckbox: { justifyContent: 'center' },
  paymentInfo: { flex: 1 },
  paymentTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text },
  paymentContributor: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  paymentMeta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: 4 },
  paymentDate: { fontSize: FontSize.xs, color: Colors.textLight },
  directBadge: { backgroundColor: Colors.secondaryLight, paddingHorizontal: 6, paddingVertical: 1, borderRadius: BorderRadius.full },
  directBadgeText: { fontSize: 9, fontWeight: '700', color: Colors.secondaryDark },
  partialBadge: { backgroundColor: Colors.accent + '15', paddingHorizontal: 6, paddingVertical: 1, borderRadius: BorderRadius.full },
  partialBadgeText: { fontSize: 9, fontWeight: '700', color: Colors.accent },
  paymentId: { fontSize: 9, color: Colors.textLight, fontFamily: Platform.OS === 'web' ? 'monospace' : undefined, marginTop: 3 },
  paymentRight: { alignItems: 'flex-end', gap: 3 },
  paymentAmount: { fontSize: FontSize.lg, fontWeight: '900', color: Colors.text },
  paymentTip: { fontSize: FontSize.xs, color: Colors.textLight },
  paymentRefundable: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.success },
  refundBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.error, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.full, marginTop: 4 },
  refundBtnText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.white },

  // Filter
  filterRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  filterBtn: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: BorderRadius.full, backgroundColor: Colors.surfaceAlt },
  filterBtnActive: { backgroundColor: Colors.primary },
  filterText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textSecondary },
  filterTextActive: { color: Colors.white },

  // Refund History Card
  refundCard: { flexDirection: 'row', backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.sm, gap: Spacing.sm, ...Shadow.sm },
  refundIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  refundInfo: { flex: 1 },
  refundTitle: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.text },
  refundContributor: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 1 },
  refundMeta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: 4 },
  refundStatusBadge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: BorderRadius.full },
  refundStatusText: { fontSize: 9, fontWeight: '700' },
  refundDate: { fontSize: FontSize.xs, color: Colors.textLight },
  refundReason: { fontSize: FontSize.xs, color: Colors.textLight, marginTop: 3 },
  refundError: { fontSize: FontSize.xs, color: Colors.error, marginTop: 2 },
  refundStripeId: { fontSize: 9, color: Colors.textLight, fontFamily: Platform.OS === 'web' ? 'monospace' : undefined, marginTop: 2 },
  refundAmount: { fontSize: FontSize.lg, fontWeight: '900', color: Colors.error },

  // Empty State
  emptyState: { alignItems: 'center', paddingVertical: Spacing.huge, gap: Spacing.sm },
  disputeInfo: { marginTop: Spacing.lg, gap: Spacing.md, width: '100%', maxWidth: 400 },
  disputeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  disputeText: { flex: 1, fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'flex-end' },
  modalContent: { backgroundColor: Colors.surface, borderTopLeftRadius: BorderRadius.xxl, borderTopRightRadius: BorderRadius.xxl, maxHeight: '90%', padding: Spacing.xl },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg },
  modalTitle: { fontSize: FontSize.xl, fontWeight: '900', color: Colors.text },
  modalClose: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },

  modalSection: { marginBottom: Spacing.lg },
  modalSectionTitle: { fontSize: FontSize.sm, fontWeight: '800', color: Colors.text, marginBottom: Spacing.sm, textTransform: 'uppercase', letterSpacing: 0.5 },
  modalDetailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  modalLabel: { fontSize: FontSize.sm, color: Colors.textSecondary },
  modalValue: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.text },

  // Refund Type
  refundTypeRow: { flexDirection: 'row', gap: Spacing.sm },
  refundTypeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingVertical: Spacing.md, borderRadius: BorderRadius.lg, backgroundColor: Colors.surfaceAlt },
  refundTypeBtnActive: { backgroundColor: Colors.primary },
  refundTypeText: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textSecondary },
  refundTypeTextActive: { color: Colors.white },

  // Amount
  amountInputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surfaceAlt, borderRadius: BorderRadius.lg, paddingHorizontal: Spacing.lg },
  amountPrefix: { fontSize: FontSize.xxl, fontWeight: '800', color: Colors.text },
  amountInput: { flex: 1, fontSize: FontSize.xxl, fontWeight: '800', color: Colors.text, paddingVertical: Spacing.md },
  amountHint: { fontSize: FontSize.xs, color: Colors.textLight, marginTop: 4 },

  // Reason
  reasonGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  reasonBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.full, backgroundColor: Colors.surfaceAlt },
  reasonBtnActive: { backgroundColor: Colors.primary },
  reasonText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textSecondary },
  reasonTextActive: { color: Colors.white },

  // Note
  noteInput: { backgroundColor: Colors.surfaceAlt, borderRadius: BorderRadius.lg, padding: Spacing.md, fontSize: FontSize.sm, color: Colors.text, minHeight: 80, textAlignVertical: 'top' },

  // Result
  resultBanner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md, borderRadius: BorderRadius.lg, marginBottom: Spacing.md },
  resultSuccess: { backgroundColor: Colors.success + '10' },
  resultError: { backgroundColor: Colors.error + '10' },
  resultText: { flex: 1, fontSize: FontSize.sm, fontWeight: '600', lineHeight: 18 },

  // Process Button
  processBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: Colors.error, paddingVertical: Spacing.lg, borderRadius: BorderRadius.xl, marginBottom: Spacing.md },
  processBtnText: { fontSize: FontSize.md, fontWeight: '800', color: Colors.white },

  // Warning
  warningRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, paddingBottom: Spacing.lg },
  warningText: { flex: 1, fontSize: FontSize.xs, color: Colors.textLight, lineHeight: 16 },
});
