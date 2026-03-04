import React, { useState, useRef, useEffect, useCallback, memo } from 'react';
import { View, Image, Animated, StyleSheet, ImageStyle, ViewStyle, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, BorderRadius } from '@/app/lib/theme';
import { NEED_PHOTOS } from '@/app/lib/data';

const DEFAULT_AVATAR = 'https://d64gsuwffb70l.cloudfront.net/698fe0b37fe9438e65b48d58_1771037056297_f9a83069.png';

// ─── In-memory failed URL cache ────────────────────────────────────────────
const _failedUrls = new Set<string>();

// ─── In-memory loaded URL cache ────────────────────────────────────────────
// Tracks URLs that have successfully loaded so we can skip the fade-in animation
const _loadedUrls = new Set<string>();

/** Check whether a URL has previously failed to load. */
export function isUrlFailed(url: string): boolean {
  return _failedUrls.has(url);
}

/** Manually mark a URL as failed (e.g. from an external check). */
export function markUrlFailed(url: string): void {
  _failedUrls.add(url);
}

/** Clear the entire failed-URL cache (useful for pull-to-refresh). */
export function clearFailedUrlCache(): void {
  _failedUrls.clear();
}

/**
 * Prefetch a list of image URLs using React Native's `Image.prefetch`.
 * URLs that fail prefetch are added to the failed cache so GracefulImage
 * can skip them immediately.
 */
export async function prefetchImages(urls: (string | null | undefined)[]): Promise<number> {
  const validUrls = urls.filter((u): u is string => !!u && !_failedUrls.has(u));
  let successCount = 0;

  await Promise.allSettled(
    validUrls.map(async (url) => {
      try {
        const ok = await Image.prefetch(url);
        if (ok) {
          successCount++;
          _loadedUrls.add(url);
        } else {
          _failedUrls.add(url);
        }
      } catch {
        _failedUrls.add(url);
      }
    }),
  );

  return successCount;
}

// ─── Category → fallback photo mapping ─────────────────────────────────────
const CATEGORY_PHOTO_MAP: Record<string, number> = {
  'Bills': 0,
  'Kids': 6,
  'Groceries': 2,
  'Health/Fitness': 4,
  'Self-Care': 4,
  'Transportation': 8,
  'Other': 3,
};

function getFallbackPhoto(category?: string): string {
  if (category && CATEGORY_PHOTO_MAP[category] !== undefined) {
    return NEED_PHOTOS[CATEGORY_PHOTO_MAP[category]];
  }
  return NEED_PHOTOS[0];
}

// ─── Component ─────────────────────────────────────────────────────────────
export type GracefulImageType = 'avatar' | 'photo';

interface GracefulImageProps {
  uri?: string | null;
  type: GracefulImageType;
  style: ImageStyle;
  category?: string;
  containerStyle?: ViewStyle;
  iconFallback?: boolean;
}

function GracefulImageInner({
  uri,
  type,
  style,
  category,
  containerStyle,
  iconFallback,
}: GracefulImageProps) {
  const alreadyFailed = !!uri && _failedUrls.has(uri);
  // Skip loading state entirely if image was previously loaded successfully
  const alreadyLoaded = !!uri && _loadedUrls.has(uri);

  const [isLoading, setIsLoading] = useState(!alreadyFailed && !alreadyLoaded && !!uri);
  const [hasError, setHasError] = useState(alreadyFailed);
  const shimmerAnim = useRef(new Animated.Value(0.3)).current;
  const fadeAnim = useRef(new Animated.Value(alreadyFailed || alreadyLoaded || !uri ? 1 : 0)).current;

  // Reset state when URI changes
  useEffect(() => {
    if (!uri) {
      setIsLoading(false);
      setHasError(false);
      fadeAnim.setValue(1);
      return;
    }
    const cachedFail = _failedUrls.has(uri);
    const cachedLoad = _loadedUrls.has(uri);
    setHasError(cachedFail);
    setIsLoading(!cachedFail && !cachedLoad);
    fadeAnim.setValue(cachedFail || cachedLoad ? 1 : 0);
  }, [uri]); // eslint-disable-line react-hooks/exhaustive-deps

  // Shimmer pulse animation - only run when actually loading
  useEffect(() => {
    if (!isLoading) return;

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0.3,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [isLoading, shimmerAnim]);

  const handleLoadEnd = useCallback(() => {
    // Mark as loaded for future renders (skip fade-in next time)
    if (uri) _loadedUrls.add(uri);
    setIsLoading(false);
    // Faster fade-in: 120ms instead of 250ms
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 120,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim, uri]);

  const handleError = useCallback(() => {
    if (uri) _failedUrls.add(uri);
    setHasError(true);
    setIsLoading(false);
    fadeAnim.setValue(1); // Instant show for fallback, no animation delay
  }, [fadeAnim, uri]);

  // Determine the effective URI
  const effectiveUri =
    hasError || !uri
      ? type === 'avatar'
        ? DEFAULT_AVATAR
        : getFallbackPhoto(category)
      : uri;

  const shouldShowSkeleton = isLoading && !!uri && !hasError;

  // Compute dimensions from style for the skeleton
  const flatStyle = StyleSheet.flatten(style) || {};
  const width = flatStyle.width || '100%';
  const height = flatStyle.height || 100;
  const borderRadius = flatStyle.borderRadius || 0;

  return (
    <View
      style={[
        { width: width as any, height: height as any, overflow: 'hidden', borderRadius },
        containerStyle,
      ]}
    >
      {/* Shimmer skeleton layer */}
      {shouldShowSkeleton && (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: type === 'avatar' ? Colors.borderLight : Colors.surfaceAlt,
              opacity: shimmerAnim,
              borderRadius,
              alignItems: 'center',
              justifyContent: 'center',
            },
          ]}
        >
          {type === 'avatar' ? (
            <MaterialIcons
              name="person"
              size={Math.min(Number(width) || 24, Number(height) || 24) * 0.5}
              color={Colors.textLight}
            />
          ) : (
            <MaterialIcons
              name="image"
              size={Math.min(Number(width) || 40, Number(height) || 40) * 0.3}
              color={Colors.border}
            />
          )}
        </Animated.View>
      )}

      {/* Actual image with fade-in */}
      <Animated.View
        style={[StyleSheet.absoluteFill, { opacity: shouldShowSkeleton ? fadeAnim : 1 }]}
      >
        <Image
          source={{ uri: effectiveUri }}
          style={[style, { width: '100%', height: '100%' }]}
          onLoadEnd={handleLoadEnd}
          onError={handleError}
          resizeMode={(flatStyle.resizeMode as any) || 'cover'}
          // Enable progressive loading on web
          {...(Platform.OS === 'web' ? { loading: 'lazy' as any } : {})}
        />
      </Animated.View>

      {/* Error indicator overlay for photos (subtle) */}
      {hasError && type === 'photo' && !!uri && (
        <View style={styles.errorBadge}>
          <MaterialIcons name="broken-image" size={12} color={Colors.white} />
        </View>
      )}
    </View>
  );
}

// Memoize to prevent re-renders when parent re-renders but image props haven't changed
const GracefulImage = memo(GracefulImageInner, (prev, next) => {
  return (
    prev.uri === next.uri &&
    prev.type === next.type &&
    prev.category === next.category &&
    prev.iconFallback === next.iconFallback
  );
});

export default GracefulImage;

const styles = StyleSheet.create({
  errorBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
