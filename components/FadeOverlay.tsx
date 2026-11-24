import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';

interface FadeOverlayProps {
  /** 'top' darkens toward the top edge, 'bottom' toward the bottom edge */
  edge: 'top' | 'bottom';
  height: number;
  /** Opacity at the darkest edge */
  maxOpacity?: number;
  steps?: number;
  style?: ViewStyle;
}

/**
 * Smooth dark fade built from stacked slices, so it renders the same on
 * web, iOS and Android without a native gradient dependency.
 */
export default function FadeOverlay({ edge, height, maxOpacity = 0.55, steps = 16, style }: FadeOverlayProps) {
  const slice = height / steps;
  return (
    <View
      pointerEvents="none"
      style={[styles.base, edge === 'top' ? { top: 0 } : { bottom: 0 }, { height }, style]}
    >
      {Array.from({ length: steps }).map((_, i) => {
        // i = 0 is the slice furthest from the dark edge; ease-in curve
        const t = (i + 1) / steps;
        const opacity = maxOpacity * t * t;
        return (
          <View
            key={i}
            style={{
              position: 'absolute', left: 0, right: 0, height: Math.ceil(slice) + 1,
              [edge === 'top' ? 'bottom' : 'top']: i * slice,
              backgroundColor: `rgba(0,0,0,${opacity.toFixed(3)})`,
            }}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { position: 'absolute', left: 0, right: 0 },
});
