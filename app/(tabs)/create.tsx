import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, Animated, Image, ActivityIndicator, Alert, Dimensions, Easing } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, BorderRadius, FontSize, Spacing, Shadow, CategoryColors } from '@/app/lib/theme';
import { useApp } from '@/app/lib/store';
import { CATEGORIES, NEED_PHOTOS } from '@/app/lib/data';
import { pickNeedPhoto, uploadNeedPhoto, UploadProgressCallback } from '@/app/lib/imageUpload';
import { hapticLight, hapticMedium, hapticSuccess, hapticSelection } from '@/app/lib/haptics';
import ConfettiAnimation from '@/components/ConfettiAnimation';
import UploadProgressBar from '@/components/UploadProgressBar';
import ImageEditor from '@/components/ImageEditor';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const GOAL_PRESETS = [25, 50, 75, 100, 150, 200, 250, 300];
const MAX_GOAL = 300;

export default function CreateScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { createNeed, isLoggedIn, currentUser } = useApp();
  
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState('');
  const [goalAmount, setGoalAmount] = useState(50);
  const [customGoal, setCustomGoal] = useState('');
  const [isCustomGoal, setIsCustomGoal] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  // Photo upload state
  const [photoLocalUri, setPhotoLocalUri] = useState<string | null>(null);
  const [photoBase64, setPhotoBase64] = useState<string>('');
  const [photoMimeType, setPhotoMimeType] = useState<string>('image/jpeg');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  // Upload progress state
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<'compressing' | 'uploading' | 'retrying' | 'success' | 'error'>('uploading');
  const [uploadRetryCount, setUploadRetryCount] = useState(0);

  // Image editor state
  const [showImageEditor, setShowImageEditor] = useState(false);
  const [rawPickedUri, setRawPickedUri] = useState<string>('');
  const [rawPickedBase64, setRawPickedBase64] = useState<string>('');

  // Animation refs
  const bannerAnim = useRef(new Animated.Value(0)).current;
  const bannerShown = useRef(false);
  const autoAdvanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Slide transition animation
  const slideAnim = useRef(new Animated.Value(0)).current;
  const slideDirection = useRef<'forward' | 'backward'>('forward');

  // Progress dot pulse animations
  const dotPulse1 = useRef(new Animated.Value(1)).current;
  const dotPulse2 = useRef(new Animated.Value(1)).current;
  const dotPulse3 = useRef(new Animated.Value(1)).current;
  const dotPulses = [dotPulse1, dotPulse2, dotPulse3];

  // Success screen animations
  const successScale = useRef(new Animated.Value(0)).current;
  const successOpacity = useRef(new Animated.Value(0)).current;
  const successCheckScale = useRef(new Animated.Value(0)).current;

  // Step content fade/slide
  const contentOpacity = useRef(new Animated.Value(1)).current;
  const contentTranslateX = useRef(new Animated.Value(0)).current;

  const categories = CATEGORIES.filter(c => c.name !== 'All');
  const prevStepRef = useRef(1);

  // Clean up auto-advance timer on unmount
  useEffect(() => {
    return () => {
      if (autoAdvanceTimer.current) {
        clearTimeout(autoAdvanceTimer.current);
      }
    };
  }, []);

  // Animate step transitions
  useEffect(() => {
    const prevStep = prevStepRef.current;
    const isForward = step > prevStep;
    prevStepRef.current = step;

    if (prevStep === step) return;

    // Pulse the completed dot
    if (isForward && prevStep >= 1 && prevStep <= 3) {
      const pulseAnim = dotPulses[prevStep - 1];
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.4,
          duration: 200,
          easing: Easing.out(Easing.back(2)),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 300,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start();
    }

    // Also pulse the current dot
    if (step >= 1 && step <= 3) {
      const currentPulse = dotPulses[step - 1];
      Animated.sequence([
        Animated.delay(100),
        Animated.timing(currentPulse, {
          toValue: 1.25,
          duration: 150,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(currentPulse, {
          toValue: 1,
          duration: 200,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start();
    }

    const slideOut = isForward ? -SCREEN_WIDTH * 0.3 : SCREEN_WIDTH * 0.3;
    const slideIn = isForward ? SCREEN_WIDTH * 0.3 : -SCREEN_WIDTH * 0.3;

    hapticMedium();

    Animated.sequence([
      Animated.parallel([
        Animated.timing(contentOpacity, {
          toValue: 0,
          duration: 120,
          useNativeDriver: true,
        }),
        Animated.timing(contentTranslateX, {
          toValue: slideOut,
          duration: 120,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(contentTranslateX, {
          toValue: slideIn,
          duration: 0,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(contentOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(contentTranslateX, {
          toValue: 0,
          tension: 65,
          friction: 10,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [step]);

  // Handle category selection with haptic + auto-advance
  const handleCategorySelect = useCallback((catName: string) => {
    if (autoAdvanceTimer.current) {
      clearTimeout(autoAdvanceTimer.current);
    }
    hapticLight();
    setCategory(catName);
    autoAdvanceTimer.current = setTimeout(() => {
      setStep(2);
    }, 400);
  }, []);

  const getGoal = () => {
    if (isCustomGoal) {
      const parsed = parseInt(customGoal) || 0;
      return Math.min(parsed, MAX_GOAL);
    }
    return goalAmount;
  };

  const isAtMax = getGoal() >= MAX_GOAL;

  useEffect(() => {
    if (isAtMax && !bannerShown.current) {
      bannerShown.current = true;
      hapticSelection();
      Animated.spring(bannerAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 50,
        friction: 8,
      }).start();
    } else if (!isAtMax && bannerShown.current) {
      bannerShown.current = false;
      Animated.timing(bannerAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [isAtMax]);

  const canProceed = () => {
    switch (step) {
      case 1: return category.length > 0;
      case 2: return title.trim().length >= 3 && message.trim().length >= 10;
      case 3: return getGoal() >= 25 && getGoal() <= MAX_GOAL;
      default: return false;
    }
  };

  const handleCustomGoalChange = (text: string) => {
    const numeric = text.replace(/[^0-9]/g, '');
    const parsed = parseInt(numeric) || 0;
    if (parsed > MAX_GOAL) {
      setCustomGoal(String(MAX_GOAL));
    } else {
      setCustomGoal(numeric);
    }
  };

  const handleGoalPresetSelect = (amount: number) => {
    hapticSelection();
    setGoalAmount(amount);
    setIsCustomGoal(false);
  };

  // ---- Progress callback for uploads ----
  const handleUploadProgress: UploadProgressCallback = useCallback((progress, status) => {
    setUploadProgress(progress);
    setUploadStatus(status);
    if (status === 'retrying') {
      setUploadRetryCount(prev => prev + 1);
    }
  }, []);

  // ---- Photo Picker Handler ----
  const handlePickPhoto = async () => {
    if (isUploadingPhoto) return;
    
    setPhotoError(null);
    
    try {
      const picked = await pickNeedPhoto();
      if (!picked) return;
      
      // Store raw picked data and open editor
      setRawPickedUri(picked.uri);
      setRawPickedBase64(picked.base64);
      setPhotoMimeType(picked.mimeType);
      setShowImageEditor(true);
    } catch (err: any) {
      setPhotoError('Something went wrong picking the photo.');
    }
  };

  // ---- Handle edited image from ImageEditor ----
  const handleImageEdited = useCallback(async (editedUri: string, editedBase64: string) => {
    setShowImageEditor(false);
    
    // Use edited data if available, fall back to raw
    const finalUri = editedUri || rawPickedUri;
    const finalBase64 = editedBase64 || rawPickedBase64;
    
    setPhotoLocalUri(finalUri);
    setPhotoBase64(finalBase64);
    setIsUploadingPhoto(true);
    setPhotoError(null);
    setUploadProgress(0);
    setUploadStatus('compressing');
    setUploadRetryCount(0);
    
    hapticLight();
    
    const userId = currentUser.id !== 'guest' ? currentUser.id : 'anonymous';
    const result = await uploadNeedPhoto(
      userId,
      finalBase64,
      photoMimeType,
      title || 'need-photo',
      handleUploadProgress
    );
    
    if (result.success && result.photoUrl) {
      setPhotoUrl(result.photoUrl);
      setIsUploadingPhoto(false);
      hapticSuccess();
    } else {
      setPhotoError(result.error || 'Upload failed. A default image will be used instead.');
      setIsUploadingPhoto(false);
    }
  }, [rawPickedUri, rawPickedBase64, photoMimeType, currentUser.id, title, handleUploadProgress]);

  // ---- Handle skipping editor (use original) ----
  const handleEditorCancel = useCallback(() => {
    setShowImageEditor(false);
    // If user cancels editor, still upload the original
    if (rawPickedUri && rawPickedBase64) {
      handleImageEdited(rawPickedUri, rawPickedBase64);
    }
  }, [rawPickedUri, rawPickedBase64, handleImageEdited]);

  // ---- Retry failed upload ----
  const handleRetryUpload = useCallback(async () => {
    if (!photoBase64 || !photoLocalUri) return;
    
    setIsUploadingPhoto(true);
    setPhotoError(null);
    setUploadProgress(0);
    setUploadStatus('uploading');
    setUploadRetryCount(0);
    
    hapticLight();
    
    const userId = currentUser.id !== 'guest' ? currentUser.id : 'anonymous';
    const result = await uploadNeedPhoto(
      userId,
      photoBase64,
      photoMimeType,
      title || 'need-photo',
      handleUploadProgress
    );
    
    if (result.success && result.photoUrl) {
      setPhotoUrl(result.photoUrl);
      setIsUploadingPhoto(false);
      hapticSuccess();
    } else {
      setPhotoError(result.error || 'Upload failed. A default image will be used instead.');
      setIsUploadingPhoto(false);
    }
  }, [photoBase64, photoLocalUri, photoMimeType, currentUser.id, title, handleUploadProgress]);

  const handleRemovePhoto = () => {
    setPhotoLocalUri(null);
    setPhotoBase64('');
    setPhotoUrl(null);
    setPhotoError(null);
    setIsUploadingPhoto(false);
    setUploadProgress(0);
    setUploadRetryCount(0);
  };

  // ---- Open editor for existing photo ----
  const handleEditPhoto = () => {
    if (photoLocalUri) {
      setRawPickedUri(photoLocalUri);
      setRawPickedBase64(photoBase64);
      setShowImageEditor(true);
    }
  };

  const handleSubmit = () => {
    if (!isLoggedIn) {
      router.push('/auth');
      return;
    }

    const finalPhoto = photoUrl || NEED_PHOTOS[Math.floor(Math.random() * NEED_PHOTOS.length)];

    createNeed({
      title: title.trim(),
      message: message.trim(),
      category,
      goalAmount: getGoal(),
      photo: finalPhoto,
    });

    hapticSuccess();

    setSubmitted(true);
    setShowConfetti(true);

    successScale.setValue(0);
    successOpacity.setValue(0);
    successCheckScale.setValue(0);

    Animated.sequence([
      Animated.parallel([
        Animated.spring(successScale, {
          toValue: 1,
          tension: 65,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.timing(successOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]),
      Animated.spring(successCheckScale, {
        toValue: 1,
        tension: 50,
        friction: 6,
        useNativeDriver: true,
      }),
    ]).start();

    setTimeout(() => setShowConfetti(false), 3500);
  };

  const handleStepChange = (newStep: number) => {
    if (newStep > step) {
      hapticMedium();
    } else {
      hapticLight();
    }
    setStep(newStep);
  };

  const handleReset = () => {
    if (autoAdvanceTimer.current) {
      clearTimeout(autoAdvanceTimer.current);
      autoAdvanceTimer.current = null;
    }
    setStep(1);
    prevStepRef.current = 1;
    setTitle('');
    setMessage('');
    setCategory('');
    setGoalAmount(50);
    setCustomGoal('');
    setIsCustomGoal(false);
    setSubmitted(false);
    setShowConfetti(false);
    setPhotoLocalUri(null);
    setPhotoBase64('');
    setPhotoUrl(null);
    setPhotoError(null);
    setIsUploadingPhoto(false);
    setUploadProgress(0);
    setUploadRetryCount(0);
    bannerShown.current = false;
    bannerAnim.setValue(0);
    contentOpacity.setValue(1);
    contentTranslateX.setValue(0);
    successScale.setValue(0);
    successOpacity.setValue(0);
    successCheckScale.setValue(0);
    dotPulses.forEach(p => p.setValue(1));
  };

  const handleGoHome = () => {
    handleReset();
    try {
      router.navigate('/(tabs)/' as any);
    } catch {
      handleReset();
    }
  };

  const topPadding = Platform.OS === 'web' ? 0 : insets.top;
  const WEB_BOTTOM_SAFE = 34;

  if (submitted) {
    return (
      <View style={[styles.container, { paddingTop: topPadding }]}>
        <ConfettiAnimation active={showConfetti} duration={3500} />
        <Animated.View style={[
          styles.successContainer,
          {
            opacity: successOpacity,
            transform: [{ scale: successScale }],
          },
        ]}>
          <Animated.View style={[
            styles.successIcon,
            { transform: [{ scale: successCheckScale }] },
          ]}>
            <MaterialIcons name="check-circle" size={72} color={Colors.success} />
          </Animated.View>
          <Text style={styles.successTitle}>Need Posted!</Text>
          <Text style={styles.successMessage}>
            Your need is now live. The community can start spotting you right away.
          </Text>

          <TouchableOpacity
            style={styles.successButton}
            onPress={handleGoHome}
            activeOpacity={0.8}
          >
            <MaterialIcons name="home" size={20} color={Colors.white} />
            <Text style={styles.successButtonText}>View Feed</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.postAnotherButton}
            onPress={handleReset}
            activeOpacity={0.8}
          >
            <MaterialIcons name="add-circle-outline" size={20} color={Colors.primary} />
            <Text style={styles.postAnotherButtonText}>Post Another Need</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    );
  }

  const Wrapper = Platform.OS === 'web' ? View : KeyboardAvoidingView;
  const wrapperProps = Platform.OS === 'web' ? {} : { behavior: 'padding' as const };

  return (
    <Wrapper
      style={[styles.container, { paddingTop: topPadding }]}
      {...wrapperProps}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Post a Need</Text>
        </View>
        <Text style={styles.headerSubtitle}>Step {step} of 3</Text>
      </View>

      {/* Progress Steps with animated dots */}
      <View style={styles.stepsRow}>
        {[1, 2, 3].map(s => (
          <View key={s} style={styles.stepContainer}>
            <Animated.View style={[
              styles.stepDot,
              s <= step && styles.stepDotActive,
              s < step && styles.stepDotComplete,
              { transform: [{ scale: dotPulses[s - 1] }] },
            ]}>
              {s < step ? (
                <MaterialIcons name="check" size={14} color={Colors.white} />
              ) : (
                <Text style={[styles.stepNumber, s <= step && styles.stepNumberActive]}>{s}</Text>
              )}
            </Animated.View>
            <Text style={[styles.stepLabel, s <= step && styles.stepLabelActive]}>
              {s === 1 ? 'Category' : s === 2 ? 'Details' : 'Goal'}
            </Text>
          </View>
        ))}
        <View style={styles.stepLine}>
          <Animated.View style={[styles.stepLineFill, { width: `${((step - 1) / 2) * 100}%` }]} />
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Animated.View style={{
          opacity: contentOpacity,
          transform: [{ translateX: contentTranslateX }],
        }}>
          {/* Step 1: Category */}
          {step === 1 && (
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>What do you need help with?</Text>
              <Text style={styles.stepDescription}>Choose the category that best fits your need.</Text>
              
              <View style={styles.categoryGrid}>
                {categories.map(cat => {
                  const isSelected = category === cat.name;
                  const color = CategoryColors[cat.name] || Colors.textSecondary;
                  return (
                    <TouchableOpacity
                      key={cat.name}
                      style={[
                        styles.categoryCard,
                        isSelected && { borderColor: color, backgroundColor: color + '15' },
                      ]}
                      onPress={() => handleCategorySelect(cat.name)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.categoryIconBg, { backgroundColor: color + '20' }]}>
                        <MaterialIcons name={cat.icon as any} size={28} color={color} />
                      </View>
                      <Text style={[styles.categoryName, isSelected && { color, fontWeight: '800' }]}>
                        {cat.name}
                      </Text>
                      {isSelected && (
                        <View style={[styles.checkBadge, { backgroundColor: color }]}>
                          <MaterialIcons name="check" size={14} color={Colors.white} />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* Step 2: Details + Photo */}
          {step === 2 && (
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Tell your story</Text>
              <Text style={styles.stepDescription}>Be honest and specific. People connect with real stories.</Text>

              <Text style={styles.inputLabel}>Title</Text>
              <TextInput
                style={styles.textInput}
                value={title}
                onChangeText={setTitle}
                placeholder="e.g., Electric bill is due Friday"
                placeholderTextColor={Colors.textLight}
                maxLength={60}
              />
              <Text style={styles.charCount}>{title.length}/60</Text>

              <Text style={styles.inputLabel}>Your message</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                value={message}
                onChangeText={setMessage}
                placeholder="Explain your situation in a sentence or two. What happened and how will this help?"
                placeholderTextColor={Colors.textLight}
                multiline
                maxLength={200}
                textAlignVertical="top"
              />
              <Text style={styles.charCount}>{message.length}/200</Text>

              {/* Photo Upload Section */}
              <View style={styles.photoSection}>
                <View style={styles.photoLabelRow}>
                  <Text style={styles.inputLabel}>Photo</Text>
                  <Text style={{ fontSize: 11, color: Colors.textLight, fontWeight: '500' }}>Optional</Text>
                </View>

                {!photoLocalUri && (
                  <TouchableOpacity
                    style={styles.photoUploadContainer}
                    onPress={handlePickPhoto}
                    activeOpacity={0.7}
                  >
                    <View style={styles.photoUploadIconWrap}>
                      <MaterialIcons name="add-a-photo" size={28} color={Colors.primary} />
                    </View>
                    <Text style={styles.photoUploadTitle}>Add a photo</Text>
                    <Text style={styles.photoUploadSubtitle}>
                      Tap to choose from your gallery. Auto-compressed to 1200px.
                    </Text>
                    <View style={styles.compressionBadge}>
                      <MaterialIcons name="compress" size={12} color={Colors.textLight} />
                      <Text style={styles.compressionBadgeText}>Auto-optimized for fast loading</Text>
                    </View>
                  </TouchableOpacity>
                )}

                {photoLocalUri && (
                  <View style={styles.photoPreviewContainer}>
                    <Image source={{ uri: photoLocalUri }} style={styles.photoPreviewImage} />
                    
                    {/* Upload progress overlay */}
                    {isUploadingPhoto && (
                      <View style={styles.photoOverlay}>
                        <View style={styles.progressOverlayContent}>
                          <UploadProgressBar
                            progress={uploadProgress}
                            status={uploadStatus}
                            retryCount={uploadRetryCount}
                            maxRetries={3}
                            fileSizeKB={photoBase64 ? Math.round(photoBase64.length * 0.75 / 1024) : undefined}
                          />
                        </View>
                      </View>
                    )}
                    
                    {/* Success badge */}
                    {photoUrl && !isUploadingPhoto && (
                      <View style={styles.photoSuccessBadge}>
                        <MaterialIcons name="check-circle" size={18} color={Colors.white} />
                        <Text style={styles.photoSuccessText}>Uploaded</Text>
                      </View>
                    )}
                    
                    {/* Error badge with retry */}
                    {photoError && !isUploadingPhoto && (
                      <View style={styles.photoErrorBadge}>
                        <MaterialIcons name="warning" size={16} color="#FFF" />
                        <Text style={styles.photoErrorText}>{photoError}</Text>
                      </View>
                    )}

                    {/* Action buttons */}
                    <View style={styles.photoActions}>
                      {/* Edit (crop/rotate) */}
                      <TouchableOpacity
                        style={styles.photoActionBtn}
                        onPress={handleEditPhoto}
                        disabled={isUploadingPhoto}
                        activeOpacity={0.7}
                      >
                        <MaterialIcons name="crop-rotate" size={18} color={Colors.primary} />
                        <Text style={styles.photoActionText}>Edit</Text>
                      </TouchableOpacity>

                      {/* Retry on error */}
                      {photoError && !isUploadingPhoto && (
                        <TouchableOpacity
                          style={[styles.photoActionBtn, { backgroundColor: '#FFF8E7' }]}
                          onPress={handleRetryUpload}
                          activeOpacity={0.7}
                        >
                          <MaterialIcons name="refresh" size={18} color={Colors.accent} />
                          <Text style={[styles.photoActionText, { color: Colors.accent }]}>Retry</Text>
                        </TouchableOpacity>
                      )}

                      {/* Change photo */}
                      <TouchableOpacity
                        style={styles.photoActionBtn}
                        onPress={handlePickPhoto}
                        disabled={isUploadingPhoto}
                        activeOpacity={0.7}
                      >
                        <MaterialIcons name="swap-horiz" size={18} color={Colors.primary} />
                        <Text style={styles.photoActionText}>Change</Text>
                      </TouchableOpacity>

                      {/* Remove */}
                      <TouchableOpacity
                        style={[styles.photoActionBtn, styles.photoRemoveBtn]}
                        onPress={handleRemovePhoto}
                        disabled={isUploadingPhoto}
                        activeOpacity={0.7}
                      >
                        <MaterialIcons name="close" size={18} color="#E85D5D" />
                        <Text style={[styles.photoActionText, { color: '#E85D5D' }]}>Remove</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>

              <View style={styles.tipCard}>
                <MaterialIcons name="lightbulb" size={20} color={Colors.accent} />
                <Text style={styles.tipText}>
                  Tip: Needs with a personal photo get funded 3x faster than those with stock images.
                </Text>
              </View>
            </View>
          )}

          {/* Step 3: Goal */}
          {step === 3 && (
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Set your goal</Text>
              <Text style={styles.stepDescription}>How much do you need? Keep it between $25 and $300.</Text>

              <View style={styles.goalDisplay}>
                <Text style={styles.goalDollar}>$</Text>
                <Text style={styles.goalNumber}>{getGoal()}</Text>
              </View>

              {isAtMax && (
                <Animated.View
                  style={[
                    styles.maxBanner,
                    {
                      opacity: bannerAnim,
                      transform: [{
                        translateY: bannerAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [-10, 0],
                        }),
                      }, {
                        scale: bannerAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.95, 1],
                        }),
                      }],
                    },
                  ]}
                >
                  <View style={styles.maxBannerIconWrap}>
                    <MaterialIcons name="info-outline" size={22} color="#5B8DEF" />
                  </View>
                  <View style={styles.maxBannerContent}>
                    <Text style={styles.maxBannerTitle}>That's the max for a single request</Text>
                    <Text style={styles.maxBannerText}>
                      But no worries! You can post multiple active needs at a time. If one gets funded, you can always create another.
                    </Text>
                  </View>
                </Animated.View>
              )}

              <View style={styles.goalGrid}>
                {GOAL_PRESETS.map(amount => (
                  <TouchableOpacity
                    key={amount}
                    style={[
                      styles.goalButton,
                      !isCustomGoal && goalAmount === amount && styles.goalButtonSelected,
                      amount === MAX_GOAL && !isCustomGoal && goalAmount === amount && styles.goalButtonMax,
                    ]}
                    onPress={() => handleGoalPresetSelect(amount)}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.goalButtonText,
                      !isCustomGoal && goalAmount === amount && styles.goalButtonTextSelected,
                    ]}>
                      ${amount}
                    </Text>
                    {amount === MAX_GOAL && (
                      <Text style={styles.goalMaxLabel}>max</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={[styles.customGoalToggle, isCustomGoal && styles.customGoalToggleActive]}
                onPress={() => { hapticSelection(); setIsCustomGoal(!isCustomGoal); }}
                activeOpacity={0.7}
              >
                <MaterialIcons name="edit" size={18} color={isCustomGoal ? Colors.primary : Colors.textSecondary} />
                <Text style={[styles.customGoalToggleText, isCustomGoal && { color: Colors.primary }]}>
                  Enter custom amount
                </Text>
              </TouchableOpacity>

              {isCustomGoal && (
                <View style={styles.customGoalInput}>
                  <Text style={styles.customDollar}>$</Text>
                  <TextInput
                    style={styles.customGoalField}
                    value={customGoal}
                    onChangeText={handleCustomGoalChange}
                    keyboardType="numeric"
                    placeholder="Enter amount (25-300)"
                    placeholderTextColor={Colors.textLight}
                    maxLength={3}
                    autoFocus
                  />
                  <View style={styles.customGoalMaxHint}>
                    <Text style={styles.customGoalMaxHintText}>max $300</Text>
                  </View>
                </View>
              )}

              {getGoal() > 0 && (
                <View style={styles.feeInfo}>
                  <Text style={styles.feeInfoText}>
                    No platform fees — 100% goes to you
                  </Text>
                  <Text style={styles.feeInfoText}>
                    You'll receive up to ${getGoal()} (Stripe processing: 2.9% + $0.30)
                  </Text>
                </View>
              )}

              {/* Summary */}
              <View style={styles.summaryCard}>
                <Text style={styles.summaryTitle}>Summary</Text>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Category</Text>
                  <Text style={styles.summaryValue} numberOfLines={1}>{category}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Title</Text>
                  <Text style={styles.summaryValue} numberOfLines={1}>{title}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Photo</Text>
                  <View style={styles.summaryPhotoWrap}>
                    {photoUrl ? (
                      <>
                        <Image source={{ uri: photoLocalUri || photoUrl }} style={styles.summaryPhotoThumb} />
                        <Text style={[styles.summaryValue, { color: Colors.success }]} numberOfLines={1}>Custom photo</Text>
                      </>
                    ) : photoLocalUri && isUploadingPhoto ? (
                      <>
                        <Image source={{ uri: photoLocalUri }} style={styles.summaryPhotoThumb} />
                        <Text style={[styles.summaryValue, { color: Colors.accent }]} numberOfLines={1}>Uploading...</Text>
                      </>
                    ) : photoLocalUri && photoError ? (
                      <>
                        <Image source={{ uri: photoLocalUri }} style={styles.summaryPhotoThumb} />
                        <Text style={[styles.summaryValue, { color: Colors.error }]} numberOfLines={1}>Failed — using default</Text>
                      </>
                    ) : (
                      <Text style={styles.summaryValue} numberOfLines={1}>Default image</Text>
                    )}
                  </View>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Goal</Text>
                  <View style={styles.summaryGoalWrap}>
                    <Text style={styles.summaryGoalText} numberOfLines={1}>${getGoal()}</Text>
                    {isAtMax && (
                      <View style={styles.summaryMaxBadge}>
                        <Text style={styles.summaryMaxBadgeText}>MAX</Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            </View>
          )}
        </Animated.View>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Bottom Navigation */}
      <View style={[
        styles.bottomBar,
        { paddingBottom: Platform.OS === 'web' ? WEB_BOTTOM_SAFE : Math.max(insets.bottom, 12) + Spacing.md },
      ]}>
        {step > 1 && (
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => handleStepChange(step - 1)}
            activeOpacity={0.7}
          >
            <MaterialIcons name="arrow-back" size={20} color={Colors.textSecondary} />
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[
            styles.nextButton,
            !canProceed() && styles.nextButtonDisabled,
            step === 1 && { flex: 1 },
            step === 3 && isUploadingPhoto && styles.nextButtonDisabled,
          ]}
          onPress={() => step < 3 ? handleStepChange(step + 1) : handleSubmit()}
          disabled={!canProceed() || (step === 3 && isUploadingPhoto)}
          activeOpacity={0.8}
        >
          {step === 3 && isUploadingPhoto ? (
            <>
              <ActivityIndicator size="small" color={Colors.white} />
              <Text style={styles.nextButtonText}>Uploading Photo...</Text>
            </>
          ) : (
            <>
              <Text style={styles.nextButtonText}>
                {step < 3 ? 'Continue' : 'Post Need'}
              </Text>
              <MaterialIcons name={step < 3 ? 'arrow-forward' : 'check'} size={20} color={Colors.white} />
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Image Editor Modal */}
      {showImageEditor && rawPickedUri && (
        <ImageEditor
          visible={showImageEditor}
          imageUri={rawPickedUri}
          onSave={handleImageEdited}
          onCancel={handleEditorCancel}
        />
      )}
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    ...(Platform.OS === 'web' ? { paddingTop: 16 } : {}),
  },
  headerTitle: {
    fontSize: FontSize.xxl,
    fontWeight: '900',
    color: Colors.text,
  },
  headerSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textLight,
    fontWeight: '600',
  },
  stepsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xxxl,
    marginBottom: Spacing.xxl,
    position: 'relative',
  },
  stepContainer: {
    alignItems: 'center',
    gap: 4,
    zIndex: 1,
  },
  stepDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.border,
  },
  stepDotActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  stepDotComplete: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  stepNumber: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.textLight,
  },
  stepNumberActive: {
    color: Colors.primary,
  },
  stepLabel: {
    fontSize: FontSize.xs,
    color: Colors.textLight,
  },
  stepLabelActive: {
    color: Colors.primary,
    fontWeight: '600',
  },
  stepLine: {
    position: 'absolute',
    left: 60,
    right: 60,
    top: 15,
    height: 2,
    backgroundColor: Colors.border,
    zIndex: 0,
  },
  stepLineFill: {
    height: '100%',
    backgroundColor: Colors.primary,
  },
  content: {
    flex: 1,
  },
  stepContent: {
    paddingHorizontal: Spacing.xl,
  },
  stepTitle: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  stepDescription: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.xxl,
    lineHeight: 20,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  categoryCard: {
    width: '47%',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 2,
    borderColor: 'transparent',
    ...Shadow.sm,
    position: 'relative',
    minHeight: 100,
  },
  categoryIconBg: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryName: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
  },
  checkBadge: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputLabel: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  textInput: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    fontSize: FontSize.md,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.sm,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: FontSize.xs,
    color: Colors.textLight,
    textAlign: 'right',
    marginTop: Spacing.xs,
    marginBottom: Spacing.xl,
  },
  photoSection: {
    marginBottom: Spacing.lg,
  },
  photoLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  tipCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    backgroundColor: Colors.accentLight,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.md,
  },
  tipText: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  goalDisplay: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    marginBottom: Spacing.xxl,
  },
  goalDollar: {
    fontSize: FontSize.xxl,
    fontWeight: '700',
    color: Colors.primary,
    marginTop: 8,
  },
  goalNumber: {
    fontSize: 64,
    fontWeight: '900',
    color: Colors.text,
    lineHeight: 72,
  },
  maxBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#EEF4FF',
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: '#D4E2FC',
    gap: Spacing.md,
  },
  maxBannerIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#D4E2FC',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  maxBannerContent: {
    flex: 1,
  },
  maxBannerTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: '#2D5BA9',
    marginBottom: 4,
  },
  maxBannerText: {
    fontSize: FontSize.sm,
    color: '#4A6FA5',
    lineHeight: 20,
  },
  goalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  goalButton: {
    width: '23%',
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    ...Shadow.sm,
    minHeight: 44,
  },
  goalButtonSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  goalButtonMax: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  goalButtonText: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  goalButtonTextSelected: {
    color: Colors.primary,
  },
  goalMaxLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.textLight,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  customGoalToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    marginBottom: Spacing.md,
    minHeight: 44,
  },
  customGoalToggleActive: {},
  customGoalToggleText: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  customGoalInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.lg,
    borderWidth: 2,
    borderColor: Colors.primary,
    marginBottom: Spacing.lg,
  },
  customDollar: {
    fontSize: FontSize.xxl,
    fontWeight: '700',
    color: Colors.primary,
  },
  customGoalField: {
    flex: 1,
    fontSize: FontSize.xxl,
    fontWeight: '700',
    color: Colors.text,
    paddingVertical: Spacing.md,
    marginLeft: Spacing.xs,
  },
  customGoalMaxHint: {
    backgroundColor: Colors.surfaceAlt,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  customGoalMaxHintText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.textLight,
  },
  feeInfo: {
    backgroundColor: Colors.surfaceAlt,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    gap: Spacing.xs,
    marginBottom: Spacing.xl,
  },
  feeInfoText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  summaryCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    gap: Spacing.md,
    ...Shadow.sm,
  },
  summaryTitle: {
    fontSize: FontSize.lg,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: FontSize.sm,
    color: Colors.textLight,
  },
  summaryValue: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
    maxWidth: '60%',
  },
  summaryGoalWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flexShrink: 0,
  },
  summaryGoalText: {
    fontSize: FontSize.md,
    fontWeight: '800',
    color: Colors.text,
  },
  summaryPhotoWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  summaryPhotoThumb: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: Colors.surfaceAlt,
  },
  summaryMaxBadge: {
    backgroundColor: '#EEF4FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#D4E2FC',
  },
  summaryMaxBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#5B8DEF',
    letterSpacing: 0.5,
  },
  bottomBar: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    backgroundColor: Colors.surface,
    gap: Spacing.md,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 -2px 16px rgba(0,0,0,0.08)' as any }
      : Shadow.lg),
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.surfaceAlt,
    minHeight: 48,
  },
  backButtonText: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  nextButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.primary,
    minHeight: 48,
    ...Shadow.md,
  },
  nextButtonDisabled: {
    opacity: 0.5,
  },
  nextButtonText: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.white,
  },
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xxxl,
    gap: Spacing.lg,
  },
  successIcon: {
    marginBottom: Spacing.md,
  },
  successTitle: {
    fontSize: FontSize.xxxl,
    fontWeight: '900',
    color: Colors.text,
  },
  successMessage: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  successButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xxxl,
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.xl,
    marginTop: Spacing.lg,
    width: '100%',
    minHeight: 52,
    ...Shadow.md,
  },
  successButtonText: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.white,
  },
  postAnotherButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: Spacing.xxxl,
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.xl,
    width: '100%',
    minHeight: 52,
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  postAnotherButtonText: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.primary,
  },
  // Photo upload styles
  photoUploadContainer: {
    backgroundColor: Colors.primaryLight,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: Colors.primary + '40',
    borderStyle: 'dashed' as any,
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: 'center' as const,
    gap: 8,
    minHeight: 100,
  },
  photoUploadIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary + '20',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 4,
  },
  photoUploadTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.primary,
    textAlign: 'center' as const,
  },
  photoUploadSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
    lineHeight: 18,
    maxWidth: 280,
  },
  compressionBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    backgroundColor: Colors.surfaceAlt,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 4,
  },
  compressionBadgeText: {
    fontSize: 10,
    fontWeight: '600' as const,
    color: Colors.textLight,
  },
  photoPreviewContainer: {
    borderRadius: 16,
    overflow: 'hidden' as const,
    backgroundColor: Colors.surfaceAlt,
    ...Shadow.sm,
  },
  photoPreviewImage: {
    width: '100%' as any,
    height: 200,
    borderRadius: 16,
  },
  photoOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 16,
    justifyContent: 'center' as const,
    paddingHorizontal: 20,
  },
  progressOverlayContent: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 12,
    padding: 16,
  },
  photoSuccessBadge: {
    position: 'absolute' as const,
    top: 10,
    right: 10,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    backgroundColor: Colors.success,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  photoSuccessText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#FFF',
  },
  photoErrorBadge: {
    position: 'absolute' as const,
    top: 10,
    left: 10,
    right: 10,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    backgroundColor: 'rgba(232,93,93,0.9)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  photoErrorText: {
    flex: 1,
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#FFF',
    lineHeight: 15,
  },
  photoActions: {
    flexDirection: 'row' as const,
    justifyContent: 'center' as const,
    flexWrap: 'wrap' as const,
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  photoActionBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.primaryLight,
    minHeight: 36,
  },
  photoRemoveBtn: {
    backgroundColor: '#FDE8E8',
  },
  photoActionText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
});
