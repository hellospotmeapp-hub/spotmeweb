import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Platform,
  Animated, ActivityIndicator, Dimensions,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, BorderRadius, FontSize, Spacing, Shadow } from '@/app/lib/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface VideoPlayerProps {
  videoUrl: string;
  thumbnailUrl?: string;
  autoPlay?: boolean;
  compact?: boolean;
  onPlay?: () => void;
  onEnd?: () => void;
  style?: any;
}

export default function VideoPlayer({
  videoUrl,
  thumbnailUrl,
  autoPlay = false,
  compact = false,
  onPlay,
  onEnd,
  style,
}: VideoPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [fadeAnim] = useState(new Animated.Value(1));
  const videoRef = useRef<any>(null);
  const controlsTimeout = useRef<any>(null);

  const containerHeight = compact ? 200 : Math.min(SCREEN_WIDTH * 0.75, 400);

  // Auto-hide controls
  useEffect(() => {
    if (isPlaying && showControls) {
      controlsTimeout.current = setTimeout(() => {
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start(() => setShowControls(false));
      }, 3000);
    }
    return () => clearTimeout(controlsTimeout.current);
  }, [isPlaying, showControls]);

  const showControlsHandler = () => {
    clearTimeout(controlsTimeout.current);
    setShowControls(true);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  const togglePlay = () => {
    if (Platform.OS === 'web' && videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play().catch(() => {});
        onPlay?.();
      }
      setIsPlaying(!isPlaying);
    }
    showControlsHandler();
  };

  const toggleMute = () => {
    if (Platform.OS === 'web' && videoRef.current) {
      videoRef.current.muted = !isMuted;
    }
    setIsMuted(!isMuted);
    showControlsHandler();
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Web-specific video element
  if (Platform.OS === 'web') {
    return (
      <View style={[styles.container, { height: containerHeight }, style]}>
        <TouchableOpacity
          activeOpacity={1}
          onPress={showControlsHandler}
          style={styles.videoWrapper}
        >
          <video
            ref={videoRef}
            src={videoUrl}
            poster={thumbnailUrl}
            playsInline
            autoPlay={autoPlay}
            muted={isMuted}
            preload="metadata"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              borderRadius: compact ? 12 : 16,
              backgroundColor: '#000',
            }}
            onLoadedMetadata={(e: any) => {
              setDuration(e.target.duration);
              setIsLoading(false);
            }}
            onTimeUpdate={(e: any) => {
              const ct = e.target.currentTime;
              const dur = e.target.duration;
              setCurrentTime(ct);
              setProgress(dur > 0 ? ct / dur : 0);
            }}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onEnded={() => {
              setIsPlaying(false);
              setShowControls(true);
              fadeAnim.setValue(1);
              onEnd?.();
            }}
            onWaiting={() => setIsLoading(true)}
            onCanPlay={() => setIsLoading(false)}
          />
        </TouchableOpacity>

        {/* Loading Spinner */}
        {isLoading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#FFF" />
          </View>
        )}

        {/* Controls Overlay */}
        {showControls && (
          <Animated.View style={[styles.controlsOverlay, { opacity: fadeAnim }]}>
            {/* Center Play/Pause */}
            <TouchableOpacity style={styles.centerPlayBtn} onPress={togglePlay}>
              <MaterialIcons
                name={isPlaying ? 'pause' : 'play-arrow'}
                size={compact ? 36 : 48}
                color="#FFF"
              />
            </TouchableOpacity>

            {/* Bottom Controls */}
            <View style={styles.bottomControls}>
              {/* Progress Bar */}
              <View style={styles.progressBarContainer}>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
                </View>
              </View>

              <View style={styles.controlsRow}>
                <TouchableOpacity onPress={togglePlay} style={styles.controlBtn}>
                  <MaterialIcons
                    name={isPlaying ? 'pause' : 'play-arrow'}
                    size={20}
                    color="#FFF"
                  />
                </TouchableOpacity>

                <Text style={styles.timeText}>
                  {formatTime(currentTime)} / {formatTime(duration)}
                </Text>

                <View style={styles.controlsRight}>
                  <TouchableOpacity onPress={toggleMute} style={styles.controlBtn}>
                    <MaterialIcons
                      name={isMuted ? 'volume-off' : 'volume-up'}
                      size={20}
                      color="#FFF"
                    />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Animated.View>
        )}

        {/* Initial Play Button (before first play) */}
        {!isPlaying && !isLoading && progress === 0 && (
          <TouchableOpacity style={styles.initialPlayOverlay} onPress={togglePlay}>
            <View style={styles.initialPlayBtn}>
              <MaterialIcons name="play-arrow" size={compact ? 40 : 56} color="#FFF" />
            </View>
            {!compact && (
              <Text style={styles.tapToPlay}>Tap to play</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    );
  }

  // Native fallback (placeholder)
  return (
    <View style={[styles.container, { height: containerHeight }, style]}>
      <View style={styles.nativePlaceholder}>
        <MaterialIcons name="videocam" size={48} color={Colors.textLight} />
        <Text style={styles.nativeText}>Video playback</Text>
        <Text style={styles.nativeSubtext}>Open in browser to watch</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    backgroundColor: '#000',
    position: 'relative',
  },
  videoWrapper: {
    flex: 1,
  },

  // Loading
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },

  // Controls
  controlsOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerPlayBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  progressBarContainer: {
    paddingVertical: Spacing.sm,
  },
  progressTrack: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 2,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  controlBtn: {
    padding: 4,
  },
  timeText: {
    flex: 1,
    fontSize: FontSize.xs,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '600',
  },
  controlsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },

  // Initial Play
  initialPlayOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
    gap: Spacing.sm,
  },
  initialPlayBtn: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.lg,
  },
  tapToPlay: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: '#FFF',
    letterSpacing: 0.5,
  },

  // Native fallback
  nativePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceAlt,
    gap: Spacing.sm,
  },
  nativeText: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  nativeSubtext: {
    fontSize: FontSize.sm,
    color: Colors.textLight,
  },
});
