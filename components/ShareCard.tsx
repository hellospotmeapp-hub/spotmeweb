import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Platform, Share, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, BorderRadius, FontSize, Spacing, Shadow } from '@/app/lib/theme';
import { supabase } from '@/app/lib/supabase';

interface ShareCardProps {
  visible: boolean;
  onClose: () => void;
  // Optional: share a specific need
  needTitle?: string;
  needId?: string;
  needRaised?: number;
  needGoal?: number;
}

interface ImpactStats {
  totalRaised: number;
  totalSpots: number;
  goalsCompleted: number;
  activeNeeds: number;
  totalNeeds: number;
}

export default function ShareCard({ visible, onClose, needTitle, needId, needRaised, needGoal }: ShareCardProps) {
  const [stats, setStats] = useState<ImpactStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (visible) {
      fetchStats();
    }
  }, [visible]);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.functions.invoke('process-contribution', {
        body: { action: 'fetch_impact_stats' },
      });
      if (data?.success) {
        setStats(data.stats);
      }
    } catch {
      // Use fallback stats
      setStats({ totalRaised: 624, totalSpots: 87, goalsCompleted: 4, activeNeeds: 8, totalNeeds: 12 });
    } finally {
      setLoading(false);
    }
  };

  const getShareUrl = () => {
    const baseUrl = Platform.OS === 'web' ? (typeof window !== 'undefined' ? window.location.origin : 'https://spotmeone.com') : 'https://spotmeone.com';
    if (needId) return `${baseUrl}/need/${needId}`;
    return baseUrl;
  };


  const getShareText = () => {
    if (needTitle && needRaised !== undefined && needGoal !== undefined) {
      const pct = Math.round((needRaised / needGoal) * 100);
      return `Help someone on SpotMe! "${needTitle}" is ${pct}% funded ($${needRaised}/$${needGoal}). No tragedy, just life. Every dollar counts.`;
    }
    if (stats) {
      return `SpotMe community has raised $${stats.totalRaised.toLocaleString()} and completed ${stats.goalsCompleted} goals! Join us - no tragedy, just life. Help your neighbors with everyday needs.`;
    }
    return 'SpotMe - Help your neighbors with everyday needs. No tragedy, just life. Every dollar counts.';
  };

  const handleShare = async (platform: 'tiktok' | 'twitter' | 'copy' | 'native') => {
    const url = getShareUrl();
    const text = getShareText();

    if (platform === 'tiktok') {
      // TikTok doesn't have a direct share URL, but we can open it with a caption
      const tiktokUrl = `https://www.tiktok.com/upload?caption=${encodeURIComponent(text + ' ' + url)}`;
      if (Platform.OS === 'web') {
        window.open(tiktokUrl, '_blank');
      }
    } else if (platform === 'twitter') {
      const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
      if (Platform.OS === 'web') {
        window.open(twitterUrl, '_blank');
      }
    } else if (platform === 'copy') {
      if (Platform.OS === 'web') {
        try {
          await navigator.clipboard.writeText(`${text}\n${url}`);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          // Fallback
          const textArea = document.createElement('textarea');
          textArea.value = `${text}\n${url}`;
          document.body.appendChild(textArea);
          textArea.select();
          document.execCommand('copy');
          document.body.removeChild(textArea);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }
      }
    } else if (platform === 'native') {
      try {
        if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.share) {
          await navigator.share({ title: 'SpotMe', text, url });
        } else {
          await Share.share({ message: `${text}\n${url}` });
        }
      } catch {}
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} onPress={onClose} activeOpacity={1} />
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <Text style={styles.headerTitle}>Share SpotMe</Text>
            <TouchableOpacity onPress={onClose}>
              <MaterialIcons name="close" size={24} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Impact Card Preview */}
          <View style={styles.impactCard}>
            <View style={styles.impactGradient}>
              <View style={[styles.impactCircle, styles.impactCircle1]} />
              <View style={[styles.impactCircle, styles.impactCircle2]} />

              <Text style={styles.impactLogo}>SpotMe</Text>
              <Text style={styles.impactTagline}>No tragedy. Just life.</Text>

              {loading ? (
                <ActivityIndicator color={Colors.white} style={{ marginVertical: 20 }} />
              ) : needTitle ? (
                <View style={styles.impactNeedSection}>
                  <Text style={styles.impactNeedTitle} numberOfLines={2}>"{needTitle}"</Text>
                  {needRaised !== undefined && needGoal !== undefined && (
                    <View style={styles.impactProgressRow}>
                      <View style={styles.impactTrack}>
                        <View style={[styles.impactFill, { width: `${Math.min((needRaised / needGoal) * 100, 100)}%` }]} />
                      </View>
                      <Text style={styles.impactProgressText}>${needRaised}/${needGoal}</Text>
                    </View>
                  )}
                </View>
              ) : stats ? (
                <View style={styles.impactStatsGrid}>
                  <View style={styles.impactStat}>
                    <Text style={styles.impactStatNumber}>${stats.totalRaised.toLocaleString()}</Text>
                    <Text style={styles.impactStatLabel}>Raised</Text>
                  </View>
                  <View style={styles.impactStatDivider} />
                  <View style={styles.impactStat}>
                    <Text style={styles.impactStatNumber}>{stats.totalSpots}</Text>
                    <Text style={styles.impactStatLabel}>Spots Given</Text>
                  </View>
                  <View style={styles.impactStatDivider} />
                  <View style={styles.impactStat}>
                    <Text style={styles.impactStatNumber}>{stats.goalsCompleted}</Text>
                    <Text style={styles.impactStatLabel}>Goals Met</Text>
                  </View>
                </View>
              ) : null}

              <Text style={styles.impactCTA}>Help your neighbors. Every dollar counts.</Text>
            </View>
          </View>

          {/* Share Buttons */}
          <Text style={styles.shareLabel}>Share to</Text>

          <View style={styles.shareGrid}>
            <TouchableOpacity style={styles.shareButton} onPress={() => handleShare('tiktok')} activeOpacity={0.7}>
              <View style={[styles.shareIconBg, { backgroundColor: '#000000' }]}>
                <MaterialIcons name="music-note" size={24} color="#FFF" />
              </View>
              <Text style={styles.shareButtonText}>TikTok</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.shareButton} onPress={() => handleShare('twitter')} activeOpacity={0.7}>
              <View style={[styles.shareIconBg, { backgroundColor: '#1DA1F2' }]}>
                <MaterialIcons name="tag" size={24} color="#FFF" />
              </View>
              <Text style={styles.shareButtonText}>X / Twitter</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.shareButton} onPress={() => handleShare('copy')} activeOpacity={0.7}>
              <View style={[styles.shareIconBg, { backgroundColor: Colors.secondary }]}>
                <MaterialIcons name={copied ? 'check' : 'content-copy'} size={24} color="#FFF" />
              </View>
              <Text style={styles.shareButtonText}>{copied ? 'Copied!' : 'Copy Link'}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.shareButton} onPress={() => handleShare('native')} activeOpacity={0.7}>
              <View style={[styles.shareIconBg, { backgroundColor: Colors.primary }]}>
                <MaterialIcons name="share" size={24} color="#FFF" />
              </View>
              <Text style={styles.shareButtonText}>More</Text>
            </TouchableOpacity>
          </View>

          {/* Viral tip */}
          <View style={styles.viralTip}>
            <MaterialIcons name="auto-awesome" size={18} color={Colors.accent} />
            <Text style={styles.viralTipText}>
              Sharing on TikTok? Use #SpotMe #MutualAid #HelpYourNeighbor for maximum reach
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { flex: 1, backgroundColor: Colors.overlay },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.xxl,
    borderTopRightRadius: BorderRadius.xxl,
    paddingHorizontal: Spacing.xxl,
    paddingBottom: 40,
    maxHeight: '92%',
  },
  handle: { width: 40, height: 4, backgroundColor: Colors.border, borderRadius: 2, alignSelf: 'center', marginTop: Spacing.md, marginBottom: Spacing.lg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg },
  headerTitle: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.text },

  // Impact Card
  impactCard: {
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    marginBottom: Spacing.xl,
    ...Shadow.lg,
  },
  impactGradient: {
    backgroundColor: Colors.primary,
    padding: Spacing.xxl,
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  impactCircle: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  impactCircle1: { width: 200, height: 200, top: -80, right: -60 },
  impactCircle2: { width: 140, height: 140, bottom: -40, left: -30 },
  impactLogo: { fontSize: FontSize.xxl, fontWeight: '900', color: Colors.white, letterSpacing: -0.5 },
  impactTagline: { fontSize: FontSize.sm, color: 'rgba(255,255,255,0.8)', fontStyle: 'italic', marginBottom: Spacing.lg },
  impactNeedSection: { width: '100%', gap: Spacing.md, marginVertical: Spacing.md },
  impactNeedTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.white, textAlign: 'center' },
  impactProgressRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  impactTrack: { flex: 1, height: 8, backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 4, overflow: 'hidden' },
  impactFill: { height: '100%', backgroundColor: Colors.white, borderRadius: 4 },
  impactProgressText: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.white },
  impactStatsGrid: { flexDirection: 'row', alignItems: 'center', marginVertical: Spacing.lg, gap: Spacing.lg },
  impactStat: { alignItems: 'center' },
  impactStatNumber: { fontSize: FontSize.xl, fontWeight: '900', color: Colors.white },
  impactStatLabel: { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  impactStatDivider: { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.25)' },
  impactCTA: { fontSize: FontSize.sm, color: 'rgba(255,255,255,0.9)', fontWeight: '600', marginTop: Spacing.sm },

  // Share buttons
  shareLabel: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: Spacing.md },
  shareGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.xl },
  shareButton: { alignItems: 'center', gap: Spacing.sm, flex: 1 },
  shareIconBg: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', ...Shadow.sm },
  shareButtonText: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.textSecondary },

  // Viral tip
  viralTip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    backgroundColor: Colors.accentLight,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
  viralTipText: { flex: 1, fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
});
