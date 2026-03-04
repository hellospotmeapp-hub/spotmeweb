import React, { useEffect, useRef, memo } from 'react';
import { View, Text, StyleSheet, Animated, Easing, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, BorderRadius, FontSize, Spacing } from '@/app/lib/theme';

interface UploadProgressBarProps {
  progress: number; // 0-1
  status: 'compressing' | 'uploading' | 'retrying' | 'success' | 'error';
  retryCount?: number;
  maxRetries?: number;
  fileSizeKB?: number;
  onRetry?: () => void;
  onCancel?: () => void;
  errorMessage?: string;
}

function UploadProgressBarInner({
  progress,
  status,
  retryCount = 0,
  maxRetries = 3,
  fileSizeKB,
  onRetry,
  onCancel,
  errorMessage,
}: UploadProgressBarProps) {
  const progressAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  // Animate progress bar width
  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 300,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false,
    }).start();
  }, [progress]);

  // Pulse animation for active states
  useEffect(() => {
    if (status === 'compressing' || status === 'uploading' || status === 'retrying') {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.6, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [status]);

  // Shimmer for active upload
  useEffect(() => {
    if (status === 'uploading' || status === 'retrying') {
      const loop = Animated.loop(
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1500,
          easing: Easing.linear,
          useNativeDriver: false,
        })
      );
      loop.start();
      return () => loop.stop();
    }
  }, [status]);

  const getStatusColor = () => {
    switch (status) {
      case 'compressing': return Colors.accent;
      case 'uploading': return Colors.primary;
      case 'retrying': return '#F5A623';
      case 'success': return Colors.success;
      case 'error': return Colors.error;
    }
  };

  const getStatusIcon = (): string => {
    switch (status) {
      case 'compressing': return 'compress';
      case 'uploading': return 'cloud-upload';
      case 'retrying': return 'refresh';
      case 'success': return 'check-circle';
      case 'error': return 'error-outline';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'compressing':
        return 'Optimizing image...';
      case 'uploading':
        return `Uploading${fileSizeKB ? ` (${fileSizeKB}KB)` : ''}...`;
      case 'retrying':
        return `Retrying (${retryCount}/${maxRetries})...`;
      case 'success':
        return 'Upload complete!';
      case 'error':
        return errorMessage || 'Upload failed';
    }
  };

  const color = getStatusColor();
  const percent = Math.round(progress * 100);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.statusRow}>
          <Animated.View style={{ opacity: pulseAnim }}>
            <MaterialIcons name={getStatusIcon() as any} size={16} color={color} />
          </Animated.View>
          <Text style={[styles.statusText, { color }]}>{getStatusText()}</Text>
        </View>
        <Text style={[styles.percentText, { color }]}>{percent}%</Text>
      </View>

      {/* Progress track */}
      <View style={styles.track}>
        <Animated.View
          style={[
            styles.fill,
            {
              backgroundColor: color,
              width: progressAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        />
        {/* Shimmer overlay */}
        {(status === 'uploading' || status === 'retrying') && (
          <Animated.View
            style={[
              styles.shimmer,
              {
                left: shimmerAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['-30%' as any, '130%' as any],
                }),
              },
            ]}
          />
        )}
      </View>

      {/* Action buttons for error state */}
      {status === 'error' && (
        <View style={styles.actionRow}>
          {onRetry && (
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: Colors.primaryLight }]} onPress={onRetry} activeOpacity={0.7}>
              <MaterialIcons name="refresh" size={14} color={Colors.primary} />
              <Text style={[styles.actionBtnText, { color: Colors.primary }]}>Retry</Text>
            </TouchableOpacity>
          )}
          {onCancel && (
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#FDE8E8' }]} onPress={onCancel} activeOpacity={0.7}>
              <MaterialIcons name="close" size={14} color={Colors.error} />
              <Text style={[styles.actionBtnText, { color: Colors.error }]}>Remove</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Retry info */}
      {status === 'retrying' && retryCount > 0 && (
        <Text style={styles.retryInfo}>
          Attempt {retryCount} of {maxRetries} — retrying with exponential backoff
        </Text>
      )}
    </View>
  );
}

const UploadProgressBar = memo(UploadProgressBarInner);
export default UploadProgressBar;

const styles = StyleSheet.create({
  container: {
    paddingVertical: Spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  percentText: {
    fontSize: FontSize.sm,
    fontWeight: '800',
    minWidth: 36,
    textAlign: 'right',
  },
  track: {
    height: 6,
    backgroundColor: Colors.borderLight,
    borderRadius: 3,
    overflow: 'hidden',
    position: 'relative',
  },
  fill: {
    height: '100%',
    borderRadius: 3,
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    width: '30%',
    height: '100%',
    backgroundColor: 'rgba(255,255,255,0.35)',
    borderRadius: 3,
  },
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.sm,
    minHeight: 32,
  },
  actionBtnText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  retryInfo: {
    fontSize: 10,
    color: Colors.textLight,
    marginTop: 4,
    fontStyle: 'italic',
  },
});
