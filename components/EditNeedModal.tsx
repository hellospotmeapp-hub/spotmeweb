import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, ScrollView, Image, ActivityIndicator, Platform, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, BorderRadius, FontSize, Spacing, Shadow } from '@/app/lib/theme';
import { Need } from '@/app/lib/data';
import { pickNeedPhoto, uploadNeedPhoto } from '@/app/lib/imageUpload';

interface EditNeedModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (updates: { title?: string; message?: string; photo?: string; goalAmount?: number }) => Promise<boolean>;
  onDelete?: () => Promise<{ success: boolean; error?: string }>;
  need: Need;
}

// Store failed upload data for retry
interface FailedUpload {
  base64: string;
  mimeType: string;
  localUri: string;
  retryCount: number;
  lastError: string;
}

export default function EditNeedModal({ visible, onClose, onSave, onDelete, need }: EditNeedModalProps) {
  const [title, setTitle] = useState(need.title);
  const [message, setMessage] = useState(need.message);
  const [photo, setPhoto] = useState(need.photo || '');
  const [goalAmount, setGoalAmount] = useState(String(need.goalAmount));
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Photo retry state
  const [failedUpload, setFailedUpload] = useState<FailedUpload | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [retrySuccess, setRetrySuccess] = useState(false);
  const maxRetries = 3;

  const hasContributions = need.contributorCount > 0;
  const canEditGoal = !hasContributions;
  const canDelete = !hasContributions || need.raisedAmount === 0;

  useEffect(() => {
    if (visible) {
      setTitle(need.title);
      setMessage(need.message);
      setPhoto(need.photo || '');
      setGoalAmount(String(need.goalAmount));
      setError(null);
      setSuccess(false);
      setDeleteError(null);
      setShowDeleteConfirm(false);
      setIsDeleting(false);
      setFailedUpload(null);
      setIsRetrying(false);
      setRetrySuccess(false);
    }
  }, [visible, need]);

  const handlePickPhoto = async () => {
    try {
      const picked = await pickNeedPhoto();
      if (!picked) return;

      // Clear any previous failed upload
      setFailedUpload(null);
      setRetrySuccess(false);
      setError(null);
      setIsUploadingPhoto(true);

      const result = await uploadNeedPhoto(need.userId, picked.base64, picked.mimeType, title);
      if (result.success && result.photoUrl) {
        setPhoto(result.photoUrl);
        setRetrySuccess(false);
      } else {
        // Store the failed upload data for retry
        setFailedUpload({
          base64: picked.base64,
          mimeType: picked.mimeType,
          localUri: picked.uri,
          retryCount: 0,
          lastError: result.error || 'Upload failed',
        });
        // Show local preview even though upload failed
        setPhoto(picked.uri);
        setError(null); // Don't show generic error, the retry banner handles it
      }
      setIsUploadingPhoto(false);
    } catch {
      setIsUploadingPhoto(false);
      setError('Failed to pick photo');
    }
  };

  const handleRetryUpload = async () => {
    if (!failedUpload || isRetrying) return;
    if (failedUpload.retryCount >= maxRetries) {
      setError(`Upload failed after ${maxRetries} attempts. Please try picking a different photo.`);
      return;
    }

    setIsRetrying(true);
    setError(null);

    try {
      const result = await uploadNeedPhoto(
        need.userId,
        failedUpload.base64,
        failedUpload.mimeType,
        title
      );

      if (result.success && result.photoUrl) {
        setPhoto(result.photoUrl);
        setFailedUpload(null);
        setRetrySuccess(true);
        setTimeout(() => setRetrySuccess(false), 3000);
      } else {
        setFailedUpload(prev => prev ? {
          ...prev,
          retryCount: prev.retryCount + 1,
          lastError: result.error || 'Upload failed',
        } : null);
      }
    } catch (err: any) {
      setFailedUpload(prev => prev ? {
        ...prev,
        retryCount: prev.retryCount + 1,
        lastError: err.message || 'Upload failed',
      } : null);
    }

    setIsRetrying(false);
  };

  const handleDismissFailedUpload = () => {
    setFailedUpload(null);
    // Revert to original photo
    setPhoto(need.photo || '');
  };

  const handleSave = async () => {
    setError(null);
    if (title.trim().length < 3) {
      setError('Title must be at least 3 characters');
      return;
    }
    if (message.trim().length < 10) {
      setError('Message must be at least 10 characters');
      return;
    }

    // Warn if saving with a failed upload (local URI)
    if (failedUpload) {
      setError('Photo upload is pending. Retry the upload or remove the photo before saving.');
      return;
    }

    const updates: any = {};
    if (title.trim() !== need.title) updates.title = title.trim();
    if (message.trim() !== need.message) updates.message = message.trim();
    if (photo !== (need.photo || '')) updates.photo = photo;
    if (canEditGoal) {
      const newGoal = parseInt(goalAmount) || need.goalAmount;
      if (newGoal !== need.goalAmount && newGoal >= 25 && newGoal <= 300) {
        updates.goalAmount = newGoal;
      }
    }

    if (Object.keys(updates).length === 0) {
      onClose();
      return;
    }

    setIsSaving(true);
    try {
      const ok = await onSave(updates);
      if (ok) {
        setSuccess(true);
        setTimeout(() => onClose(), 800);
      } else {
        setError('Failed to save changes. Try again.');
      }
    } catch {
      setError('Something went wrong');
    }
    setIsSaving(false);
  };

  const handleDeletePress = () => {
    if (!canDelete) {
      setDeleteError('Cannot delete a need that has received contributions. Contact support for help.');
      return;
    }
    setDeleteError(null);
    
    if (Platform.OS === 'web') {
      setShowDeleteConfirm(true);
    } else {
      Alert.alert(
        'Delete Need',
        `Are you sure you want to delete "${need.title}"? This action cannot be undone.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: confirmDelete },
        ]
      );
    }
  };

  const confirmDelete = async () => {
    if (!onDelete) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const result = await onDelete();
      if (result.success) {
        setShowDeleteConfirm(false);
        onClose();
      } else {
        setDeleteError(result.error || 'Failed to delete need. Try again.');
        setShowDeleteConfirm(false);
      }
    } catch (err: any) {
      setDeleteError(err.message || 'Something went wrong');
      setShowDeleteConfirm(false);
    }
    setIsDeleting(false);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Edit Need</Text>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <MaterialIcons name="close" size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Title */}
            <Text style={styles.label}>Title</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              maxLength={60}
              placeholder="Need title"
              placeholderTextColor={Colors.textLight}
            />
            <Text style={styles.charCount}>{title.length}/60</Text>

            {/* Message */}
            <Text style={styles.label}>Message</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={message}
              onChangeText={setMessage}
              maxLength={200}
              multiline
              textAlignVertical="top"
              placeholder="Describe your need"
              placeholderTextColor={Colors.textLight}
            />
            <Text style={styles.charCount}>{message.length}/200</Text>

            {/* Photo */}
            <Text style={styles.label}>Photo</Text>
            <View style={styles.photoRow}>
              {photo ? (
                <View style={styles.photoPreviewWrap}>
                  <Image source={{ uri: photo }} style={styles.photoPreview} />
                  {failedUpload && (
                    <View style={styles.photoWarningBadge}>
                      <MaterialIcons name="cloud-off" size={14} color={Colors.white} />
                    </View>
                  )}
                  {retrySuccess && (
                    <View style={styles.photoSuccessBadge}>
                      <MaterialIcons name="check-circle" size={14} color={Colors.white} />
                    </View>
                  )}
                </View>
              ) : (
                <View style={[styles.photoPreview, styles.photoPlaceholder]}>
                  <MaterialIcons name="image" size={24} color={Colors.textLight} />
                </View>
              )}
              <View style={styles.photoActions}>
                <TouchableOpacity
                  style={styles.photoBtn}
                  onPress={handlePickPhoto}
                  disabled={isUploadingPhoto || isRetrying}
                >
                  {isUploadingPhoto ? (
                    <ActivityIndicator size="small" color={Colors.primary} />
                  ) : (
                    <>
                      <MaterialIcons name="add-a-photo" size={16} color={Colors.primary} />
                      <Text style={styles.photoBtnText}>
                        {photo ? 'Replace' : 'Add Photo'}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
                {photo && !failedUpload && (
                  <TouchableOpacity
                    style={[styles.photoBtn, styles.photoRemoveBtn]}
                    onPress={() => { setPhoto(''); setFailedUpload(null); }}
                  >
                    <MaterialIcons name="delete-outline" size={16} color={Colors.error} />
                    <Text style={[styles.photoBtnText, { color: Colors.error }]}>Remove</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Photo Upload Retry Banner */}
            {failedUpload && (
              <View style={styles.retryBanner}>
                <View style={styles.retryBannerHeader}>
                  <View style={styles.retryBannerIconWrap}>
                    <MaterialIcons name="cloud-off" size={18} color={Colors.error} />
                  </View>
                  <View style={styles.retryBannerContent}>
                    <Text style={styles.retryBannerTitle}>Photo Upload Failed</Text>
                    <Text style={styles.retryBannerSubtitle}>
                      {failedUpload.lastError}
                    </Text>
                    {failedUpload.retryCount > 0 && (
                      <Text style={styles.retryBannerAttempts}>
                        Attempt {failedUpload.retryCount} of {maxRetries}
                      </Text>
                    )}
                  </View>
                </View>

                {/* Retry Progress Bar */}
                {failedUpload.retryCount > 0 && (
                  <View style={styles.retryProgressTrack}>
                    <View
                      style={[
                        styles.retryProgressFill,
                        {
                          width: `${(failedUpload.retryCount / maxRetries) * 100}%`,
                          backgroundColor: failedUpload.retryCount >= maxRetries ? Colors.error : Colors.accent,
                        },
                      ]}
                    />
                  </View>
                )}

                <View style={styles.retryBannerActions}>
                  <TouchableOpacity
                    style={[
                      styles.retryButton,
                      (isRetrying || failedUpload.retryCount >= maxRetries) && styles.retryButtonDisabled,
                    ]}
                    onPress={handleRetryUpload}
                    disabled={isRetrying || failedUpload.retryCount >= maxRetries}
                    activeOpacity={0.7}
                  >
                    {isRetrying ? (
                      <ActivityIndicator size="small" color={Colors.white} />
                    ) : (
                      <>
                        <MaterialIcons
                          name={failedUpload.retryCount >= maxRetries ? 'error' : 'refresh'}
                          size={16}
                          color={Colors.white}
                        />
                        <Text style={styles.retryButtonText}>
                          {failedUpload.retryCount >= maxRetries
                            ? 'Max Retries'
                            : `Retry Upload${failedUpload.retryCount > 0 ? ` (${failedUpload.retryCount}/${maxRetries})` : ''}`}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.dismissButton}
                    onPress={handleDismissFailedUpload}
                    activeOpacity={0.7}
                  >
                    <MaterialIcons name="close" size={16} color={Colors.textSecondary} />
                    <Text style={styles.dismissButtonText}>Discard</Text>
                  </TouchableOpacity>
                </View>

                {failedUpload.retryCount >= maxRetries && (
                  <View style={styles.retryExhaustedBanner}>
                    <MaterialIcons name="info-outline" size={14} color={Colors.accent} />
                    <Text style={styles.retryExhaustedText}>
                      Try picking a smaller photo or check your internet connection.
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* Retry Success */}
            {retrySuccess && (
              <View style={styles.retrySuccessBanner}>
                <MaterialIcons name="check-circle" size={16} color={Colors.success} />
                <Text style={styles.retrySuccessText}>Photo uploaded successfully!</Text>
              </View>
            )}

            {/* Goal Amount */}
            <Text style={styles.label}>
              Goal Amount
              {!canEditGoal && (
                <Text style={styles.lockedLabel}> (locked - has contributions)</Text>
              )}
            </Text>
            {canEditGoal ? (
              <View style={styles.goalRow}>
                <Text style={styles.goalDollar}>$</Text>
                <TextInput
                  style={styles.goalInput}
                  value={goalAmount}
                  onChangeText={(t) => {
                    const num = t.replace(/[^0-9]/g, '');
                    const parsed = parseInt(num) || 0;
                    setGoalAmount(parsed > 300 ? '300' : num);
                  }}
                  keyboardType="numeric"
                  maxLength={3}
                />
                <Text style={styles.goalRange}>$25 - $300</Text>
              </View>
            ) : (
              <View style={styles.lockedGoal}>
                <MaterialIcons name="lock" size={16} color={Colors.textLight} />
                <Text style={styles.lockedGoalText}>${need.goalAmount}</Text>
                <Text style={styles.lockedGoalHint}>
                  Goal can't be changed after receiving contributions
                </Text>
              </View>
            )}

            {/* Info banner */}
            {hasContributions && (
              <View style={styles.infoBanner}>
                <MaterialIcons name="info-outline" size={16} color="#5B8DEF" />
                <Text style={styles.infoBannerText}>
                  You can edit the title, message, and photo. The goal amount and category are locked once contributions have been made.
                </Text>
              </View>
            )}

            {/* Error */}
            {error && (
              <View style={styles.errorBanner}>
                <MaterialIcons name="error-outline" size={16} color={Colors.error} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {/* Success */}
            {success && (
              <View style={styles.successBanner}>
                <MaterialIcons name="check-circle" size={16} color={Colors.success} />
                <Text style={styles.successText}>Changes saved!</Text>
              </View>
            )}

            {/* Delete Section */}
            {onDelete && (
              <View style={styles.deleteSection}>
                <View style={styles.deleteDivider} />
                <Text style={styles.deleteSectionTitle}>Danger Zone</Text>
                
                {!canDelete && (
                  <View style={styles.deleteWarningBanner}>
                    <MaterialIcons name="info-outline" size={16} color={Colors.accent} />
                    <Text style={styles.deleteWarningText}>
                      This need has received ${need.raisedAmount} in contributions from {need.contributorCount} {need.contributorCount === 1 ? 'person' : 'people'}. It cannot be deleted. Contact support if you need help.
                    </Text>
                  </View>
                )}

                {deleteError && (
                  <View style={styles.errorBanner}>
                    <MaterialIcons name="error-outline" size={16} color={Colors.error} />
                    <Text style={styles.errorText}>{deleteError}</Text>
                  </View>
                )}

                {/* Delete Confirmation Dialog (Web) */}
                {showDeleteConfirm ? (
                  <View style={styles.deleteConfirmCard}>
                    <View style={styles.deleteConfirmIconRow}>
                      <View style={styles.deleteConfirmIconWrap}>
                        <MaterialIcons name="warning" size={24} color={Colors.error} />
                      </View>
                    </View>
                    <Text style={styles.deleteConfirmTitle}>Delete this need?</Text>
                    <Text style={styles.deleteConfirmText}>
                      "{need.title}" will be permanently removed. This action cannot be undone.
                    </Text>
                    <View style={styles.deleteConfirmActions}>
                      <TouchableOpacity
                        style={styles.deleteConfirmCancelBtn}
                        onPress={() => setShowDeleteConfirm(false)}
                        disabled={isDeleting}
                      >
                        <Text style={styles.deleteConfirmCancelText}>Keep It</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.deleteConfirmDeleteBtn, isDeleting && { opacity: 0.6 }]}
                        onPress={confirmDelete}
                        disabled={isDeleting}
                        activeOpacity={0.7}
                      >
                        {isDeleting ? (
                          <ActivityIndicator size="small" color={Colors.white} />
                        ) : (
                          <>
                            <MaterialIcons name="delete-forever" size={18} color={Colors.white} />
                            <Text style={styles.deleteConfirmDeleteText}>Delete Forever</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[styles.deleteBtn, !canDelete && styles.deleteBtnDisabled]}
                    onPress={handleDeletePress}
                    disabled={!canDelete || isDeleting}
                    activeOpacity={0.7}
                  >
                    <MaterialIcons name="delete-outline" size={20} color={canDelete ? Colors.error : Colors.textLight} />
                    <Text style={[styles.deleteBtnText, !canDelete && styles.deleteBtnTextDisabled]}>
                      Delete This Need
                    </Text>
                  </TouchableOpacity>
                )}

                {canDelete && !showDeleteConfirm && (
                  <Text style={styles.deleteHint}>
                    This will permanently remove the need. This cannot be undone.
                  </Text>
                )}
              </View>
            )}

            <View style={{ height: 20 }} />
          </ScrollView>

          {/* Bottom buttons */}
          <View style={styles.bottomBar}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, (isSaving || !!failedUpload) && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={isSaving || !!failedUpload}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color={Colors.white} />
              ) : (
                <>
                  <MaterialIcons name="check" size={18} color={Colors.white} />
                  <Text style={styles.saveBtnText}>Save Changes</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
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
  container: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: BorderRadius.xxl,
    borderTopRightRadius: BorderRadius.xxl,
    maxHeight: '90%',
    ...(Platform.OS === 'web' ? {
      maxWidth: 500,
      alignSelf: 'center' as any,
      width: '100%',
      borderRadius: BorderRadius.xxl,
      marginBottom: 40,
      maxHeight: '80%',
    } : {}),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
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
  content: {
    padding: Spacing.xl,
  },
  label: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  lockedLabel: {
    fontSize: FontSize.xs,
    fontWeight: '500',
    color: Colors.textLight,
    textTransform: 'none',
    letterSpacing: 0,
  },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    fontSize: FontSize.md,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: FontSize.xs,
    color: Colors.textLight,
    textAlign: 'right',
    marginTop: 4,
    marginBottom: Spacing.lg,
  },
  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  photoPreviewWrap: {
    position: 'relative',
  },
  photoPreview: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.surfaceAlt,
  },
  photoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
  },
  photoWarningBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.error,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.background,
  },
  photoSuccessBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.background,
  },
  photoActions: {
    flex: 1,
    gap: Spacing.sm,
  },
  photoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.primaryLight,
    borderRadius: BorderRadius.lg,
  },
  photoRemoveBtn: {
    backgroundColor: '#FFF0F0',
  },
  photoBtnText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.primary,
  },

  // Photo Retry Banner
  retryBanner: {
    backgroundColor: '#FFF5F5',
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.error + '25',
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    gap: Spacing.md,
  },
  retryBannerHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  retryBannerIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.error + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryBannerContent: {
    flex: 1,
  },
  retryBannerTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.error,
  },
  retryBannerSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
    lineHeight: 18,
  },
  retryBannerAttempts: {
    fontSize: FontSize.xs,
    color: Colors.textLight,
    marginTop: 4,
    fontWeight: '600',
  },
  retryProgressTrack: {
    height: 4,
    backgroundColor: Colors.borderLight,
    borderRadius: 2,
    overflow: 'hidden',
  },
  retryProgressFill: {
    height: '100%',
    borderRadius: 2,
  },
  retryBannerActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  retryButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.primary,
    ...Shadow.sm,
  },
  retryButtonDisabled: {
    opacity: 0.5,
  },
  retryButtonText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.white,
  },
  dismissButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.surfaceAlt,
  },
  dismissButtonText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  retryExhaustedBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.xs,
    backgroundColor: Colors.accentLight,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  retryExhaustedText: {
    flex: 1,
    fontSize: FontSize.xs,
    color: '#8B7A2E',
    lineHeight: 16,
  },
  retrySuccessBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: '#E8F5E8',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
  },
  retrySuccessText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.success,
  },

  goalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  goalDollar: {
    fontSize: FontSize.xxl,
    fontWeight: '700',
    color: Colors.primary,
  },
  goalInput: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.text,
    borderWidth: 2,
    borderColor: Colors.primary,
    width: 80,
    textAlign: 'center',
  },
  goalRange: {
    fontSize: FontSize.sm,
    color: Colors.textLight,
  },
  lockedGoal: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surfaceAlt,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
    flexWrap: 'wrap',
  },
  lockedGoalText: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.text,
  },
  lockedGoalHint: {
    fontSize: FontSize.xs,
    color: Colors.textLight,
    width: '100%',
    marginTop: 4,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    backgroundColor: '#EEF4FF',
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  infoBannerText: {
    flex: 1,
    fontSize: FontSize.sm,
    color: '#4A6FA5',
    lineHeight: 19,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: '#FFF0F0',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  errorText: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.error,
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: '#E8F5E8',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  successText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.success,
  },

  // Delete Section
  deleteSection: {
    marginTop: Spacing.lg,
    gap: Spacing.md,
  },
  deleteDivider: {
    height: 1,
    backgroundColor: Colors.error + '20',
    marginBottom: Spacing.sm,
  },
  deleteSectionTitle: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.error,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  deleteWarningBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    backgroundColor: Colors.accentLight,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
  deleteWarningText: {
    flex: 1,
    fontSize: FontSize.sm,
    color: '#8B7A2E',
    lineHeight: 19,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.xl,
    backgroundColor: '#FFF0F0',
    borderWidth: 1.5,
    borderColor: Colors.error + '30',
  },
  deleteBtnDisabled: {
    opacity: 0.5,
    borderColor: Colors.borderLight,
    backgroundColor: Colors.surfaceAlt,
  },
  deleteBtnText: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.error,
  },
  deleteBtnTextDisabled: {
    color: Colors.textLight,
  },
  deleteHint: {
    fontSize: FontSize.xs,
    color: Colors.textLight,
    textAlign: 'center',
    lineHeight: 16,
  },

  // Delete Confirmation Card
  deleteConfirmCard: {
    backgroundColor: '#FFF5F5',
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    borderWidth: 1.5,
    borderColor: Colors.error + '30',
    gap: Spacing.md,
    alignItems: 'center',
  },
  deleteConfirmIconRow: {
    alignItems: 'center',
  },
  deleteConfirmIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.error + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteConfirmTitle: {
    fontSize: FontSize.lg,
    fontWeight: '800',
    color: Colors.error,
    textAlign: 'center',
  },
  deleteConfirmText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  deleteConfirmActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    width: '100%',
    marginTop: Spacing.sm,
  },
  deleteConfirmCancelBtn: {
    flex: 1,
    paddingVertical: Spacing.md + 2,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteConfirmCancelText: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  deleteConfirmDeleteBtn: {
    flex: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md + 2,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.error,
    ...Shadow.sm,
  },
  deleteConfirmDeleteText: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.white,
  },

  bottomBar: {
    flexDirection: 'row',
    gap: Spacing.md,
    padding: Spacing.xl,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.surfaceAlt,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  saveBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.primary,
    ...Shadow.md,
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.white,
  },
});
