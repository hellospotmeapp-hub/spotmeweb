import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, TextInput } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, BorderRadius, FontSize, Spacing } from '@/app/lib/theme';

interface ReportModalProps {
  visible: boolean;
  onClose: () => void;
  onReport: (reason: string) => void;
  onBlock?: () => void;
  type: 'need' | 'user';
}

const REPORT_REASONS = [
  'Misleading or false information',
  'Inappropriate content',
  'Suspected fraud or scam',
  'Harassment or bullying',
  'Spam or repetitive posting',
  'Violates community guidelines',
  'Other',
];

export default function ReportModal({ visible, onClose, onReport, onBlock, type }: ReportModalProps) {
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [otherText, setOtherText] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    const reason = selectedReason === 'Other' ? otherText : selectedReason;
    if (!reason) return;
    onReport(reason);
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setSelectedReason(null);
      setOtherText('');
      onClose();
    }, 2000);
  };

  const handleClose = () => {
    setSubmitted(false);
    setSelectedReason(null);
    setOtherText('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} onPress={handleClose} activeOpacity={1} />
        <View style={styles.sheet}>
          <View style={styles.handle} />

          {submitted ? (
            <View style={styles.successContainer}>
              <MaterialIcons name="check-circle" size={48} color={Colors.success} />
              <Text style={styles.successTitle}>Report Submitted</Text>
              <Text style={styles.successMessage}>
                Thank you. Our team will review this within 24 hours.
              </Text>
            </View>
          ) : (
            <>
              <View style={styles.header}>
                <Text style={styles.title}>Report {type === 'need' ? 'this Need' : 'this User'}</Text>
                <TouchableOpacity onPress={handleClose}>
                  <MaterialIcons name="close" size={24} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <Text style={styles.subtitle}>Why are you reporting this?</Text>

              {REPORT_REASONS.map(reason => (
                <TouchableOpacity
                  key={reason}
                  style={[styles.reasonRow, selectedReason === reason && styles.reasonRowSelected]}
                  onPress={() => setSelectedReason(reason)}
                  activeOpacity={0.7}
                >
                  <MaterialIcons
                    name={selectedReason === reason ? 'radio-button-checked' : 'radio-button-unchecked'}
                    size={22}
                    color={selectedReason === reason ? Colors.primary : Colors.textLight}
                  />
                  <Text style={[styles.reasonText, selectedReason === reason && styles.reasonTextSelected]}>
                    {reason}
                  </Text>
                </TouchableOpacity>
              ))}

              {selectedReason === 'Other' && (
                <TextInput
                  style={styles.otherInput}
                  value={otherText}
                  onChangeText={setOtherText}
                  placeholder="Please describe the issue..."
                  placeholderTextColor={Colors.textLight}
                  multiline
                  maxLength={200}
                />
              )}

              <TouchableOpacity
                style={[styles.submitButton, !selectedReason && styles.submitDisabled]}
                onPress={handleSubmit}
                disabled={!selectedReason}
                activeOpacity={0.8}
              >
                <Text style={styles.submitText}>Submit Report</Text>
              </TouchableOpacity>

              {onBlock && (
                <TouchableOpacity style={styles.blockButton} onPress={onBlock} activeOpacity={0.7}>
                  <MaterialIcons name="block" size={18} color={Colors.error} />
                  <Text style={styles.blockText}>Block this user</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
    backgroundColor: Colors.overlay,
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.xxl,
    borderTopRightRadius: BorderRadius.xxl,
    paddingHorizontal: Spacing.xxl,
    paddingBottom: 40,
    maxHeight: '85%',
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: Spacing.md,
    marginBottom: Spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    color: Colors.text,
  },
  subtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.lg,
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.xs,
  },
  reasonRowSelected: {
    backgroundColor: Colors.primaryLight,
  },
  reasonText: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    flex: 1,
  },
  reasonTextSelected: {
    color: Colors.text,
    fontWeight: '600',
  },
  otherInput: {
    backgroundColor: Colors.surfaceAlt,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    fontSize: FontSize.md,
    color: Colors.text,
    marginBottom: Spacing.lg,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  submitButton: {
    backgroundColor: Colors.error,
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.xl,
    alignItems: 'center',
    marginTop: Spacing.lg,
  },
  submitDisabled: {
    opacity: 0.5,
  },
  submitText: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.white,
  },
  blockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
    marginTop: Spacing.sm,
  },
  blockText: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.error,
  },
  successContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.huge,
    gap: Spacing.md,
  },
  successTitle: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    color: Colors.text,
  },
  successMessage: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
});
