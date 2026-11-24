import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { FontAwesome6, MaterialIcons } from '@expo/vector-icons';
import { Colors, FontSize, Spacing, BorderRadius } from '@/lib/theme';
import {
  copyText, openExternal, smsUrl, mailUrl, socialShareUrl, nativeShare, SocialPlatform,
} from '@/lib/share';

interface SocialShareGridProps {
  url: string;
  /** Short message used by social networks */
  text: string;
  /** Longer message for SMS (url is appended) */
  smsText?: string;
  emailSubject?: string;
  emailBody?: string;
  /** Caption copied for apps with no web share link (Instagram, TikTok) */
  caption?: string;
  title?: string;
}

type Item = {
  key: string;
  label: string;
  icon: string;
  brand?: boolean;
  material?: boolean;
  bg: string;
  onPress: () => void;
};

export default function SocialShareGrid({
  url, text, smsText, emailSubject, emailBody, caption, title = 'SpotMeOne',
}: SocialShareGridProps) {
  const [notice, setNotice] = useState<{ text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  // Auto-dismiss the notice (restarts each time a new one is shown)
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => { setNotice(null); setCopied(false); }, 3000);
    return () => clearTimeout(t);
  }, [notice]);

  const flash = (text: string) => setNotice({ text });

  const social = (p: SocialPlatform) => () => openExternal(socialShareUrl(p, text, url));

  // Instagram & TikTok have no share-a-link URL: copy a caption, then open the app/site
  const copyThenOpen = (appName: string, appUrl: string) => () => {
    const body = `${caption || text}\n${url}`;
    copyText(body).then(ok => {
      if (ok) flash(`Caption and link copied. Paste it into your ${appName} post or story.`);
    });
    if (Platform.OS === 'web') openExternal(appUrl);
  };

  const canNativeShare = Platform.OS !== 'web'
    || (typeof navigator !== 'undefined' && !!(navigator as any).share);

  const items: Item[] = [
    { key: 'sms', label: 'Messages', icon: 'sms', material: true, bg: '#34C759',
      onPress: () => openExternal(smsUrl(`${smsText || text}\n${url}`), true) },
    { key: 'whatsapp', label: 'WhatsApp', icon: 'whatsapp', brand: true, bg: '#25D366', onPress: social('whatsapp') },
    { key: 'facebook', label: 'Facebook', icon: 'facebook-f', brand: true, bg: '#1877F2', onPress: social('facebook') },
    { key: 'x', label: 'X', icon: 'x-twitter', brand: true, bg: '#000000', onPress: social('x') },
    { key: 'instagram', label: 'Instagram', icon: 'instagram', brand: true, bg: '#E4405F',
      onPress: copyThenOpen('Instagram', 'https://www.instagram.com/') },
    { key: 'tiktok', label: 'TikTok', icon: 'tiktok', brand: true, bg: '#010101',
      onPress: copyThenOpen('TikTok', 'https://www.tiktok.com/upload') },
    { key: 'telegram', label: 'Telegram', icon: 'telegram', brand: true, bg: '#26A5E4', onPress: social('telegram') },
    { key: 'linkedin', label: 'LinkedIn', icon: 'linkedin-in', brand: true, bg: '#0A66C2', onPress: social('linkedin') },
    { key: 'email', label: 'Email', icon: 'email', material: true, bg: '#5856D6',
      onPress: () => openExternal(mailUrl(emailSubject || title, emailBody || `${text}\n\n${url}`), true) },
    { key: 'copy', label: copied ? 'Copied!' : 'Copy link', icon: copied ? 'check' : 'link', material: true,
      bg: copied ? Colors.success : Colors.textSecondary,
      onPress: () => {
        copyText(url).then(ok => {
          if (ok) { setCopied(true); flash('Link copied to clipboard.'); }
        });
      } },
  ];
  if (canNativeShare) {
    items.push({ key: 'more', label: 'More', icon: 'more-horiz', material: true, bg: Colors.primary,
      onPress: () => { nativeShare(title, text, url); } });
  }

  return (
    <View>
      <View style={styles.grid}>
        {items.map(item => (
          <TouchableOpacity
            key={item.key}
            style={styles.item}
            onPress={item.onPress}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={item.key === 'copy' ? 'Copy link' : `Share via ${item.label}`}
          >
            <View style={[styles.icon, { backgroundColor: item.bg }]}>
              {item.material ? (
                <MaterialIcons name={item.icon as any} size={24} color="#FFF" />
              ) : (
                <FontAwesome6 name={item.icon as any} size={22} color="#FFF" brand />
              )}
            </View>
            <Text style={styles.label} numberOfLines={1}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {!!notice && (
        <View style={styles.notice} accessibilityLiveRegion="polite">
          <MaterialIcons name="check-circle" size={16} color={Colors.success} />
          <Text style={styles.noticeText}>{notice.text}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: Spacing.lg },
  item: { width: '25%', alignItems: 'center', gap: 6, paddingHorizontal: 2 },
  icon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.textSecondary, textAlign: 'center' },
  notice: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.lg,
    backgroundColor: '#E8F5E8', padding: Spacing.md, borderRadius: BorderRadius.md,
  },
  noticeText: { flex: 1, fontSize: FontSize.sm, color: Colors.text },
});
