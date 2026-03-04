import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, BorderRadius, FontSize, Spacing, Shadow } from '@/app/lib/theme';
import { supabase } from '@/app/lib/supabase';

// ─── Types ───────────────────────────────────────────────────────────

interface Comment {
  id: string;
  needId: string;
  userId: string;
  userName: string;
  userAvatar: string;
  message: string;
  parentCommentId: string | null;
  parentUserName?: string | null;
  createdAt: string;
  replyCount?: number;
  replies?: Comment[];
  isOptimistic?: boolean;
}

interface CommentsSectionProps {
  needId: string;
  currentUserId: string;
  currentUserName: string;
  currentUserAvatar: string;
  isLoggedIn: boolean;
  onSignInPress?: () => void;
}

// ─── Constants ───────────────────────────────────────────────────────

const PAGE_SIZE = 10;
const REPLY_INDENT = 40;
const THREAD_LINE_COLOR = Colors.border;

// ─── Helpers ─────────────────────────────────────────────────────────

function getTimeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffSec < 30) return 'just now';
  if (diffMin < 1) return `${diffSec}s ago`;
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  const weeks = Math.floor(diffDays / 7);
  if (weeks < 5) return `${weeks}w ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function avatarUri(avatar: string, name: string): string {
  return avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'A')}&background=F2785C&color=fff&size=64`;
}

// ─── Main Component ──────────────────────────────────────────────────

export default function CommentsSection({
  needId,
  currentUserId,
  currentUserName,
  currentUserAvatar,
  isLoggedIn,
  onSignInPress,
}: CommentsSectionProps) {
  // ── State ──
  const [comments, setComments] = useState<Comment[]>([]);
  const [totalTopLevel, setTotalTopLevel] = useState(0);
  const [totalAll, setTotalAll] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  // Reply state
  const [replyingTo, setReplyingTo] = useState<{ id: string; userName: string } | null>(null);

  // Collapsed threads
  const [collapsedThreads, setCollapsedThreads] = useState<Set<string>>(new Set());

  const offsetRef = useRef(0);
  const inputRef = useRef<TextInput>(null);

  // ── Fetch Comments ──
  const fetchComments = useCallback(async (reset = false) => {
    if (!needId) return;
    const isLocalId = /^(n\d+|mr\d+|n_|local_)/.test(needId);

    try {
      if (reset) {
        setIsLoading(true);
        offsetRef.current = 0;
      }

      if (isLocalId) {
        setComments([]);
        setTotalTopLevel(0);
        setTotalAll(0);
        setHasMore(false);
        setIsLoading(false);
        return;
      }

      const { data, error: fetchErr } = await supabase.functions.invoke('process-contribution', {
        body: {
          action: 'fetch_comments',
          needId,
          limit: PAGE_SIZE,
          offset: reset ? 0 : offsetRef.current,
        },
      });

      if (fetchErr) {
        console.error('[Comments] Fetch error:', fetchErr);
        setError('Failed to load comments');
        setIsLoading(false);
        return;
      }

      if (data?.success) {
        const fetched: Comment[] = data.comments || [];
        if (reset) {
          setComments(fetched);
        } else {
          setComments(prev => {
            const existingIds = new Set(prev.map(c => c.id));
            const newComments = fetched.filter(c => !existingIds.has(c.id));
            return [...prev, ...newComments];
          });
        }
        setTotalTopLevel(data.total || 0);
        setTotalAll(data.totalAll || 0);
        setHasMore(data.hasMore || false);
        offsetRef.current = reset ? fetched.length : offsetRef.current + fetched.length;
      }
    } catch (err) {
      console.error('[Comments] Fetch exception:', err);
      if (reset) setError('Failed to load comments');
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [needId]);

  useEffect(() => {
    fetchComments(true);
  }, [needId]);

  // ── Load More ──
  const handleLoadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    await fetchComments(false);
  }, [fetchComments, isLoadingMore, hasMore]);

  // ── Reply ──
  const handleStartReply = useCallback((commentId: string, userName: string) => {
    if (!isLoggedIn) {
      onSignInPress?.();
      return;
    }
    setReplyingTo({ id: commentId, userName });
    setMessageText('');
    setSendError(null);
    // Expand the thread if collapsed
    setCollapsedThreads(prev => {
      const next = new Set(prev);
      next.delete(commentId);
      return next;
    });
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [isLoggedIn, onSignInPress]);

  const handleCancelReply = useCallback(() => {
    setReplyingTo(null);
    setMessageText('');
    setSendError(null);
  }, []);

  // ── Toggle Thread ──
  const toggleThread = useCallback((commentId: string) => {
    setCollapsedThreads(prev => {
      const next = new Set(prev);
      if (next.has(commentId)) {
        next.delete(commentId);
      } else {
        next.add(commentId);
      }
      return next;
    });
  }, []);

  // ── Post Comment / Reply ──
  const handlePostComment = useCallback(async () => {
    const trimmed = messageText.trim();
    if (!trimmed || isSending) return;
    if (!isLoggedIn) {
      onSignInPress?.();
      return;
    }

    setSendError(null);
    setIsSending(true);

    const parentCommentId = replyingTo?.id || null;
    const parentUserName = replyingTo?.userName || null;

    // Optimistic update
    const optimisticId = `opt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const optimisticComment: Comment = {
      id: optimisticId,
      needId,
      userId: currentUserId,
      userName: currentUserName,
      userAvatar: currentUserAvatar,
      message: trimmed,
      parentCommentId,
      parentUserName,
      createdAt: new Date().toISOString(),
      isOptimistic: true,
      replyCount: 0,
      replies: [],
    };

    if (parentCommentId) {
      // Add reply to the parent comment's replies array
      setComments(prev =>
        prev.map(c => {
          if (c.id === parentCommentId) {
            return {
              ...c,
              replyCount: (c.replyCount || 0) + 1,
              replies: [...(c.replies || []), optimisticComment],
            };
          }
          return c;
        })
      );
      setTotalAll(prev => prev + 1);
    } else {
      // Add top-level comment
      setComments(prev => [optimisticComment, ...prev]);
      setTotalTopLevel(prev => prev + 1);
      setTotalAll(prev => prev + 1);
    }

    setMessageText('');
    const wasReplyingTo = replyingTo;
    setReplyingTo(null);

    try {
      const { data, error: postErr } = await supabase.functions.invoke('process-contribution', {
        body: {
          action: 'post_comment',
          needId,
          userId: currentUserId,
          userName: currentUserName,
          userAvatar: currentUserAvatar,
          message: trimmed,
          parentCommentId,
        },
      });

      if (postErr || !data?.success) {
        // Revert optimistic update
        if (parentCommentId) {
          setComments(prev =>
            prev.map(c => {
              if (c.id === parentCommentId) {
                return {
                  ...c,
                  replyCount: Math.max(0, (c.replyCount || 0) - 1),
                  replies: (c.replies || []).filter(r => r.id !== optimisticId),
                };
              }
              return c;
            })
          );
        } else {
          setComments(prev => prev.filter(c => c.id !== optimisticId));
          setTotalTopLevel(prev => Math.max(0, prev - 1));
        }
        setTotalAll(prev => Math.max(0, prev - 1));
        setSendError(data?.error || 'Failed to post. Please try again.');
        setMessageText(trimmed);
        setReplyingTo(wasReplyingTo);
        return;
      }

      // Replace optimistic comment with real one
      if (data.comment) {
        const realComment: Comment = {
          ...data.comment,
          isOptimistic: false,
          replyCount: 0,
          replies: [],
        };

        if (parentCommentId) {
          setComments(prev =>
            prev.map(c => {
              if (c.id === parentCommentId) {
                return {
                  ...c,
                  replies: (c.replies || []).map(r =>
                    r.id === optimisticId ? realComment : r
                  ),
                };
              }
              return c;
            })
          );
        } else {
          setComments(prev =>
            prev.map(c => (c.id === optimisticId ? { ...realComment, replies: [], replyCount: 0 } : c))
          );
        }
      }
    } catch (err: any) {
      // Revert optimistic update
      if (parentCommentId) {
        setComments(prev =>
          prev.map(c => {
            if (c.id === parentCommentId) {
              return {
                ...c,
                replyCount: Math.max(0, (c.replyCount || 0) - 1),
                replies: (c.replies || []).filter(r => r.id !== optimisticId),
              };
            }
            return c;
          })
        );
      } else {
        setComments(prev => prev.filter(c => c.id !== optimisticId));
        setTotalTopLevel(prev => Math.max(0, prev - 1));
      }
      setTotalAll(prev => Math.max(0, prev - 1));
      setSendError('Network error. Please try again.');
      setMessageText(trimmed);
      setReplyingTo(wasReplyingTo);
    } finally {
      setIsSending(false);
    }
  }, [messageText, isSending, isLoggedIn, needId, currentUserId, currentUserName, currentUserAvatar, onSignInPress, replyingTo]);

  const charCount = messageText.trim().length;
  const isOverLimit = charCount > 1000;

  // ── Render Single Comment ──
  const renderComment = (comment: Comment, isReply: boolean = false) => {
    const isCurrentUser = comment.userId === currentUserId && isLoggedIn;

    return (
      <View
        key={comment.id}
        style={[
          styles.commentRow,
          comment.isOptimistic && styles.commentOptimistic,
          isReply && styles.replyRow,
        ]}
      >
        <Image
          source={{ uri: avatarUri(comment.userAvatar, comment.userName) }}
          style={isReply ? styles.replyAvatar : styles.commentAvatar}
        />
        <View style={styles.commentContent}>
          <View style={styles.commentMeta}>
            <Text style={styles.commentUserName} numberOfLines={1}>
              {comment.userName}
            </Text>
            {isCurrentUser && (
              <View style={styles.youBadge}>
                <Text style={styles.youBadgeText}>you</Text>
              </View>
            )}
            <Text style={styles.commentTime}>
              {comment.isOptimistic ? 'sending...' : getTimeAgo(comment.createdAt)}
            </Text>
          </View>

          {/* Show "replying to @username" for replies */}
          {isReply && comment.parentUserName && (
            <View style={styles.replyToIndicator}>
              <MaterialIcons name="reply" size={12} color={Colors.primary} style={{ transform: [{ scaleX: -1 }] }} />
              <Text style={styles.replyToText}>
                @{comment.parentUserName}
              </Text>
            </View>
          )}

          <Text style={styles.commentMessage}>{comment.message}</Text>

          {/* Reply button - only on non-optimistic comments */}
          {!comment.isOptimistic && (
            <TouchableOpacity
              style={styles.replyButton}
              onPress={() => handleStartReply(
                isReply ? (comment.parentCommentId || comment.id) : comment.id,
                comment.userName
              )}
              activeOpacity={0.6}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <MaterialIcons name="reply" size={14} color={Colors.textLight} style={{ transform: [{ scaleX: -1 }] }} />
              <Text style={styles.replyButtonText}>Reply</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  // ── Render Thread (top-level comment + replies) ──
  const renderThread = (comment: Comment) => {
    const replies = comment.replies || [];
    const replyCount = comment.replyCount || replies.length;
    const isCollapsed = collapsedThreads.has(comment.id);
    const hasReplies = replyCount > 0;

    return (
      <View key={comment.id} style={styles.threadContainer}>
        {/* Top-level comment */}
        {renderComment(comment, false)}

        {/* Replies section */}
        {hasReplies && (
          <View style={styles.repliesSection}>
            {/* Thread toggle button */}
            <TouchableOpacity
              style={styles.threadToggle}
              onPress={() => toggleThread(comment.id)}
              activeOpacity={0.6}
            >
              <View style={styles.threadToggleLine} />
              <View style={styles.threadToggleBtn}>
                <MaterialIcons
                  name={isCollapsed ? 'expand-more' : 'expand-less'}
                  size={16}
                  color={Colors.primary}
                />
                <Text style={styles.threadToggleText}>
                  {isCollapsed
                    ? `Show ${replyCount} ${replyCount === 1 ? 'reply' : 'replies'}`
                    : `Hide ${replyCount} ${replyCount === 1 ? 'reply' : 'replies'}`}
                </Text>
              </View>
            </TouchableOpacity>

            {/* Replies list (with connecting line) */}
            {!isCollapsed && (
              <View style={styles.repliesContainer}>
                {/* Vertical connecting line */}
                <View style={styles.threadLine} />

                <View style={styles.repliesList}>
                  {replies.map((reply) => (
                    <View key={reply.id} style={styles.replyWrapper}>
                      {/* Horizontal connector */}
                      <View style={styles.replyConnector} />
                      <View style={styles.replyContent}>
                        {renderComment(reply, true)}
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>
        )}
      </View>
    );
  };

  // ── Main Render ──
  return (
    <View style={styles.container}>
      {/* Section Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <MaterialIcons name="chat-bubble-outline" size={20} color={Colors.text} />
          <Text style={styles.headerTitle}>Discussion</Text>
          {totalAll > 0 && (
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{totalAll}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Error State */}
      {error && !isLoading && (
        <View style={styles.errorCard}>
          <MaterialIcons name="error-outline" size={18} color={Colors.error} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => { setError(null); fetchComments(true); }}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Loading State */}
      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading comments...</Text>
        </View>
      )}

      {/* Comments List */}
      {!isLoading && !error && (
        <>
          {comments.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialIcons name="forum" size={36} color={Colors.borderLight} />
              <Text style={styles.emptyTitle}>No comments yet</Text>
              <Text style={styles.emptySubtitle}>
                {isLoggedIn
                  ? 'Be the first to share your thoughts or words of encouragement.'
                  : 'Sign in to join the discussion.'}
              </Text>
            </View>
          ) : (
            <View style={styles.commentsList}>
              {comments.map((comment) => renderThread(comment))}
            </View>
          )}

          {/* Load More Button */}
          {hasMore && (
            <TouchableOpacity
              style={styles.loadMoreBtn}
              onPress={handleLoadMore}
              disabled={isLoadingMore}
              activeOpacity={0.7}
            >
              {isLoadingMore ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : (
                <>
                  <MaterialIcons name="expand-more" size={18} color={Colors.primary} />
                  <Text style={styles.loadMoreText}>
                    Load more comments ({totalTopLevel - comments.length} remaining)
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </>
      )}

      {/* Send Error */}
      {sendError && (
        <View style={styles.sendErrorCard}>
          <MaterialIcons name="warning" size={14} color={Colors.error} />
          <Text style={styles.sendErrorText}>{sendError}</Text>
          <TouchableOpacity onPress={() => setSendError(null)}>
            <MaterialIcons name="close" size={14} color={Colors.textLight} />
          </TouchableOpacity>
        </View>
      )}

      {/* Comment Input */}
      <View style={styles.inputSection}>
        {isLoggedIn ? (
          <>
            {/* Replying-to indicator */}
            {replyingTo && (
              <View style={styles.replyingToBar}>
                <View style={styles.replyingToLeft}>
                  <MaterialIcons name="reply" size={16} color={Colors.primary} style={{ transform: [{ scaleX: -1 }] }} />
                  <Text style={styles.replyingToLabel}>Replying to </Text>
                  <Text style={styles.replyingToName}>@{replyingTo.userName}</Text>
                </View>
                <TouchableOpacity
                  onPress={handleCancelReply}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  activeOpacity={0.6}
                >
                  <MaterialIcons name="close" size={18} color={Colors.textLight} />
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.inputRow}>
              <Image
                source={{ uri: avatarUri(currentUserAvatar, currentUserName) }}
                style={styles.inputAvatar}
              />
              <View style={styles.inputWrapper}>
                <TextInput
                  ref={inputRef}
                  style={[
                    styles.textInput,
                    isOverLimit && styles.textInputError,
                    replyingTo && styles.textInputReply,
                  ]}
                  placeholder={replyingTo ? `Reply to @${replyingTo.userName}...` : 'Add a comment...'}
                  placeholderTextColor={Colors.textLight}
                  value={messageText}
                  onChangeText={setMessageText}
                  multiline
                  maxLength={1050}
                  editable={!isSending}
                />
                {charCount > 800 && (
                  <Text style={[styles.charCount, isOverLimit && styles.charCountError]}>
                    {charCount}/1000
                  </Text>
                )}
              </View>
              <TouchableOpacity
                style={[
                  styles.sendBtn,
                  (!messageText.trim() || isSending || isOverLimit) && styles.sendBtnDisabled,
                ]}
                onPress={handlePostComment}
                disabled={!messageText.trim() || isSending || isOverLimit}
                activeOpacity={0.7}
              >
                {isSending ? (
                  <ActivityIndicator size="small" color={Colors.white} />
                ) : (
                  <MaterialIcons name="send" size={18} color={Colors.white} />
                )}
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <TouchableOpacity
            style={styles.signInPrompt}
            onPress={onSignInPress}
            activeOpacity={0.7}
          >
            <MaterialIcons name="lock-outline" size={16} color={Colors.primary} />
            <Text style={styles.signInPromptText}>Sign in to join the discussion</Text>
            <MaterialIcons name="chevron-right" size={18} color={Colors.primary} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    gap: Spacing.md,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  headerTitle: {
    fontSize: FontSize.lg,
    fontWeight: '800',
    color: Colors.text,
  },
  countBadge: {
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  countBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.primary,
  },

  // Error
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: '#FFF0F0',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  errorText: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.error,
  },
  retryText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.primary,
  },

  // Loading
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xl,
  },
  loadingText: {
    fontSize: FontSize.sm,
    color: Colors.textLight,
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
    gap: Spacing.sm,
  },
  emptyTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  emptySubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textLight,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 260,
  },

  // Comments List
  commentsList: {
    gap: 0,
  },

  // Thread Container
  threadContainer: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },

  // Comment Row
  commentRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
  },
  commentOptimistic: {
    opacity: 0.55,
  },
  replyRow: {
    paddingVertical: Spacing.sm,
  },
  commentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.borderLight,
  },
  replyAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.borderLight,
  },
  commentContent: {
    flex: 1,
    gap: 3,
  },
  commentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  commentUserName: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.text,
    maxWidth: 140,
  },
  youBadge: {
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: BorderRadius.full,
  },
  youBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.primary,
  },
  commentTime: {
    fontSize: FontSize.xs,
    color: Colors.textLight,
  },
  commentMessage: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },

  // Reply-to indicator on reply comments
  replyToIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginBottom: 1,
  },
  replyToText: {
    fontSize: 11,
    color: Colors.primary,
    fontWeight: '600',
  },

  // Reply button
  replyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
    alignSelf: 'flex-start',
    paddingVertical: 2,
    paddingHorizontal: 2,
  },
  replyButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textLight,
  },

  // Replies section
  repliesSection: {
    marginLeft: 18,
  },

  // Thread toggle
  threadToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
  },
  threadToggleLine: {
    width: 20,
    height: 1,
    backgroundColor: THREAD_LINE_COLOR,
    marginRight: Spacing.sm,
  },
  threadToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 2,
    paddingHorizontal: 4,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.primaryLight,
  },
  threadToggleText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.primary,
  },

  // Replies container (with connecting line)
  repliesContainer: {
    flexDirection: 'row',
    position: 'relative',
  },
  threadLine: {
    width: 2,
    backgroundColor: THREAD_LINE_COLOR,
    borderRadius: 1,
    marginLeft: 0,
    marginRight: 0,
    position: 'absolute',
    top: 0,
    bottom: 12,
    left: 0,
  },
  repliesList: {
    flex: 1,
    marginLeft: 0,
  },
  replyWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    position: 'relative',
  },
  replyConnector: {
    width: 18,
    height: 20,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    borderColor: THREAD_LINE_COLOR,
    borderBottomLeftRadius: 10,
    marginTop: 0,
    marginRight: Spacing.xs,
  },
  replyContent: {
    flex: 1,
  },

  // Load More
  loadMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.primaryLight,
    borderRadius: BorderRadius.lg,
  },
  loadMoreText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.primary,
  },

  // Send Error
  sendErrorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: '#FFF0F0',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  sendErrorText: {
    flex: 1,
    fontSize: FontSize.xs,
    color: Colors.error,
  },

  // Input Section
  inputSection: {
    marginTop: Spacing.xs,
  },

  // Replying-to bar
  replyingToBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
  },
  replyingToLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  replyingToLabel: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  replyingToName: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.primary,
  },

  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.sm,
  },
  inputAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.borderLight,
    marginBottom: 4,
  },
  inputWrapper: {
    flex: 1,
    position: 'relative',
  },
  textInput: {
    backgroundColor: Colors.surfaceAlt,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
    fontSize: FontSize.sm,
    color: Colors.text,
    maxHeight: 100,
    minHeight: 40,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  textInputError: {
    borderColor: Colors.error,
  },
  textInputReply: {
    borderColor: Colors.primary + '40',
    backgroundColor: Colors.primaryLight + '60',
  },
  charCount: {
    position: 'absolute',
    bottom: 4,
    right: 8,
    fontSize: 10,
    color: Colors.textLight,
  },
  charCountError: {
    color: Colors.error,
    fontWeight: '600',
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 0,
    ...Shadow.sm,
  },
  sendBtnDisabled: {
    backgroundColor: Colors.borderLight,
  },

  // Sign In Prompt
  signInPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primaryLight,
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.primary + '20',
  },
  signInPromptText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.primary,
  },
});
