import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { Colors, BorderRadius } from '@/app/lib/theme';

interface ProgressBarProps {
  progress: number; // 0 to 1
  height?: number;
  showGlow?: boolean;
  color?: string;
}

export default function ProgressBar({ progress, height = 8, showGlow = false, color }: ProgressBarProps) {
  const animatedWidth = useRef(new Animated.Value(0)).current;
  const clampedProgress = Math.min(Math.max(progress, 0), 1);

  useEffect(() => {
    Animated.spring(animatedWidth, {
      toValue: clampedProgress,
      friction: 8,
      tension: 40,
      useNativeDriver: false,
    }).start();
  }, [clampedProgress]);

  const getColor = () => {
    if (color) return color;
    if (clampedProgress >= 1) return Colors.success;
    if (clampedProgress >= 0.75) return Colors.secondary;
    if (clampedProgress >= 0.5) return Colors.accent;
    return Colors.primary;
  };

  const barColor = getColor();

  return (
    <View style={[styles.container, { height }]}>
      <View style={[styles.track, { height, borderRadius: height / 2 }]}>
        <Animated.View
          style={[
            styles.fill,
            {
              height,
              borderRadius: height / 2,
              backgroundColor: barColor,
              width: animatedWidth.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
            },
            showGlow && {
              shadowColor: barColor,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.4,
              shadowRadius: 6,
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  track: {
    width: '100%',
    backgroundColor: Colors.borderLight,
    overflow: 'hidden',
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
});
