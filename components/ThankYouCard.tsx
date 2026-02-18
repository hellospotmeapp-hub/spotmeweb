import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, BorderRadius, FontSize, Spacing, Shadow } from '@/app/lib/theme';

interface ThankYouUpdate {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  needId: string;
  needTitle: string;
  message: string;
  videoUrl?: string;
  photoUrl?: string;
  pinned: boolean;
  createdAt: string;
  likes: number;
}

interface Props {
  update: ThankYouUpdate;
  isOwner?: boolean;
  onTogglePin?: (id: string) => void;
  onLike?: (id: string) => void;
  onViewNeed?: (needId: string) => void;
}

function getTimeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffHours < 1) return 'just now';
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return `${Math.floor(diffDays / 7)}w ago`;
}

export default function ThankYouCard({ update, isOwner, onTogglePin, onLike, onViewNeed }: Props) {
  return (
    <View style={[styles.card, update.pinned && styles.pinnedCard]}>
      {/* Pinned badge */}
      {update.pinned && (
        <View style={styles.pinnedBadge}>
          <MaterialIcons name="push-pin" size={12} color={Colors.primary} />
          <Text style={styles.pinnedText}>Pinned to profile</Text>
        </View>
      )}

      {/* Header */}
      <View style={styles.header}>
        <Image source={{ uri: update.userAvatar }} style={styles.avatar} />
        <View style={styles.headerInfo}>
          <Text style={styles.userName}>{update.userName}</Text>
          <Text style={styles.timeAgo}>{getTimeAgo(update.createdAt)}</Text>
        </View>
        {isOwner && onTogglePin && (
          <TouchableOpacity
            style={styles.pinButton}
            onPress={() => onTogglePin(update.id)}
          >
            <MaterialIcons
              name={update.pinned ? 'push-pin' : 'outlined-flag'}
              size={18}
              color={update.pinned ? Colors.primary : Colors.textLight}
            />
          </TouchableOpacity>
        )}
      </View>

      {/* Need reference */}
      <TouchableOpacity
        style={styles.needRef}
        onPress={() => onViewNeed?.(update.needId)}
      >
        <MaterialIcons name="volunteer-activism" size={14} color={Colors.secondary} />
        <Text style={styles.needRefText} numberOfLines={1}>
          Re: {update.needTitle}
        </Text>
        <MaterialIcons name="chevron-right" size={16} color={Colors.textLight} />
      </TouchableOpacity>

      {/* Message */}
      <Text style={styles.message}>{update.message}</Text>

      {/* Photo */}
      {update.photoUrl && (
        <View style={styles.mediaContainer}>
          <Image source={{ uri: update.photoUrl }} style={styles.photo} />
        </View>
      )}

      {/* Video thumbnail */}
      {update.videoUrl && !update.photoUrl && (
        <View style={styles.mediaContainer}>
          <Image source={{ uri: update.videoUrl }} style={styles.photo} />
          <View style={styles.videoOverlay}>
            <View style={styles.playButton}>
              <MaterialIcons name="play-arrow" size={32} color={Colors.white} />
            </View>
          </View>
        </View>
      )}

      {/* Footer actions */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.likeButton}
          onPress={() => onLike?.(update.id)}
        >
          <MaterialIcons name="favorite-border" size={18} color={Colors.primary} />
          <Text style={styles.likeCount}>{update.likes}</Text>
        </TouchableOpacity>
        <View style={styles.thankYouBadge}>
          <MaterialIcons name="auto-awesome" size={14} color={Colors.accent} />
          <Text style={styles.thankYouBadgeText}>Thank You</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    ...Shadow.sm,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  pinnedCard: {
    borderColor: Colors.primaryLight,
    borderWidth: 1.5,
    backgroundColor: '#FFFCFB',
  },
  pinnedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: Spacing.sm,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  pinnedText: {
    fontSize: FontSize.xs,
    color: Colors.primary,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.borderLight,
  },
  headerInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  userName: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
  },
  timeAgo: {
    fontSize: FontSize.xs,
    color: Colors.textLight,
    marginTop: 2,
  },
  pinButton: {
    padding: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surfaceAlt,
  },
  needRef: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.secondaryLight,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.md,
  },
  needRefText: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.secondaryDark,
    fontWeight: '500',
  },
  message: {
    fontSize: FontSize.md,
    color: Colors.text,
    lineHeight: 22,
    marginBottom: Spacing.md,
  },
  mediaContainer: {
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    marginBottom: Spacing.md,
    position: 'relative',
  },
  photo: {
    width: '100%',
    height: 200,
    backgroundColor: Colors.borderLight,
  },
  videoOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  likeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primaryLight,
  },
  likeCount: {
    fontSize: FontSize.sm,
    color: Colors.primary,
    fontWeight: '600',
  },
  thankYouBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.accentLight,
  },
  thankYouBadgeText: {
    fontSize: FontSize.xs,
    color: '#B8941E',
    fontWeight: '600',
  },
});
