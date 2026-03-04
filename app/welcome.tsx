import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, BorderRadius, FontSize, Spacing, Shadow } from '@/app/lib/theme';
import { supabase, supabaseUrl, supabaseKey } from '@/app/lib/supabase';
import WalkthroughScene from '@/components/WalkthroughScene';


const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const TOTAL_SCENES = 8;

// Scene timing in milliseconds — tuned to match the natural conversational voiceover.
// Total ≈ 58 seconds.
const SCENE_DURATIONS = [
  5000,  // 0: Welcome
  11000, // 1: Home Feed
  9000,  // 2: Post a Need
  9000,  // 3: Categories
  8500,  // 4: Support
  7000,  // 5: Smart Split
  5000,  // 6: Community
  4000,  // 7: Closing
];

// Subtitles that mirror the voiceover — conversational and warm
const SCENE_SUBTITLES = [
  "Hey there, welcome to SpotMe!\nLet me give you a quick tour.",
  "This is your home feed — real requests\nfrom real people, with progress bars\nshowing how close each one is to funded.",
  "Need a hand? Tap the plus button,\npick a category, share your story,\nand set a goal up to $300.",
  "Browse by category — bills, kids,\ngroceries, health, self-care, and more.\nPlus Mama Recharge, just for you.",
  "See someone to help? Tap Spot Them\nand pick any amount. Even a couple bucks\nmakes a difference.",
  "Smart Split lets one payment get\ndivided across several people at once.\nSuper easy.",
  "Browse, post, support when you can.\nNo judgment — just people\nhelping people.",
  "We're really glad you're here.",
];



// Generate a unique session ID
function generateSessionId(): string {
  return `wt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// Get device info string
function getDeviceInfo(): string {
  if (Platform.OS === 'web') {
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    if (/Mobile|Android|iPhone/i.test(ua)) return 'mobile_web';
    if (/Tablet|iPad/i.test(ua)) return 'tablet_web';
    return 'desktop_web';
  }
  return Platform.OS === 'ios' ? 'ios_native' : 'android_native';
}

export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [currentScene, setCurrentScene] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);

  // Audio state
  const [audioLoading, setAudioLoading] = useState(true);
  const [audioReady, setAudioReady] = useState(false);
  const [audioError, setAudioError] = useState(false);
  const [audioMuted, setAudioMuted] = useState(false);
  const [audioPlaying, setAudioPlaying] = useState(false);

  const progressAnim = useRef(new Animated.Value(0)).current;
  const subtitleFade = useRef(new Animated.Value(0)).current;
  const bgOpacity = useRef(new Animated.Value(1)).current;
  const audioRef = useRef<any>(null);
  const blobUrlRef = useRef<string>('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sceneStartTime = useRef<number>(0);
  const mountedRef = useRef(true);

  // Analytics refs
  const sessionIdRef = useRef<string>(generateSessionId());
  const walkthroughStartTime = useRef<number>(0);
  const audioDidPlay = useRef<boolean>(false);
  const hasTrackedComplete = useRef<boolean>(false);
  const deviceInfoRef = useRef<string>(getDeviceInfo());
  const eventQueueRef = useRef<any[]>([]);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Get user ID if logged in
  const getUserId = useCallback((): string | null => {
    if (Platform.OS === 'web') {
      try {
        const saved = localStorage.getItem('spotme_user');
        if (saved) {
          const user = JSON.parse(saved);
          return user.id !== 'guest' ? user.id : null;
        }
      } catch {}
    }
    return null;
  }, []);

  // ---- ANALYTICS TRACKING ----
  const trackEvent = useCallback((eventType: string, extra?: { sceneIndex?: number; durationMs?: number; metadata?: any }) => {
    const event = {
      sessionId: sessionIdRef.current,
      userId: getUserId(),
      eventType,
      sceneIndex: extra?.sceneIndex ?? null,
      audioPlayed: audioDidPlay.current,
      durationMs: extra?.durationMs ?? null,
      metadata: extra?.metadata ?? null,
      deviceInfo: deviceInfoRef.current,
    };

    eventQueueRef.current.push(event);

    if (['start', 'complete', 'skip', 'drop_off'].includes(eventType)) {
      flushEvents();
    } else {
      if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
      flushTimerRef.current = setTimeout(flushEvents, 2000);
    }
  }, [getUserId]);

  const flushEvents = useCallback(() => {
    const events = [...eventQueueRef.current];
    eventQueueRef.current = [];
    if (events.length === 0) return;

    if (events.length === 1) {
      supabase.functions.invoke('track-walkthrough', {
        body: { action: 'track', ...events[0] },
      }).catch(() => {});
    } else {
      supabase.functions.invoke('track-walkthrough', {
        body: { action: 'track_batch', events },
      }).catch(() => {});
    }
  }, []);

  // ---- PRE-LOAD AUDIO BLOB ON MOUNT ----
  // We only fetch the audio bytes and store as a blob URL.
  // We do NOT create the Audio element here — that happens in the click handler
  // to satisfy browser autoplay policies.
  useEffect(() => {
    mountedRef.current = true;

    const preloadAudio = async () => {
      if (Platform.OS !== 'web') {
        if (mountedRef.current) {
          setAudioLoading(false);
          setAudioError(true);
        }
        return;
      }

      try {
        console.log('[Audio] Fetching audio from edge function...');
        const response = await fetch(
          `${supabaseUrl}/functions/v1/generate-welcome-audio`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseKey}`,
            },
            body: JSON.stringify({}),
          }
        );

        console.log('[Audio] Response status:', response.status, 'Content-Type:', response.headers.get('Content-Type'));

        if (!response.ok) {
          throw new Error(`Audio fetch failed: ${response.status}`);
        }

        // Always try to get the response as a blob
        const blob = await response.blob();
        console.log('[Audio] Blob size:', blob.size, 'type:', blob.type);

        if (blob.size < 1000) {
          // Too small — might be an error response
          const text = await blob.text();
          console.error('[Audio] Response too small, content:', text);
          throw new Error('Audio response too small: ' + text.substring(0, 200));
        }

        // Create a blob URL with explicit audio type
        const audioBlob = new Blob([blob], { type: 'audio/mpeg' });
        const blobUrl = URL.createObjectURL(audioBlob);
        blobUrlRef.current = blobUrl;

        console.log('[Audio] Blob URL created:', blobUrl);

        if (mountedRef.current) {
          setAudioReady(true);
          setAudioLoading(false);
          setAudioError(false);
        }
      } catch (error) {
        console.error('[Audio] Preload error:', error);
        if (mountedRef.current) {
          setAudioError(true);
          setAudioLoading(false);
          setAudioReady(false);
        }
        trackEvent('audio_error', { metadata: { error: String(error) } });
      }
    };

    preloadAudio();

    return () => {
      mountedRef.current = false;
      if (blobUrlRef.current) {
        try { URL.revokeObjectURL(blobUrlRef.current); } catch {}
      }
    };
  }, []);



  // Audio cleanup on unmount ONLY (separate from tracking effect)
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        try {
          audioRef.current.pause();
          audioRef.current = null;
        } catch (e) {}
      }
    };
  }, []);

  // Track drop-off on unmount
  useEffect(() => {
    return () => {
      if (flushTimerRef.current) clearTimeout(flushTimerRef.current);

      if (hasStarted && !hasTrackedComplete.current) {
        const durationMs = walkthroughStartTime.current > 0
          ? Date.now() - walkthroughStartTime.current
          : 0;

        const event = {
          sessionId: sessionIdRef.current,
          userId: getUserId(),
          eventType: 'drop_off',
          sceneIndex: currentScene,
          audioPlayed: audioDidPlay.current,
          durationMs,
          metadata: null,
          deviceInfo: deviceInfoRef.current,
        };

        if (Platform.OS === 'web') {
          // Use the local API handler instead of sendBeacon to edge function
          supabase.functions.invoke('track-walkthrough', {
            body: { action: 'track', ...event },
          }).catch(() => {});
        } else {
          supabase.functions.invoke('track-walkthrough', {
            body: { action: 'track', ...event },
          }).catch(() => {});
        }

      }

      const remaining = [...eventQueueRef.current];
      eventQueueRef.current = [];
      if (remaining.length > 0) {
        supabase.functions.invoke('track-walkthrough', {
          body: { action: 'track_batch', events: remaining },
        }).catch(() => {});
      }

      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [hasStarted, currentScene, getUserId]);


  // Subtitle animation when scene changes
  useEffect(() => {
    subtitleFade.setValue(0);
    Animated.timing(subtitleFade, {
      toValue: 1,
      duration: 500,
      delay: 300,
      useNativeDriver: true,
    }).start();
  }, [currentScene]);

  // Track scene views
  useEffect(() => {
    if (hasStarted && isPlaying) {
      trackEvent('scene_view', { sceneIndex: currentScene });
    }
  }, [currentScene, hasStarted, isPlaying, trackEvent]);

  const advanceScene = useCallback(() => {
    setCurrentScene(prev => {
      const next = prev + 1;
      if (next >= TOTAL_SCENES) {
        setIsPlaying(false);
        if (!hasTrackedComplete.current) {
          hasTrackedComplete.current = true;
          const durationMs = walkthroughStartTime.current > 0
            ? Date.now() - walkthroughStartTime.current
            : 0;
          trackEvent('complete', { sceneIndex: TOTAL_SCENES - 1, durationMs });
        }
        return prev;
      }
      return next;
    });
  }, [trackEvent]);

  // Schedule next scene
  useEffect(() => {
    if (!isPlaying) return;

    sceneStartTime.current = Date.now();

    const totalDuration = SCENE_DURATIONS.reduce((a, b) => a + b, 0);
    const elapsed = SCENE_DURATIONS.slice(0, currentScene).reduce((a, b) => a + b, 0);
    const sceneEnd = elapsed + SCENE_DURATIONS[currentScene];

    progressAnim.setValue(elapsed / totalDuration);
    Animated.timing(progressAnim, {
      toValue: sceneEnd / totalDuration,
      duration: SCENE_DURATIONS[currentScene],
      useNativeDriver: false,
    }).start();

    timerRef.current = setTimeout(() => {
      if (currentScene < TOTAL_SCENES - 1) {
        advanceScene();
      } else {
        setIsPlaying(false);
        if (!hasTrackedComplete.current) {
          hasTrackedComplete.current = true;
          const durationMs = walkthroughStartTime.current > 0
            ? Date.now() - walkthroughStartTime.current
            : 0;
          trackEvent('complete', { sceneIndex: TOTAL_SCENES - 1, durationMs });
        }
      }
    }, SCENE_DURATIONS[currentScene]);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [currentScene, isPlaying]);

  // ---- CREATE AND PLAY AUDIO (must be called from user gesture) ----
  const createAndPlayAudio = useCallback((blobUrl: string) => {
    if (Platform.OS !== 'web') return;

    try {
      // If we already have an audio element, reuse it
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.muted = false;
        audioRef.current.volume = 1.0;
      } else {
        // Create the Audio element RIGHT HERE in the click handler
        // This is critical for browser autoplay policy compliance
        console.log('[Audio] Creating Audio element with blob URL:', blobUrl);
        const audio = new Audio(blobUrl);
        audio.volume = 1.0;
        audio.muted = false;
        audio.playbackRate = 1.08; // Slightly faster for natural conversational pace
        audioRef.current = audio;


        // Listen for end
        audio.onended = () => {
          if (mountedRef.current) {
            setAudioPlaying(false);
          }
        };

        audio.onerror = (e) => {
          console.error('[Audio] Playback error:', e);
          if (mountedRef.current) {
            setAudioError(true);
            setAudioPlaying(false);
          }
        };
      }

      // Play immediately — we're in the user gesture chain
      console.log('[Audio] Calling play()...');
      const playPromise = audioRef.current.play();
      if (playPromise && typeof playPromise.then === 'function') {
        playPromise.then(() => {
          console.log('[Audio] Play succeeded!');
          if (mountedRef.current) {
            audioDidPlay.current = true;
            setAudioPlaying(true);
            setAudioError(false);
            trackEvent('audio_play');
          }
        }).catch((err: any) => {
          console.warn('[Audio] Play failed:', err.name, err.message);
          if (mountedRef.current) {
            setAudioError(true);
            setAudioPlaying(false);
          }
        });
      }
    } catch (e) {
      console.error('[Audio] Create/play exception:', e);
      if (mountedRef.current) {
        setAudioError(true);
        setAudioPlaying(false);
      }
    }
  }, [trackEvent]);

  // ---- START WALKTHROUGH ----
  // CRITICAL: Audio element creation AND play() happen DIRECTLY in this click handler
  // to satisfy browser autoplay policies. No setTimeout, no async, no callbacks.
  const startWalkthrough = useCallback(() => {
    setHasStarted(true);
    walkthroughStartTime.current = Date.now();
    hasTrackedComplete.current = false;

    trackEvent('start', { sceneIndex: 0 });

    // Create and play audio IMMEDIATELY in the gesture chain
    if (blobUrlRef.current && audioReady && !audioError) {
      createAndPlayAudio(blobUrlRef.current);
    } else if (!audioReady && !audioError && Platform.OS === 'web') {
      // Audio still loading — poll for it
      console.log('[Audio] Not ready yet, will poll...');
      const checkReady = setInterval(() => {
        if (blobUrlRef.current && !audioRef.current) {
          console.log('[Audio] Blob URL now available, creating audio...');
          createAndPlayAudio(blobUrlRef.current);
          clearInterval(checkReady);
        }
      }, 500);
      setTimeout(() => clearInterval(checkReady), 15000);
    }

    // Fade out start screen
    Animated.timing(bgOpacity, {
      toValue: 0,
      duration: 400,
      useNativeDriver: true,
    }).start();

    // Start scenes after a brief transition
    setTimeout(() => {
      if (mountedRef.current) {
        setCurrentScene(0);
        setIsPlaying(true);
      }
    }, 500);
  }, [audioReady, audioError, createAndPlayAudio, trackEvent]);

  // ---- TOGGLE MUTE ----
  const toggleMute = useCallback(() => {
    if (!audioRef.current) return;

    const newMuted = !audioMuted;
    setAudioMuted(newMuted);

    try {
      audioRef.current.muted = newMuted;

      // If unmuting and audio isn't playing yet, try to play
      if (!newMuted && audioRef.current.paused) {
        audioRef.current.play().then(() => {
          audioDidPlay.current = true;
          if (mountedRef.current) {
            setAudioPlaying(true);
            trackEvent('audio_play');
          }
        }).catch(() => {});
      }
    } catch (e) {}
  }, [audioMuted, trackEvent]);

  // ---- RETRY AUDIO ----
  const retryAudio = useCallback(() => {
    if (blobUrlRef.current) {
      // This is called from a user gesture (tap), so we can create and play
      createAndPlayAudio(blobUrlRef.current);
    }
  }, [createAndPlayAudio]);


  const skipToEnd = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (audioRef.current) {
      try { audioRef.current.pause(); } catch (e) {}
    }

    if (!hasTrackedComplete.current) {
      hasTrackedComplete.current = true;
      const durationMs = walkthroughStartTime.current > 0
        ? Date.now() - walkthroughStartTime.current
        : 0;
      trackEvent('skip', { sceneIndex: currentScene, durationMs });
    }

    setIsPlaying(false);
    setAudioPlaying(false);
    router.back();
  }, [router, currentScene, trackEvent]);

  const goToScene = useCallback((index: number) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setCurrentScene(index);

    // Try to sync audio position (rough estimate)
    if (audioRef.current && audioPlaying) {
      try {
        const elapsed = SCENE_DURATIONS.slice(0, index).reduce((a, b) => a + b, 0);
        audioRef.current.currentTime = elapsed / 1000;
      } catch {}
    }
  }, [audioPlaying]);

  const topPadding = Platform.OS === 'web' ? 20 : insets.top;
  const bottomPadding = Platform.OS === 'web' ? 20 : insets.bottom;

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      {/* Background gradient effect */}
      <View style={styles.bgGradient}>
        <View style={[styles.bgCircle, styles.bgCircle1]} />
        <View style={[styles.bgCircle, styles.bgCircle2]} />
        <View style={[styles.bgCircle, styles.bgCircle3]} />
      </View>

      {/* Top controls */}
      <View style={styles.topControls}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            if (hasStarted && !hasTrackedComplete.current) {
              hasTrackedComplete.current = true;
              const durationMs = walkthroughStartTime.current > 0
                ? Date.now() - walkthroughStartTime.current
                : 0;
              trackEvent('drop_off', { sceneIndex: currentScene, durationMs });
            }
            if (audioRef.current) {
              try { audioRef.current.pause(); } catch (e) {}
            }
            router.back();
          }}
          accessibilityLabel="Go back"
        >
          <MaterialIcons name="close" size={22} color={Colors.textSecondary} />
        </TouchableOpacity>

        <View style={styles.topRight}>
          {/* Audio toggle button — always visible during walkthrough */}
          {hasStarted && (
            <TouchableOpacity
              style={[
                styles.audioToggle,
                audioError && !audioReady && styles.audioToggleError,
              ]}
              onPress={() => {
                if (audioError || (!audioPlaying && audioReady)) {
                  retryAudio();
                } else {
                  toggleMute();
                }
              }}
              accessibilityLabel={audioMuted ? 'Unmute audio' : 'Mute audio'}
            >
              <MaterialIcons
                name={
                  audioError ? 'volume-off' :
                  audioMuted ? 'volume-off' :
                  audioPlaying ? 'volume-up' :
                  audioLoading ? 'hourglass-empty' :
                  'volume-up'
                }
                size={18}
                color={
                  audioError ? Colors.error :
                  audioPlaying && !audioMuted ? Colors.primary :
                  Colors.textSecondary
                }
              />
            </TouchableOpacity>
          )}

          {hasStarted && (
            <TouchableOpacity
              style={styles.skipButton}
              onPress={skipToEnd}
              accessibilityLabel="Skip walkthrough"
            >
              <Text style={styles.skipText}>Skip</Text>
              <MaterialIcons name="skip-next" size={16} color={Colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Start Screen (before walkthrough begins) */}
      {!hasStarted && (
        <Animated.View style={[styles.startScreen, { opacity: bgOpacity }]}>
          <View style={styles.startContent}>
            <View style={styles.startLogoCircle}>
              <MaterialIcons name="play-arrow" size={48} color={Colors.white} />
            </View>
            <Text style={styles.startTitle}>Welcome to SpotMe</Text>

            <Text style={styles.startSubtitle}>
              Take a quick tour and learn how{'\n'}to browse, post, and support others.
            </Text>
            <Text style={styles.startDuration}>
              <MaterialIcons name="schedule" size={14} color={Colors.textLight} />
              {'  '}About 1 minute
            </Text>


            {/* Audio loading status on start screen */}
            <View style={styles.audioPreloadStatus}>
              {audioLoading && (
                <>
                  <ActivityIndicator size="small" color={Colors.primary} />
                  <Text style={styles.audioPreloadText}>Loading voiceover...</Text>
                </>
              )}
              {audioReady && !audioError && (
                <>
                  <MaterialIcons name="check-circle" size={16} color={Colors.success} />
                  <Text style={[styles.audioPreloadText, { color: Colors.success }]}>Audio ready</Text>
                </>
              )}
              {audioError && !audioLoading && (
                <>
                  <MaterialIcons name="volume-off" size={16} color={Colors.textLight} />
                  <Text style={styles.audioPreloadText}>Audio unavailable — will play without sound</Text>
                </>
              )}
            </View>

            <TouchableOpacity
              style={styles.startButton}
              onPress={startWalkthrough}
              activeOpacity={0.8}
            >
              <MaterialIcons name="play-circle-filled" size={22} color={Colors.white} />
              <Text style={styles.startButtonText}>Watch Walkthrough</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.skipStartButton}
              onPress={() => router.back()}
              activeOpacity={0.7}
            >
              <Text style={styles.skipStartText}>Maybe later</Text>
            </TouchableOpacity>
          </View>

          {/* Audio indicator */}
          <View style={styles.audioNote}>
            <MaterialIcons name="volume-up" size={14} color={Colors.textLight} />
            <Text style={styles.audioNoteText}>Best with sound on</Text>
          </View>
        </Animated.View>
      )}

      {/* Scene Content */}
      {hasStarted && (
        <View style={styles.sceneContainer}>
          <WalkthroughScene sceneIndex={currentScene} isActive={isPlaying || hasStarted} />
        </View>
      )}

      {/* Bottom Controls */}
      {hasStarted && (
        <View style={[styles.bottomControls, { paddingBottom: bottomPadding + 16 }]}>
          {/* Subtitle */}
          <Animated.View style={[styles.subtitleContainer, { opacity: subtitleFade }]}>
            <Text style={styles.subtitleText}>{SCENE_SUBTITLES[currentScene]}</Text>
          </Animated.View>

          {/* Progress bar */}
          <View style={styles.progressContainer}>
            <View style={styles.progressTrack}>
              <Animated.View
                style={[
                  styles.progressFill,
                  {
                    width: progressAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0%', '100%'],
                    }),
                  },
                ]}
              />
            </View>
            {/* Scene dots */}
            <View style={styles.sceneDots}>
              {[...Array(TOTAL_SCENES)].map((_, i) => (
                <TouchableOpacity
                  key={i}
                  onPress={() => goToScene(i)}
                  style={[
                    styles.sceneDot,
                    i === currentScene && styles.sceneDotActive,
                    i < currentScene && styles.sceneDotPast,
                  ]}
                />
              ))}
            </View>
          </View>

          {/* Navigation buttons */}
          <View style={styles.navRow}>
            <TouchableOpacity
              style={[styles.navButton, currentScene === 0 && styles.navButtonDisabled]}
              onPress={() => currentScene > 0 && goToScene(currentScene - 1)}
              disabled={currentScene === 0}
            >
              <MaterialIcons
                name="chevron-left"
                size={24}
                color={currentScene === 0 ? Colors.textLight : Colors.text}
              />
            </TouchableOpacity>

            {/* Play/Pause */}
            <TouchableOpacity
              style={styles.playPauseButton}
              onPress={() => {
                if (currentScene >= TOTAL_SCENES - 1 && !isPlaying) {
                  // Replay
                  hasTrackedComplete.current = false;
                  walkthroughStartTime.current = Date.now();
                  trackEvent('replay', { sceneIndex: 0 });
                  setCurrentScene(0);
                  setIsPlaying(true);
                  if (audioRef.current) {
                    try {
                      audioRef.current.currentTime = 0;
                      audioRef.current.muted = audioMuted;
                      audioRef.current.play().then(() => {
                        audioDidPlay.current = true;
                        if (mountedRef.current) setAudioPlaying(true);
                      }).catch(() => {});
                    } catch (e) {}
                  }
                } else {
                  const newPlaying = !isPlaying;
                  setIsPlaying(newPlaying);
                  if (audioRef.current) {
                    try {
                      if (newPlaying) {
                        audioRef.current.play().then(() => {
                          audioDidPlay.current = true;
                          if (mountedRef.current) setAudioPlaying(true);
                        }).catch(() => {});
                      } else {
                        audioRef.current.pause();
                        setAudioPlaying(false);
                      }
                    } catch (e) {}
                  }
                }
              }}
            >
              <MaterialIcons
                name={
                  currentScene >= TOTAL_SCENES - 1 && !isPlaying
                    ? 'replay'
                    : isPlaying
                    ? 'pause'
                    : 'play-arrow'
                }
                size={28}
                color={Colors.white}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.navButton, currentScene >= TOTAL_SCENES - 1 && styles.navButtonDisabled]}
              onPress={() => {
                if (currentScene < TOTAL_SCENES - 1) {
                  goToScene(currentScene + 1);
                }
              }}
              disabled={currentScene >= TOTAL_SCENES - 1}
            >
              <MaterialIcons
                name="chevron-right"
                size={24}
                color={currentScene >= TOTAL_SCENES - 1 ? Colors.textLight : Colors.text}
              />
            </TouchableOpacity>
          </View>

          {/* Get Started button (shows on last scene) */}
          {currentScene >= TOTAL_SCENES - 1 && !isPlaying && (
            <TouchableOpacity
              style={styles.getStartedButton}
              onPress={() => {
                if (!hasTrackedComplete.current) {
                  hasTrackedComplete.current = true;
                  const durationMs = walkthroughStartTime.current > 0
                    ? Date.now() - walkthroughStartTime.current
                    : 0;
                  trackEvent('complete', { sceneIndex: TOTAL_SCENES - 1, durationMs });
                }
                router.back();
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.getStartedText}>Get Started</Text>
              <MaterialIcons name="arrow-forward" size={18} color={Colors.white} />
            </TouchableOpacity>
          )}

          {/* Audio status bar at bottom */}
          {hasStarted && (
            <View style={styles.audioStatusBar}>
              {audioPlaying && !audioMuted && (
                <>
                  <View style={styles.audioWave}>
                    {[0, 1, 2, 3, 4].map(i => (
                      <View
                        key={i}
                        style={[
                          styles.audioWaveBar,
                          { height: [8, 14, 10, 16, 6][i], opacity: 0.6 + Math.random() * 0.4 },
                        ]}
                      />
                    ))}
                  </View>
                  <Text style={styles.audioStatusText}>Playing voiceover</Text>
                </>
              )}
              {audioPlaying && audioMuted && (
                <>
                  <MaterialIcons name="volume-off" size={12} color={Colors.textLight} />
                  <Text style={styles.audioStatusText}>Muted</Text>
                </>
              )}
              {!audioPlaying && audioLoading && (
                <>
                  <ActivityIndicator size="small" color={Colors.textLight} style={{ transform: [{ scale: 0.7 }] }} />
                  <Text style={styles.audioStatusText}>Loading audio...</Text>
                </>
              )}
              {!audioPlaying && !audioLoading && audioError && (
                <TouchableOpacity style={styles.retryRow} onPress={retryAudio}>
                  <MaterialIcons name="refresh" size={12} color={Colors.primary} />
                  <Text style={[styles.audioStatusText, { color: Colors.primary }]}>Tap to retry audio</Text>
                </TouchableOpacity>
              )}
              {!audioPlaying && !audioLoading && !audioError && audioReady && hasStarted && (
                <>
                  <MaterialIcons name="volume-off" size={12} color={Colors.textLight} />
                  <Text style={styles.audioStatusText}>Audio paused</Text>
                </>
              )}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  bgGradient: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  bgCircle: {
    position: 'absolute',
    borderRadius: 999,
  },
  bgCircle1: {
    width: SCREEN_WIDTH * 1.5,
    height: SCREEN_WIDTH * 1.5,
    backgroundColor: Colors.primaryLight + '40',
    top: -SCREEN_WIDTH * 0.5,
    right: -SCREEN_WIDTH * 0.3,
  },
  bgCircle2: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH,
    backgroundColor: Colors.selfCareLight + '30',
    bottom: -SCREEN_WIDTH * 0.3,
    left: -SCREEN_WIDTH * 0.3,
  },
  bgCircle3: {
    width: SCREEN_WIDTH * 0.6,
    height: SCREEN_WIDTH * 0.6,
    backgroundColor: Colors.accentLight + '40',
    top: SCREEN_HEIGHT * 0.3,
    left: SCREEN_WIDTH * 0.5,
  },

  // Top controls
  topControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
    zIndex: 10,
  },
  topRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.sm,
  },
  audioToggle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.sm,
  },
  audioToggleError: {
    borderWidth: 1,
    borderColor: Colors.error + '40',
  },
  skipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.full,
    ...Shadow.sm,
  },
  skipText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
  },

  // Start screen
  startScreen: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startContent: {
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 40,
  },
  startLogoCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.lg,
    marginBottom: 8,
  },
  startTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: Colors.text,
    letterSpacing: -0.5,
  },
  startSubtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    fontWeight: '500',
  },
  startDuration: {
    fontSize: 13,
    color: Colors.textLight,
    marginTop: 4,
  },
  audioPreloadStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
    minHeight: 24,
  },
  audioPreloadText: {
    fontSize: 13,
    color: Colors.textLight,
    fontWeight: '500',
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: BorderRadius.full,
    marginTop: 8,
    ...Shadow.md,
  },
  startButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.white,
  },
  skipStartButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  skipStartText: {
    fontSize: 15,
    color: Colors.textLight,
    fontWeight: '600',
  },
  audioNote: {
    position: 'absolute',
    bottom: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  audioNoteText: {
    fontSize: 13,
    color: Colors.textLight,
    fontWeight: '500',
  },

  // Scene container
  sceneContainer: {
    flex: 1,
    zIndex: 5,
  },

  // Bottom controls
  bottomControls: {
    paddingHorizontal: Spacing.xl,
    gap: 12,
    zIndex: 10,
  },
  subtitleContainer: {
    alignItems: 'center',
    paddingHorizontal: 20,
    minHeight: 48,
  },
  subtitleText: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    fontWeight: '500',
    fontStyle: 'italic',
  },

  // Progress
  progressContainer: {
    gap: 8,
  },
  progressTrack: {
    height: 3,
    backgroundColor: Colors.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 2,
  },
  sceneDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  sceneDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.border,
  },
  sceneDotActive: {
    backgroundColor: Colors.primary,
    width: 20,
    borderRadius: 4,
  },
  sceneDotPast: {
    backgroundColor: Colors.primaryLight,
  },

  // Navigation
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  navButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.sm,
  },
  navButtonDisabled: {
    opacity: 0.4,
  },
  playPauseButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.md,
  },

  // Get Started
  getStartedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: BorderRadius.full,
    ...Shadow.md,
  },
  getStartedText: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.white,
  },

  // Audio status bar
  audioStatusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 4,
    minHeight: 24,
  },
  audioStatusText: {
    fontSize: 12,
    color: Colors.textLight,
    fontWeight: '500',
  },
  audioWave: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    height: 16,
  },
  audioWaveBar: {
    width: 3,
    backgroundColor: Colors.primary,
    borderRadius: 1.5,
  },
  retryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 12,
    backgroundColor: Colors.primaryLight,
    borderRadius: BorderRadius.full,
  },
});
