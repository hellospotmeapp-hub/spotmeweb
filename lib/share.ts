import { Platform, Linking, Share } from 'react-native';

export const SITE_URL = 'https://spotmeone.com';

export function getBaseUrl(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') return window.location.origin;
  return SITE_URL;
}

/**
 * Copy text to the clipboard. Returns true when the text was actually copied.
 * Native has no clipboard module installed, so it falls back to the system
 * share sheet (which includes "Copy") and returns false.
 */
export async function copyText(text: string): Promise<boolean> {
  if (Platform.OS === 'web') {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        return ok;
      } catch {
        return false;
      }
    }
  }
  try {
    await Share.share({ message: text });
  } catch {}
  return false;
}

/** Open an external URL (new tab on web, the app/browser on native). */
export async function openExternal(url: string, sameTab = false): Promise<void> {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    if (sameTab) window.location.href = url;
    else window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }
  try {
    await Linking.openURL(url);
  } catch {}
}

export function smsUrl(body: string): string {
  // iOS uses "&body=", Android uses "?body="; "?&body=" works on both.
  const sep = Platform.OS === 'ios' ? '&' : '?';
  return `sms:${sep}body=${encodeURIComponent(body)}`;
}

export function mailUrl(subject: string, body: string): string {
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export type SocialPlatform =
  | 'whatsapp' | 'facebook' | 'x' | 'telegram' | 'linkedin' | 'reddit' | 'threads';

export function socialShareUrl(platform: SocialPlatform, text: string, url: string): string {
  const t = encodeURIComponent(text);
  const u = encodeURIComponent(url);
  switch (platform) {
    case 'whatsapp': return `https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`;
    case 'facebook': return `https://www.facebook.com/sharer/sharer.php?u=${u}`;
    case 'x': return `https://x.com/intent/post?text=${t}&url=${u}`;
    case 'telegram': return `https://t.me/share/url?url=${u}&text=${t}`;
    case 'linkedin': return `https://www.linkedin.com/sharing/share-offsite/?url=${u}`;
    case 'reddit': return `https://www.reddit.com/submit?url=${u}&title=${t}`;
    case 'threads': return `https://www.threads.net/intent/post?text=${encodeURIComponent(`${text} ${url}`)}`;
  }
}

/** Opens the OS share sheet. Returns false when unavailable or cancelled. */
export async function nativeShare(title: string, text: string, url: string): Promise<boolean> {
  try {
    if (Platform.OS === 'web') {
      if (typeof navigator !== 'undefined' && (navigator as any).share) {
        await (navigator as any).share({ title, text, url });
        return true;
      }
      return false;
    }
    await Share.share(Platform.OS === 'ios' ? { message: text, url } : { message: `${text}\n${url}`, title });
    return true;
  } catch {
    return false;
  }
}
