import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, ActivityIndicator, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, BorderRadius, FontSize, Spacing, Shadow } from '@/app/lib/theme';
import GracefulImage from '@/components/GracefulImage';

// Pre-made avatar options — mix of the original signup avatars + new ones
const AVATAR_OPTIONS = [
  // Original signup avatars
  'https://d64gsuwffb70l.cloudfront.net/698fe0b37fe9438e65b48d58_1771037056297_f9a83069.png',
  'https://d64gsuwffb70l.cloudfront.net/698fe0b37fe9438e65b48d58_1771037056573_451fb65f.png',
  'https://d64gsuwffb70l.cloudfront.net/698fe0b37fe9438e65b48d58_1771037041799_20c595bd.jpg',
  'https://d64gsuwffb70l.cloudfront.net/698fe0b37fe9438e65b48d58_1771037064960_2d7609c5.png',
  'https://d64gsuwffb70l.cloudfront.net/698fe0b37fe9438e65b48d58_1771037049254_f950ccb1.png',
  'https://d64gsuwffb70l.cloudfront.net/698fe0b37fe9438e65b48d58_1771037060145_0ca59f8e.png',
  'https://d64gsuwffb70l.cloudfront.net/698fe0b37fe9438e65b48d58_1771037062543_b10ff8a6.png',
  'https://d64gsuwffb70l.cloudfront.net/698fe0b37fe9438e65b48d58_1771037046421_52a3035d.jpg',
  // New avatar options
  'https://d64gsuwffb70l.cloudfront.net/698fe0b37fe9438e65b48d58_1772397896682_c38826be.png',
  'https://d64gsuwffb70l.cloudfront.net/698fe0b37fe9438e65b48d58_1772397896644_323208c3.jpg',
  'https://d64gsuwffb70l.cloudfront.net/698fe0b37fe9438e65b48d58_1772397896891_6688ce77.png',
  'https://d64gsuwffb70l.cloudfront.net/698fe0b37fe9438e65b48d58_1772397897317_01b8255b.png',
  'https://d64gsuwffb70l.cloudfront.net/698fe0b37fe9438e65b48d58_1772397899620_ce190502.png',
  'https://d64gsuwffb70l.cloudfront.net/698fe0b37fe9438e65b48d58_1772397898065_c4147d1b.png',
  'https://d64gsuwffb70l.cloudfront.net/698fe0b37fe9438e65b48d58_1772397900544_a2296cba.jpg',
  'https://d64gsuwffb70l.cloudfront.net/698fe0b37fe9438e65b48d58_1772397899907_e484fd4f.jpg',
];

export { AVATAR_OPTIONS };

interface AvatarPickerProps {
  visible: boolean;
  onClose: () => void;
  onSelectAvatar: (avatarUrl: string) => void;
  onUploadPhoto: () => void;
  currentAvatar?: string;
  uploading?: boolean;
}

export default function AvatarPicker({
  visible,
  onClose,
  onSelectAvatar,
  onUploadPhoto,
  currentAvatar,
  uploading,
}: AvatarPickerProps) {
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSelect = (url: string) => {
    setSelectedUrl(url);
  };

  const handleConfirm = () => {
    if (selectedUrl) {
      setSaving(true);
      onSelectAvatar(selectedUrl);
      // Reset after a brief delay to allow parent to process
      setTimeout(() => {
        setSaving(false);
        setSelectedUrl(null);
        onClose();
      }, 500);
    }
  };

  const handleClose = () => {
    setSelectedUrl(null);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Choose Your Avatar</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
              <MaterialIcons name="close" size={24} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <Text style={styles.subtitle}>
            Pick a pre-made avatar or upload your own photo
          </Text>

          {/* Upload Photo Button */}
          <TouchableOpacity
            style={styles.uploadBtn}
            onPress={() => {
              handleClose();
              setTimeout(onUploadPhoto, 300);
            }}
            activeOpacity={0.7}
            disabled={uploading}
          >
            {uploading ? (
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : (
              <MaterialIcons name="photo-camera" size={20} color={Colors.primary} />
            )}
            <Text style={styles.uploadBtnText}>
              {uploading ? 'Uploading...' : 'Upload Your Own Photo'}
            </Text>
            <MaterialIcons name="chevron-right" size={20} color={Colors.textLight} />
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or choose an avatar</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Avatar Grid */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.gridContainer}
          >
            <View style={styles.grid}>
              {AVATAR_OPTIONS.map((url, index) => {
                const isSelected = selectedUrl === url;
                const isCurrent = currentAvatar === url && !selectedUrl;
                return (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.avatarOption,
                      isSelected && styles.avatarOptionSelected,
                      isCurrent && styles.avatarOptionCurrent,
                    ]}
                    onPress={() => handleSelect(url)}
                    activeOpacity={0.7}
                  >
                    <GracefulImage uri={url} type="avatar" style={styles.avatarImage} />
                    {isSelected && (
                      <View style={styles.selectedBadge}>
                        <MaterialIcons name="check-circle" size={22} color={Colors.primary} />
                      </View>
                    )}
                    {isCurrent && !isSelected && (
                      <View style={styles.currentBadge}>
                        <Text style={styles.currentBadgeText}>Current</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          {/* Confirm Button */}
          <TouchableOpacity
            style={[
              styles.confirmBtn,
              !selectedUrl && styles.confirmBtnDisabled,
            ]}
            onPress={handleConfirm}
            disabled={!selectedUrl || saving}
            activeOpacity={0.8}
          >
            {saving ? (
              <ActivityIndicator size="small" color={Colors.white} />
            ) : (
              <>
                <MaterialIcons name="check" size={20} color={Colors.white} />
                <Text style={styles.confirmBtnText}>
                  {selectedUrl ? 'Use This Avatar' : 'Select an Avatar'}
                </Text>
              </>
            )}
          </TouchableOpacity>
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
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.xxl,
    borderTopRightRadius: BorderRadius.xxl,
    padding: Spacing.xl,
    paddingBottom: Platform.OS === 'web' ? Spacing.xl : 40,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  title: {
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
  subtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.lg,
    lineHeight: 20,
  },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primaryLight,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.primary + '25',
    marginBottom: Spacing.md,
  },
  uploadBtnText: {
    flex: 1,
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.primary,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.borderLight,
  },
  dividerText: {
    fontSize: FontSize.xs,
    color: Colors.textLight,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  gridContainer: {
    paddingBottom: Spacing.md,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    justifyContent: 'center',
  },
  avatarOption: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 3,
    borderColor: Colors.borderLight,
    overflow: 'hidden',
    position: 'relative',
  },
  avatarOptionSelected: {
    borderColor: Colors.primary,
    borderWidth: 3,
    ...Shadow.md,
  },
  avatarOptionCurrent: {
    borderColor: Colors.accent,
    borderWidth: 2,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 36,
  },
  selectedBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 1,
  },
  currentBadge: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingVertical: 2,
    alignItems: 'center',
  },
  currentBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.white,
    textTransform: 'uppercase',
  },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.xl,
    marginTop: Spacing.sm,
    ...Shadow.md,
  },
  confirmBtnDisabled: {
    opacity: 0.4,
  },
  confirmBtnText: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.white,
  },
});
