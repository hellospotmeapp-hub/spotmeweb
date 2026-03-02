import React, { useEffect, useRef, useMemo } from 'react';
import { View, StyleSheet, Animated, Dimensions, Platform } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const CONFETTI_COLORS = [
  '#F2785C', '#8BAF8E', '#F5C563', '#7B9ED9', '#E8A0BF',
  '#B8A9C9', '#5CB85C', '#FF6B6B', '#4ECDC4', '#FFE66D',
];

const NUM_CONFETTI = 40;

interface ConfettiPiece {
  x: number;
  color: string;
  size: number;
  rotation: number;
  delay: number;
  shape: 'rect' | 'circle';
}

interface ConfettiAnimationProps {
  active: boolean;
  duration?: number;
}

export default function ConfettiAnimation({ active, duration = 3000 }: ConfettiAnimationProps) {
  const animValues = useRef(
    Array.from({ length: NUM_CONFETTI }, () => new Animated.Value(0))
  ).current;

  const pieces = useMemo<ConfettiPiece[]>(() =>
    Array.from({ length: NUM_CONFETTI }, () => ({
      x: Math.random() * SCREEN_WIDTH,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      size: 6 + Math.random() * 8,
      rotation: Math.random() * 360,
      delay: Math.random() * 600,
      shape: Math.random() > 0.5 ? 'rect' : 'circle',
    })),
  []);

  useEffect(() => {
    if (!active) {
      animValues.forEach(v => v.setValue(0));
      return;
    }

    const animations = animValues.map((anim, i) => {
      anim.setValue(0);
      return Animated.sequence([
        Animated.delay(pieces[i].delay),
        Animated.timing(anim, {
          toValue: 1,
          duration: duration - pieces[i].delay,
          useNativeDriver: true,
        }),
      ]);
    });

    Animated.parallel(animations).start();
  }, [active]);

  if (!active) return null;

  return (
    <View style={styles.container} pointerEvents="none">
      {pieces.map((piece, i) => {
        const translateY = animValues[i].interpolate({
          inputRange: [0, 1],
          outputRange: [-40, SCREEN_HEIGHT + 40],
        });

        const translateX = animValues[i].interpolate({
          inputRange: [0, 0.25, 0.5, 0.75, 1],
          outputRange: [0, -20 + Math.random() * 40, 10 - Math.random() * 20, -15 + Math.random() * 30, Math.random() * 20 - 10],
        });

        const rotate = animValues[i].interpolate({
          inputRange: [0, 1],
          outputRange: [`${piece.rotation}deg`, `${piece.rotation + 360 + Math.random() * 720}deg`],
        });

        const opacity = animValues[i].interpolate({
          inputRange: [0, 0.1, 0.8, 1],
          outputRange: [0, 1, 1, 0],
        });

        const scale = animValues[i].interpolate({
          inputRange: [0, 0.05, 0.5, 1],
          outputRange: [0, 1.2, 1, 0.6],
        });

        return (
          <Animated.View
            key={i}
            style={[
              styles.piece,
              {
                left: piece.x,
                width: piece.size,
                height: piece.shape === 'rect' ? piece.size * 1.5 : piece.size,
                backgroundColor: piece.color,
                borderRadius: piece.shape === 'circle' ? piece.size / 2 : 2,
                opacity,
                transform: [
                  { translateY },
                  { translateX },
                  { rotate },
                  { scale },
                ],
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
    overflow: 'hidden',
  },
  piece: {
    position: 'absolute',
    top: 0,
  },
});
