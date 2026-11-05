import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, BorderRadius, FontSize, Spacing } from '@/lib/theme';
import { supabase } from '@/lib/supabase';

interface VerificationRequestModalProps {
  visible: boolean;
  onClose: () => void;
  defaultName?: string;
  defaultCity?: string;
}

// Sends a verification request to the admin Verify tab; an admin reviews it and adds the checkmark
export default function VerificationRequestModal({ visible, onClose, defaultName = '', defaultCity = '' }: VerificationRequestModalProps) {
  const [name, setName] = useState(defaultName === 'SpotMe User' ? '' : defaultName);
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState(defaultCity);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const canSubmit = name.trim().length >= 2 && phone.replace(/\D/g, '').length >= 10 && city.trim().length >= 2;

  const handleSubmit = async () => {
    if (!canSubmit || sending) return;
    setSending(true);
    setError('');
    const { data, error: err } = await supabase.functions.invoke('process-contribution', {
      body: { action: 'request_verification', name: name.trim(), phone: phone.trim(), city: city.trim() },
    });
    setSending(false);
    if (err || !data?.success) {
      setError(data?.error || err?.message || 'Could not send your request. Please try again.');
      return;
    }
    setSubmitted(true);
  };

  const handleClose = () => {
    setSubmitted(false);
    setError('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TouchableOpacity style={styles.backdrop} onPress={handleClose} activeOpacity={1} />
        <View style={styles.sheet}>
          <View style={styles.handle} />

          {submitted ? (
            <View style={styles.successContainer}>
              <MaterialIcons name="check-circle" size={48} color={Colors.success} />
              <Text style={styles.successTitle}>Request Sent</Text>
              <Text style={styles.successMessage}>
                Our team will review your details and may contact you. You'll get a checkmark once you're verified.
              </Text>
              <TouchableOpacity style={styles.submitButton} onPress={handleClose} activeOpacity={0.85}>
                <Text style={styles.submitText}>Done</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <View style={styles.header}>
                <Text style={styles.title}>Get SpotMe Verified</Text>
                <TouchableOpacity onPress={handleClose}>
                  <MaterialIcons name="close" size={24} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>
              <Text style={styles.subtitle}>
                Tell us who you are. Our team reviews every request before adding the checkmark to your posts.
              </Text>

              <Text style={styles.label}>Full name</Text>
              <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Your legal name"
                placeholderTextColor={Colors.textLight} maxLength={80} autoCapitalize="words" />

              <Text style={styles.label}>Phone number</Text>
              <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="(555) 123-4567"
                placeholderTextColor={Colors.textLight} keyboardType="phone-pad" maxLength={20} />

              <Text style={styles.label}>City</Text>
              <TextInput style={styles.input} value={city} onChangeText={setCity} placeholder="City, State"
                placeholderTextColor={Colors.textLight} maxLength={80} autoCapitalize="words" />

              {!!error && <Text style={styles.errorText}>{error}</Text>}

              <TouchableOpacity
                style={[styles.submitButton, (!canSubmit || sending) && styles.submitDisabled]}
                onPress={handleSubmit}
                disabled={!canSubmit || sending}
                activeOpacity={0.85}
              >
                {sending ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.submitText}>Send Request</Text>}
              </TouchableOpacity>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: Colors.overlay },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.xxl,
    borderTopRightRadius: BorderRadius.xxl,
    paddingHorizontal: Spacing.xxl,
    paddingBottom: 40,
    maxHeight: '90%',
  },
  handle: { width: 40, height: 4, backgroundColor: Colors.border, borderRadius: 2, alignSelf: 'center', marginTop: Spacing.md, marginBottom: Spacing.lg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  title: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.text },
  subtitle: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.lg },
  label: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.text, marginBottom: Spacing.xs, marginTop: Spacing.sm },
  input: {
    backgroundColor: Colors.surfaceAlt,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    fontSize: FontSize.md,
    color: Colors.text,
  },
  errorText: { fontSize: FontSize.sm, color: Colors.error, marginTop: Spacing.md },
  submitButton: { backgroundColor: Colors.primary, paddingVertical: Spacing.lg, borderRadius: BorderRadius.xl, alignItems: 'center', alignSelf: 'stretch', marginTop: Spacing.lg },
  submitDisabled: { opacity: 0.5 },
  submitText: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.white },
  successContainer: { alignItems: 'center', paddingVertical: Spacing.xxl, gap: Spacing.md },
  successTitle: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.text },
  successMessage: { fontSize: FontSize.md, color: Colors.textSecondary, textAlign: 'center' },
});
