import React, { useState } from 'react';
import { View, Image, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { Colors, BorderRadius, Spacing, FontSize } from '@/app/lib/theme';

interface QRCodeProps {
  value: string;
  size?: number;
  color?: string;
  bgColor?: string;
  label?: string;
}

export default function QRCode({ value, size = 180, color = '2D2926', bgColor = 'FFFFFF', label }: QRCodeProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Use the free goqr.me API for QR code generation
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(value)}&color=${color}&bgcolor=${bgColor}&margin=1&format=png`;

  return (
    <View style={styles.container}>
      <View style={[styles.qrWrapper, { width: size + 24, height: size + 24 }]}>
        {loading && !error && (
          <View style={[styles.loadingOverlay, { width: size, height: size }]}>
            <ActivityIndicator size="small" color={Colors.primary} />
          </View>
        )}
        {error ? (
          <View style={[styles.errorContainer, { width: size, height: size }]}>
            <Text style={styles.errorText}>QR Code</Text>
            <Text style={styles.errorSubtext}>Scan to donate</Text>
          </View>
        ) : (
          <Image
            source={{ uri: qrUrl }}
            style={{ width: size, height: size, borderRadius: 4 }}
            onLoad={() => setLoading(false)}
            onError={() => { setError(true); setLoading(false); }}
            resizeMode="contain"
          />
        )}
      </View>
      {label && <Text style={styles.label}>{label}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: Spacing.sm,
  },
  qrWrapper: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  loadingOverlay: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 4,
  },
  errorText: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  errorSubtext: {
    fontSize: FontSize.xs,
    color: Colors.textLight,
    marginTop: 2,
  },
  label: {
    fontSize: FontSize.xs,
    color: Colors.textLight,
    fontWeight: '600',
    textAlign: 'center',
  },
});
