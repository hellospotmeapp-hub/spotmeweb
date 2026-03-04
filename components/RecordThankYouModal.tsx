import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, TextInput,
  Platform, ActivityIndicator, Animated, ScrollView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, BorderRadius, FontSize, Spacing, Shadow } from '@/app/lib/theme';
import { supabase, supabaseUrl, supabaseKey } from '@/app/lib/supabase';


interface RecordThankYouModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: (video: { id: string; videoUrl: string; message: string }) => void;
  needId: string;
  needTitle: string;
  userId: string;
  userName: string;
  userAvatar: string;
}

export default function RecordThankYouModal({
  visible,
  onClose,
  onSuccess,
  needId,
  needTitle,
  userId,
  userName,
  userAvatar,
}: RecordThankYouModalProps) {
  const [message, setMessage] = useState('');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [step, setStep] = useState<'choose' | 'record' | 'preview' | 'message'>('choose');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recordingTimerRef = useRef<any>(null);
  const chunksRef = useRef<Blob[]>([]);
  const liveVideoRef = useRef<HTMLVideoElement>(null);

  const [progressAnim] = useState(new Animated.Value(0));

  const resetState = () => {
    setMessage('');
    setVideoFile(null);
    setVideoPreviewUrl(null);
    setVideoDuration(0);
    setIsUploading(false);
    setUploadProgress(0);
    setError('');
    setIsRecording(false);
    setRecordingTime(0);
    setStep('choose');
    stopRecording();
    if (videoPreviewUrl) {
      URL.revokeObjectURL(videoPreviewUrl);
    }
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  // ===== FILE UPLOAD =====
  const handleFileSelect = () => {
    if (Platform.OS === 'web' && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate type
    if (!file.type.startsWith('video/')) {
      setError('Please select a video file');
      return;
    }

    // Validate size (50MB max)
    if (file.size > 50 * 1024 * 1024) {
      setError('Video must be under 50MB');
      return;
    }

    setError('');
    setVideoFile(file);
    const url = URL.createObjectURL(file);
    setVideoPreviewUrl(url);

    // Get duration
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      const dur = Math.round(video.duration);
      if (dur < 5) {
        setError('Video must be at least 5 seconds');
        setVideoFile(null);
        setVideoPreviewUrl(null);
        URL.revokeObjectURL(url);
        return;
      }
      if (dur > 120) {
        setError('Video must be under 2 minutes');
        setVideoFile(null);
        setVideoPreviewUrl(null);
        URL.revokeObjectURL(url);
        return;
      }
      setVideoDuration(dur);
      setStep('message');
    };
    video.src = url;
  };

  // ===== CAMERA RECORDING =====
  const startRecording = async () => {
    try {
      setError('');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 1280 } },
        audio: true,
      });
      streamRef.current = stream;

      // Show live preview
      if (liveVideoRef.current) {
        liveVideoRef.current.srcObject = stream;
        liveVideoRef.current.play().catch(() => {});
      }

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
          ? 'video/webm;codecs=vp9'
          : 'video/webm',
      });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        const file = new File([blob], `thankyou_${Date.now()}.webm`, { type: 'video/webm' });
        setVideoFile(file);
        const url = URL.createObjectURL(blob);
        setVideoPreviewUrl(url);
        setVideoDuration(recordingTime);
        setStep('message');
      };

      mediaRecorder.start(1000);
      setIsRecording(true);
      setRecordingTime(0);
      setStep('record');

      // Timer
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          const next = prev + 1;
          if (next >= 60) {
            stopRecording();
          }
          return next;
        });
      }, 1000);
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        setError('Camera access denied. Please allow camera access in your browser settings.');
      } else {
        setError('Could not access camera. Try uploading a video instead.');
      }
    }
  };

  const stopRecording = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsRecording(false);
  };

  // ===== UPLOAD =====
  const handleUpload = async () => {
    if (!videoFile) return;
    if (message.trim().length < 5) {
      setError('Please write a short thank you message (at least 5 characters)');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setError('');

    // Animate progress
    Animated.timing(progressAnim, {
      toValue: 0.9,
      duration: 8000,
      useNativeDriver: false,
    }).start();

    try {
      // Upload via local API handler (no edge function needed)
      // For video files, we use Supabase Storage directly, then save metadata
      const fileName = `thankyou_${needId}_${Date.now()}.webm`;
      
      // Try uploading to Supabase Storage
      let videoUrl = '';
      try {
        const { data: uploadData, error: uploadError } = await (supabase as any).storage
          .from('thankyou-videos')
          .upload(fileName, videoFile, {
            contentType: videoFile.type,
            upsert: true,
          });
        
        if (!uploadError && uploadData?.path) {
          const { data: urlData } = (supabase as any).storage
            .from('thankyou-videos')
            .getPublicUrl(uploadData.path);
          videoUrl = urlData?.publicUrl || '';
        }
      } catch (storageErr) {
        console.log('[SpotMe] Storage upload failed (non-critical):', storageErr);
      }

      // Save video metadata via local API
      const { data, error: apiError } = await supabase.functions.invoke('upload-thankyou-video', {
        body: {
          action: 'upload',
          needId,
          userId,
          userName,
          userAvatar,
          needTitle,
          message: message.trim(),
          videoUrl,
          durationSeconds: videoDuration,
        },
      });

      if (apiError) {
        throw new Error(apiError.message || 'Upload failed');
      }


      // Complete progress animation
      Animated.timing(progressAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: false,
      }).start();

      setUploadProgress(100);

      setTimeout(() => {
        onSuccess({
          id: data.video?.id || '',
          videoUrl: data.videoUrl || data.video?.video_url || '',
          message: message.trim(),
        });
        handleClose();
      }, 800);
    } catch (err: any) {
      setError(err.message || 'Upload failed. Please try again.');
      setIsUploading(false);
      progressAnim.setValue(0);
    }
  };

  const formatRecordingTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>
              {step === 'choose' ? 'Record Thank You' :
               step === 'record' ? 'Recording...' :
               step === 'message' ? 'Add Your Message' : 'Thank You Video'}
            </Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
              <MaterialIcons name="close" size={24} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
            {/* Need Info */}
            <View style={styles.needInfo}>
              <MaterialIcons name="auto-awesome" size={16} color={Colors.accent} />
              <Text style={styles.needInfoText} numberOfLines={1}>
                For: {needTitle}
              </Text>
            </View>

            {/* ===== STEP: CHOOSE ===== */}
            {step === 'choose' && (
              <View style={styles.chooseSection}>
                <View style={styles.illustration}>
                  <View style={styles.illustrationCircle}>
                    <MaterialIcons name="videocam" size={48} color={Colors.primary} />
                  </View>
                </View>

                <Text style={styles.chooseTitle}>Say thank you with a video</Text>
                <Text style={styles.chooseSubtitle}>
                  Record a short video (15-60 sec) to personally thank your supporters. It'll be shared on your need's page and your profile.
                </Text>

                {/* Record Button */}
                <TouchableOpacity
                  style={styles.recordBtn}
                  onPress={startRecording}
                  activeOpacity={0.8}
                >
                  <View style={styles.recordDot} />
                  <Text style={styles.recordBtnText}>Record Video</Text>
                </TouchableOpacity>

                {/* Upload Button */}
                <TouchableOpacity
                  style={styles.uploadBtn}
                  onPress={handleFileSelect}
                  activeOpacity={0.8}
                >
                  <MaterialIcons name="file-upload" size={22} color={Colors.primary} />
                  <Text style={styles.uploadBtnText}>Upload from device</Text>
                </TouchableOpacity>

                {/* Hidden file input (web only) */}
                {Platform.OS === 'web' && (
                  <input
                    ref={fileInputRef as any}
                    type="file"
                    accept="video/*"
                    capture="user"
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                  />
                )}

                <View style={styles.tipRow}>
                  <MaterialIcons name="lightbulb-outline" size={16} color={Colors.accent} />
                  <Text style={styles.tipText}>
                    Tip: Keep it authentic! A simple, heartfelt message works best.
                  </Text>
                </View>
              </View>
            )}

            {/* ===== STEP: RECORDING ===== */}
            {step === 'record' && Platform.OS === 'web' && (
              <View style={styles.recordingSection}>
                <View style={styles.livePreview}>
                  <video
                    ref={liveVideoRef as any}
                    autoPlay
                    muted
                    playsInline
                    style={{
                      width: '100%',
                      height: 320,
                      objectFit: 'cover',
                      borderRadius: 16,
                      transform: 'scaleX(-1)',
                      backgroundColor: '#000',
                    }}
                  />

                  {/* Recording indicator */}
                  <View style={styles.recordingIndicator}>
                    <View style={styles.recordingDot} />
                    <Text style={styles.recordingTimeText}>
                      {formatRecordingTime(recordingTime)}
                    </Text>
                  </View>

                  {/* Time limit bar */}
                  <View style={styles.timeLimitBar}>
                    <View
                      style={[
                        styles.timeLimitFill,
                        { width: `${Math.min((recordingTime / 60) * 100, 100)}%` },
                      ]}
                    />
                  </View>
                </View>

                <Text style={styles.recordingHint}>
                  {recordingTime < 15
                    ? `Keep going! ${15 - recordingTime}s until minimum`
                    : recordingTime >= 55
                    ? 'Almost at the limit!'
                    : 'Looking great! Tap stop when ready.'}
                </Text>

                <TouchableOpacity
                  style={styles.stopBtn}
                  onPress={stopRecording}
                  activeOpacity={0.8}
                  disabled={recordingTime < 5}
                >
                  <View style={styles.stopSquare} />
                  <Text style={styles.stopBtnText}>
                    {recordingTime < 5 ? `Wait ${5 - recordingTime}s...` : 'Stop Recording'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ===== STEP: MESSAGE ===== */}
            {step === 'message' && (
              <View style={styles.messageSection}>
                {/* Video Preview */}
                {videoPreviewUrl && Platform.OS === 'web' && (
                  <View style={styles.previewContainer}>
                    <video
                      ref={videoPreviewRef as any}
                      src={videoPreviewUrl}
                      playsInline
                      controls
                      style={{
                        width: '100%',
                        height: 200,
                        objectFit: 'cover',
                        borderRadius: 12,
                        backgroundColor: '#000',
                      }}
                    />
                    <View style={styles.durationBadge}>
                      <MaterialIcons name="videocam" size={12} color="#FFF" />
                      <Text style={styles.durationText}>
                        {formatRecordingTime(videoDuration)}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.retakeBtn}
                      onPress={() => {
                        setVideoFile(null);
                        setVideoPreviewUrl(null);
                        setStep('choose');
                      }}
                    >
                      <MaterialIcons name="refresh" size={14} color={Colors.primary} />
                      <Text style={styles.retakeBtnText}>Retake</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Message Input */}
                <Text style={styles.messageLabel}>Your thank you message</Text>
                <TextInput
                  style={styles.messageInput}
                  value={message}
                  onChangeText={setMessage}
                  placeholder="Thank you so much! Here's how your help made a difference..."
                  placeholderTextColor={Colors.textLight}
                  multiline
                  maxLength={300}
                  textAlignVertical="top"
                />
                <Text style={styles.charCount}>{message.length}/300</Text>

                {/* Upload Progress */}
                {isUploading && (
                  <View style={styles.uploadProgressSection}>
                    <View style={styles.uploadProgressBar}>
                      <Animated.View
                        style={[
                          styles.uploadProgressFill,
                          {
                            width: progressAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: ['0%', '100%'],
                            }),
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.uploadProgressText}>
                      Uploading your thank you video...
                    </Text>
                  </View>
                )}

                {/* Submit Button */}
                <TouchableOpacity
                  style={[
                    styles.submitBtn,
                    (isUploading || message.trim().length < 5) && styles.submitBtnDisabled,
                  ]}
                  onPress={handleUpload}
                  disabled={isUploading || message.trim().length < 5}
                  activeOpacity={0.8}
                >
                  {isUploading ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <>
                      <MaterialIcons name="publish" size={22} color="#FFF" />
                      <Text style={styles.submitBtnText}>Post Thank You Video</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {/* Error */}
            {error ? (
              <View style={styles.errorRow}>
                <MaterialIcons name="error-outline" size={16} color={Colors.error} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.xxl,
    borderTopRightRadius: BorderRadius.xxl,
    maxHeight: '92%',
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xxl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.md,
  },
  headerTitle: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    color: Colors.text,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Need Info
  needInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginHorizontal: Spacing.xxl,
    marginBottom: Spacing.lg,
    backgroundColor: Colors.accentLight,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  needInfoText: {
    flex: 1,
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: '#B8941E',
  },

  // Choose Step
  chooseSection: {
    paddingHorizontal: Spacing.xxl,
    gap: Spacing.lg,
    alignItems: 'center',
  },
  illustration: {
    marginVertical: Spacing.md,
  },
  illustrationCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chooseTitle: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    color: Colors.text,
    textAlign: 'center',
  },
  chooseSubtitle: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  recordBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.error,
    paddingVertical: 16,
    paddingHorizontal: Spacing.xxl,
    borderRadius: BorderRadius.xl,
    width: '100%',
    minHeight: 56,
    ...Shadow.md,
  },
  recordDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#FFF',
  },
  recordBtnText: {
    fontSize: FontSize.lg,
    fontWeight: '800',
    color: '#FFF',
  },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primaryLight,
    paddingVertical: 14,
    paddingHorizontal: Spacing.xxl,
    borderRadius: BorderRadius.xl,
    width: '100%',
    minHeight: 52,
    borderWidth: 1.5,
    borderColor: Colors.primary + '30',
  },
  uploadBtnText: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.primary,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    backgroundColor: Colors.accentLight,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    width: '100%',
  },
  tipText: {
    flex: 1,
    fontSize: FontSize.sm,
    color: '#B8941E',
    lineHeight: 20,
  },

  // Recording Step
  recordingSection: {
    paddingHorizontal: Spacing.xxl,
    gap: Spacing.lg,
    alignItems: 'center',
  },
  livePreview: {
    width: '100%',
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    position: 'relative',
  },
  recordingIndicator: {
    position: 'absolute',
    top: Spacing.md,
    left: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.error,
  },
  recordingTimeText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: '#FFF',
  },
  timeLimitBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  timeLimitFill: {
    height: '100%',
    backgroundColor: Colors.error,
  },
  recordingHint: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    fontWeight: '600',
  },
  stopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.text,
    paddingVertical: 16,
    paddingHorizontal: Spacing.xxl,
    borderRadius: BorderRadius.xl,
    width: '100%',
    minHeight: 56,
  },
  stopSquare: {
    width: 16,
    height: 16,
    borderRadius: 3,
    backgroundColor: Colors.error,
  },
  stopBtnText: {
    fontSize: FontSize.lg,
    fontWeight: '800',
    color: '#FFF',
  },

  // Message Step
  messageSection: {
    paddingHorizontal: Spacing.xxl,
    gap: Spacing.md,
  },
  previewContainer: {
    position: 'relative',
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    marginBottom: Spacing.sm,
  },
  durationBadge: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.sm,
  },
  durationText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: '#FFF',
  },
  retakeBtn: {
    position: 'absolute',
    bottom: Spacing.sm,
    left: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  retakeBtnText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.primary,
  },
  messageLabel: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.text,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  messageInput: {
    backgroundColor: Colors.surfaceAlt,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    fontSize: FontSize.md,
    color: Colors.text,
    minHeight: 100,
    borderWidth: 1,
    borderColor: Colors.border,
    lineHeight: 22,
  },
  charCount: {
    fontSize: FontSize.xs,
    color: Colors.textLight,
    textAlign: 'right',
    marginTop: -4,
  },

  // Upload Progress
  uploadProgressSection: {
    gap: Spacing.sm,
  },
  uploadProgressBar: {
    height: 6,
    backgroundColor: Colors.borderLight,
    borderRadius: 3,
    overflow: 'hidden',
  },
  uploadProgressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 3,
  },
  uploadProgressText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    fontWeight: '600',
  },

  // Submit
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: BorderRadius.xl,
    minHeight: 56,
    ...Shadow.md,
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitBtnText: {
    fontSize: FontSize.lg,
    fontWeight: '800',
    color: '#FFF',
  },

  // Error
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginHorizontal: Spacing.xxl,
    marginTop: Spacing.md,
    backgroundColor: '#FDE8E8',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  errorText: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.error,
    fontWeight: '600',
  },
});
