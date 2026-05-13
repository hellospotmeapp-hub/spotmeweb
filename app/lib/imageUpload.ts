import { Platform } from 'react-native';
import { supabase } from './supabase';

export interface ImagePickResult {
  uri: string;
  base64: string;
  mimeType: string;
  width?: number;
  height?: number;
}

// Minimum valid base64 length for a real image (even a tiny JPEG is ~500+ chars)
const MIN_VALID_BASE64 = 400;
// Target: base64 under 500KB
const MAX_BASE64_SIZE = 500_000;

// ============================================================
// PROGRESS CALLBACK TYPE
// ============================================================
export type UploadProgressCallback = (progress: number, status: 'compressing' | 'uploading' | 'retrying' | 'success' | 'error') => void;

// ============================================================
// RETRY CONFIGURATION
// ============================================================
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000; // 1s, 2s, 4s exponential backoff

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================
// PHOTO CACHE — in-memory cache for prefetched user photos
// ============================================================
const _photoCache = new Map<string, string[]>();

/** Prefetch and cache a user's uploaded need photos */
export async function prefetchUserPhotos(userId: string, photoUrls: string[]): Promise<number> {
  if (!userId || !photoUrls.length) return 0;
  
  // Store in cache
  _photoCache.set(userId, photoUrls);
  
  // Prefetch images using RN Image.prefetch
  let loaded = 0;
  const { Image } = require('react-native');
  
  await Promise.allSettled(
    photoUrls.filter(Boolean).map(async (url) => {
      try {
        const ok = await Image.prefetch(url);
        if (ok) loaded++;
      } catch {}
    })
  );
  
  console.log(`[ImageUpload] Prefetched ${loaded}/${photoUrls.length} photos for user ${userId.substring(0, 8)}`);
  return loaded;
}

/** Get cached photo URLs for a user */
export function getCachedUserPhotos(userId: string): string[] {
  return _photoCache.get(userId) || [];
}

// ============================================================
// UNIVERSAL PICKER (avatar - small, square-ish)
// ============================================================
export function pickImage(): Promise<ImagePickResult | null> {
  if (Platform.OS === 'web') return pickImageWeb();
  return pickImageNative({ maxSize: 400, quality: 0.7, allowsEditing: true, aspect: [1, 1] });
}

// ============================================================
// NEED PHOTO PICKER (larger, no crop — 1200px, 80% quality)
// ============================================================
export function pickNeedPhoto(): Promise<ImagePickResult | null> {
  if (Platform.OS === 'web') return pickNeedPhotoWeb();
  return pickImageNative({ maxSize: 1200, quality: 0.8, allowsEditing: false });
}

// ============================================================
// NATIVE PICKER (iOS / Android) using expo-image-picker
// ============================================================
interface NativePickOptions {
  maxSize: number;
  quality: number;
  allowsEditing?: boolean;
  aspect?: [number, number];
}

async function pickImageNative(opts: NativePickOptions): Promise<ImagePickResult | null> {
  try {
    const ImagePicker = await import('expo-image-picker');

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      console.warn('[ImageUpload] Media library permission denied');
      try {
        const { Alert } = require('react-native');
        Alert.alert(
          'Permission Needed',
          'Please allow access to your photo library in Settings to upload photos.',
          [{ text: 'OK' }]
        );
      } catch {}
      return null;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: opts.allowsEditing ?? false,
      aspect: opts.aspect,
      quality: opts.quality,
      base64: true,
      exif: false,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return null;
    }

    const asset = result.assets[0];
    const uri = asset.uri;
    const base64 = asset.base64 || '';
    const mimeType = asset.mimeType || 'image/jpeg';
    const width = asset.width;
    const height = asset.height;

    if (!base64 || base64.length < MIN_VALID_BASE64) {
      console.error(`[ImageUpload] Native picker returned invalid base64 (${base64.length} chars)`);
      return null;
    }

    // If too large, compress with expo-image-manipulator
    if (base64.length > MAX_BASE64_SIZE) {
      console.warn(`[ImageUpload] Native image too large (${(base64.length / 1024).toFixed(0)}KB), compressing to 1200px/80%`);
      try {
        const ImageManipulator = await import('expo-image-manipulator');
        const manipResult = await ImageManipulator.manipulateAsync(
          uri,
          [{ resize: { width: Math.min(width || 1200, opts.maxSize) } }],
          { compress: opts.quality, format: ImageManipulator.SaveFormat.JPEG, base64: true }
        );
        if (manipResult.base64 && manipResult.base64.length >= MIN_VALID_BASE64) {
          console.log(`[ImageUpload] Compressed to ${(manipResult.base64.length / 1024).toFixed(0)}KB`);
          return {
            uri: manipResult.uri,
            base64: manipResult.base64,
            mimeType: 'image/jpeg',
            width: manipResult.width,
            height: manipResult.height,
          };
        }
      } catch (compErr) {
        console.warn('[ImageUpload] Native compression failed:', compErr);
      }
    }

    console.log(`[ImageUpload] Native picked: ${(base64.length / 1024).toFixed(0)}KB, ${width}x${height}`);
    return { uri, base64, mimeType, width, height };
  } catch (err: any) {
    console.error('[ImageUpload] Native picker error:', err);
    return null;
  }
}

// Also expose a camera picker for native
export async function pickImageFromCamera(): Promise<ImagePickResult | null> {
  if (Platform.OS === 'web') return null;

  try {
    const ImagePicker = await import('expo-image-picker');

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      console.warn('[ImageUpload] Camera permission denied');
      try {
        const { Alert } = require('react-native');
        Alert.alert(
          'Camera Permission Needed',
          'Please allow camera access in Settings to take photos.',
          [{ text: 'OK' }]
        );
      } catch {}
      return null;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 0.8,
      base64: true,
      exif: false,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return null;
    }

    const asset = result.assets[0];
    const base64 = asset.base64 || '';

    if (!base64 || base64.length < MIN_VALID_BASE64) {
      console.error(`[ImageUpload] Camera returned invalid base64 (${base64.length} chars)`);
      return null;
    }

    console.log(`[ImageUpload] Camera captured: ${(base64.length / 1024).toFixed(0)}KB`);

    return {
      uri: asset.uri,
      base64,
      mimeType: asset.mimeType || 'image/jpeg',
      width: asset.width,
      height: asset.height,
    };
  } catch (err: any) {
    console.error('[ImageUpload] Camera error:', err);
    return null;
  }
}

// ============================================================
// WEB PICKERS
// ============================================================
function pickImageWeb(): Promise<ImagePickResult | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/webp,image/gif';
    input.style.display = 'none';
    document.body.appendChild(input);

    let resolved = false;
    const cleanup = () => { if (input.parentNode) try { document.body.removeChild(input); } catch {} };

    input.onchange = async (e: any) => {
      if (resolved) return;
      resolved = true;
      const file = e.target?.files?.[0];
      cleanup();
      if (!file) { resolve(null); return; }
      try {
        resolve(await compressImage(file, 400, 0.7));
      } catch (err) {
        console.error('[ImageUpload] Avatar compression failed:', err);
        try {
          resolve(await rawFileToBase64(file));
        } catch { resolve(null); }
      }
    };

    input.oncancel = () => { if (resolved) return; resolved = true; cleanup(); resolve(null); };

    const handleFocus = () => {
      setTimeout(() => {
        if (!resolved) { resolved = true; cleanup(); resolve(null); }
        window.removeEventListener('focus', handleFocus);
      }, 2000);
    };
    window.addEventListener('focus', handleFocus);
    input.click();
  });
}

function pickNeedPhotoWeb(): Promise<ImagePickResult | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/webp,image/gif';
    input.style.display = 'none';
    document.body.appendChild(input);
    let resolved = false;
    const cleanup = () => { if (input.parentNode) try { document.body.removeChild(input); } catch {} };

    input.onchange = async (e: any) => {
      if (resolved) return; resolved = true;
      const file = e.target?.files?.[0]; cleanup();
      if (!file) { resolve(null); return; }
      try {
        // Compress to 1200px max, 80% JPEG quality
        resolve(await compressImage(file, 1200, 0.8));
      } catch (err) {
        console.error('[ImageUpload] Need photo compression failed:', err);
        try {
          resolve(await rawFileToBase64(file));
        } catch { resolve(null); }
      }
    };
    input.oncancel = () => { if (resolved) return; resolved = true; cleanup(); resolve(null); };

    const handleFocus = () => {
      setTimeout(() => {
        if (!resolved) { resolved = true; cleanup(); resolve(null); }
        window.removeEventListener('focus', handleFocus);
      }, 2000);
    };
    window.addEventListener('focus', handleFocus);
    input.click();
  });
}

// ============================================================
// WEB IMAGE COMPRESSION — targets 1200px, 80% JPEG
// ============================================================
function compressImage(file: File, maxSize: number, quality: number): Promise<ImagePickResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      if (!dataUrl) { reject(new Error('File read empty')); return; }
      
      const img = new Image();
      img.onload = () => {
        try {
          const result = compressToTarget(img, maxSize, quality);
          if (result.base64.length < MIN_VALID_BASE64) {
            console.warn(`[ImageUpload] Canvas produced invalid base64 (${result.base64.length} chars), using raw file`);
            const rawBase64 = dataUrl.split(',')[1];
            if (rawBase64 && rawBase64.length >= MIN_VALID_BASE64) {
              resolve({
                uri: dataUrl,
                base64: rawBase64,
                mimeType: file.type || 'image/jpeg',
                width: img.naturalWidth,
                height: img.naturalHeight,
              });
            } else {
              reject(new Error('Image data too small after processing'));
            }
            return;
          }
          resolve(result);
        } catch (err) { reject(err); }
      };
      img.onerror = () => {
        console.warn('[ImageUpload] Image element failed to load, using raw file data');
        const rawBase64 = dataUrl.split(',')[1];
        if (rawBase64 && rawBase64.length >= MIN_VALID_BASE64) {
          resolve({
            uri: dataUrl,
            base64: rawBase64,
            mimeType: file.type || 'image/jpeg',
          });
        } else {
          reject(new Error('Image load failed'));
        }
      };
      img.src = dataUrl;
    };
    reader.onerror = () => reject(new Error('File read failed'));
    reader.readAsDataURL(file);
  });
}

function compressToTarget(img: HTMLImageElement, maxDim: number, startQuality: number): ImagePickResult {
  const attempts = [
    { maxDim, quality: startQuality },
    { maxDim, quality: 0.5 },
    { maxDim: Math.min(maxDim, 800), quality: 0.5 },
    { maxDim: 600, quality: 0.4 },
    { maxDim: 400, quality: 0.3 },
    { maxDim: 300, quality: 0.25 },
  ];

  for (const attempt of attempts) {
    const result = tryCompress(img, attempt.maxDim, attempt.quality);
    if (result.base64.length < MIN_VALID_BASE64) {
      console.warn(`[ImageUpload] Attempt ${attempt.maxDim}px q${attempt.quality} produced only ${result.base64.length} chars`);
      continue;
    }
    if (result.base64.length <= MAX_BASE64_SIZE) {
      console.log(`[ImageUpload] Compressed to ${(result.base64.length / 1024).toFixed(0)}KB base64 at ${attempt.maxDim}px q${attempt.quality}`);
      return result;
    }
  }

  console.warn('[ImageUpload] Using last-resort compression (200px, q0.2)');
  const lastResort = tryCompress(img, 200, 0.2);
  if (lastResort.base64.length < MIN_VALID_BASE64) {
    throw new Error('Canvas compression failed - produced empty image');
  }
  return lastResort;
}

function tryCompress(img: HTMLImageElement, maxDim: number, quality: number): ImagePickResult {
  const canvas = document.createElement('canvas');
  let width = img.naturalWidth || img.width;
  let height = img.naturalHeight || img.height;
  
  if (!width || !height || width <= 0 || height <= 0) {
    console.warn(`[ImageUpload] Invalid image dimensions: ${width}x${height}`);
    width = maxDim;
    height = maxDim;
  }
  
  if (width > maxDim || height > maxDim) {
    if (width > height) {
      height = Math.round((height * maxDim) / width);
      width = maxDim;
    } else {
      width = Math.round((width * maxDim) / height);
      height = maxDim;
    }
  }
  
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context failed');
  
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);

  let dataUrl = canvas.toDataURL('image/jpeg', quality);
  let base64 = dataUrl.split(',')[1] || '';
  
  if (base64.length < MIN_VALID_BASE64) {
    console.warn('[ImageUpload] JPEG encoding failed, trying PNG');
    dataUrl = canvas.toDataURL('image/png');
    base64 = dataUrl.split(',')[1] || '';
  }

  return { uri: dataUrl, base64, mimeType: 'image/jpeg', width, height };
}

function rawFileToBase64(file: File): Promise<ImagePickResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      if (!dataUrl) { reject(new Error('File read empty')); return; }
      const base64 = dataUrl.split(',')[1];
      if (!base64 || base64.length < MIN_VALID_BASE64) {
        reject(new Error('File too small or corrupt'));
        return;
      }
      resolve({
        uri: dataUrl,
        base64,
        mimeType: file.type || 'image/jpeg',
      });
    };
    reader.onerror = () => reject(new Error('File read failed'));
    reader.readAsDataURL(file);
  });
}

// Re-compress a base64 string (web only)
function recompressBase64(base64: string, maxDim: number, quality: number): Promise<ImagePickResult | null> {
  if (Platform.OS !== 'web') return Promise.resolve(null);
  
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const result = compressToTarget(img, maxDim, quality);
        if (result.base64.length >= MIN_VALID_BASE64) {
          resolve(result);
        } else {
          resolve(null);
        }
      } catch { resolve(null); }
    };
    img.onerror = () => resolve(null);
    
    const src = base64.startsWith('data:') ? base64 : `data:image/jpeg;base64,${base64}`;
    img.src = src;
  });
}

// ============================================================
// UPLOAD FUNCTIONS — with retry logic + progress callback
// ============================================================

// Helper: convert base64 to Uint8Array
function base64ToBytes(base64: string): Uint8Array {
  let clean = base64;
  if (clean.includes(',')) {
    clean = clean.split(',').pop() || '';
  }
  clean = clean.replace(/^data:image\/\w+;base64,?/, '').trim();
  
  const binaryString = atob(clean);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Upload a need photo with retry logic and progress reporting.
 * - Compresses to 1200px max width, 80% JPEG quality
 * - Retries up to 3 times with exponential backoff (1s, 2s, 4s)
 * - Reports progress via callback
 */
export async function uploadNeedPhoto(
  userId: string,
  imageBase64: string,
  mimeType: string = 'image/jpeg',
  needTitle?: string,
  onProgress?: UploadProgressCallback
): Promise<{ success: boolean; photoUrl?: string; error?: string; retryCount?: number }> {
  const report = (p: number, s: 'compressing' | 'uploading' | 'retrying' | 'success' | 'error') => {
    onProgress?.(p, s);
  };

  try {
    if (!imageBase64 || imageBase64.length < MIN_VALID_BASE64) {
      console.error(`[ImageUpload] Base64 too short (${imageBase64?.length || 0} chars)`);
      report(0, 'error');
      return { success: false, error: 'Photo could not be processed. Please try a different image.' };
    }

    // ---- COMPRESSION PHASE ----
    report(0.05, 'compressing');

    // Re-compress if too large (web only)
    if (imageBase64.length > 800_000 && Platform.OS === 'web') {
      console.warn(`[ImageUpload] Base64 large (${(imageBase64.length/1024).toFixed(0)}KB), re-compressing to 1200px/80%...`);
      report(0.1, 'compressing');
      try {
        const recompressed = await recompressBase64(imageBase64, 1200, 0.8);
        if (recompressed && recompressed.base64.length >= MIN_VALID_BASE64) {
          imageBase64 = recompressed.base64;
          mimeType = 'image/jpeg';
          console.log(`[ImageUpload] Re-compressed to ${(imageBase64.length/1024).toFixed(0)}KB`);
        }
      } catch (e) {
        console.warn('[ImageUpload] Re-compression failed:', e);
      }
    }

    report(0.2, 'compressing');

    if (imageBase64.length > 2_000_000) {
      report(0, 'error');
      return { success: false, error: 'Image is too large even after compression. Please try a smaller photo.' };
    }

    if (imageBase64.length < MIN_VALID_BASE64) {
      report(0, 'error');
      return { success: false, error: 'Photo processing failed. Please try selecting a different image.' };
    }

    // Convert base64 to binary
    let bytes: Uint8Array;
    try {
      bytes = base64ToBytes(imageBase64);
    } catch (decodeErr: any) {
      console.error('[ImageUpload] Base64 decode failed:', decodeErr.message);
      report(0, 'error');
      return { success: false, error: 'Failed to process image. Please try a different photo.' };
    }

    report(0.25, 'uploading');

    const fileSizeKB = Math.round(bytes.length / 1024);
    console.log(`[ImageUpload] Uploading ${fileSizeKB}KB to storage`);

    // Determine file extension
    const ext = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg';
    const prefix = (userId || 'anon').substring(0, 40);
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 10);
    const fileName = `${prefix}_${timestamp}_${randomSuffix}.${ext}`;
    const bucket = 'need-photos';

    const { supabaseUrl, supabaseKey } = await import('./supabaseClient');
    const uploadUrl = `${supabaseUrl}/storage/v1/object/${bucket}/${fileName}`;

    // ---- UPLOAD WITH RETRY + EXPONENTIAL BACKOFF ----
    let lastError = '';
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (attempt > 0) {
        const backoffMs = BASE_DELAY_MS * Math.pow(2, attempt - 1);
        console.log(`[ImageUpload] Retry ${attempt}/${MAX_RETRIES} after ${backoffMs}ms backoff`);
        report(0.25, 'retrying');
        await delay(backoffMs);
      }

      try {
        // Simulate progress during upload
        const progressStart = 0.3;
        const progressEnd = 0.9;
        
        // Start a progress simulation timer
        let progressValue = progressStart;
        const progressInterval = setInterval(() => {
          progressValue = Math.min(progressValue + 0.05, progressEnd);
          report(progressValue, attempt > 0 ? 'retrying' : 'uploading');
        }, 200);

        const uploadResp = await fetch(uploadUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'apikey': supabaseKey,
            'Content-Type': mimeType || 'image/jpeg',
            'x-upsert': 'true',
          },
          body: bytes,
        });

        clearInterval(progressInterval);

        if (uploadResp.ok) {
          const publicUrl = `${supabaseUrl}/storage/v1/object/public/${bucket}/${fileName}`;
          console.log(`[ImageUpload] SUCCESS (attempt ${attempt + 1}): ${publicUrl}`);
          report(1, 'success');
          return { success: true, photoUrl: publicUrl, retryCount: attempt };
        }

        const errText = await uploadResp.text();
        console.error(`[ImageUpload] Upload failed (attempt ${attempt + 1}, status ${uploadResp.status}): ${errText}`);

        // Don't retry on 4xx errors (client errors)
        if (uploadResp.status >= 400 && uploadResp.status < 500 && uploadResp.status !== 408 && uploadResp.status !== 429) {
          let userError = 'Photo upload failed. Please try again.';
          try {
            const errObj = JSON.parse(errText);
            if (errObj.error === 'Bucket not found') {
              userError = 'Storage not configured. Please contact support.';
            } else if (uploadResp.status === 413) {
              userError = 'Image is too large. Please try a smaller photo.';
            } else if (uploadResp.status === 403) {
              userError = 'Upload permission denied. Please try again.';
            }
          } catch {}
          report(0, 'error');
          return { success: false, error: userError, retryCount: attempt };
        }

        lastError = `Upload failed (${uploadResp.status})`;
      } catch (fetchErr: any) {
        console.error(`[ImageUpload] Fetch error (attempt ${attempt + 1}):`, fetchErr.message);
        lastError = fetchErr.message || 'Network error';
      }
    }

    // All retries exhausted
    report(0, 'error');
    return { success: false, error: `Upload failed after ${MAX_RETRIES + 1} attempts: ${lastError}`, retryCount: MAX_RETRIES };
  } catch (err: any) {
    console.error('[ImageUpload] Upload exception:', err.message);
    report(0, 'error');
    return { success: false, error: err.message || 'Upload failed' };
  }
}


export async function uploadAvatar(
  userId: string, imageBase64: string, mimeType: string = 'image/jpeg'
): Promise<{ success: boolean; avatarUrl?: string; error?: string }> {
  try {
    if (!imageBase64 || imageBase64.length < MIN_VALID_BASE64) {
      return { success: false, error: 'Avatar image could not be processed. Please try a different photo.' };
    }

    if (imageBase64.length > 500_000 && Platform.OS === 'web') {
      try {
        const recompressed = await recompressBase64(imageBase64, 300, 0.5);
        if (recompressed && recompressed.base64.length >= MIN_VALID_BASE64) {
          imageBase64 = recompressed.base64;
          mimeType = 'image/jpeg';
          console.log(`[ImageUpload] Avatar re-compressed to ${(imageBase64.length / 1024).toFixed(0)}KB`);
        }
      } catch (e) {
        console.warn('[ImageUpload] Avatar re-compression failed:', e);
      }
    }

    if (imageBase64.length > 2_000_000) {
      return { success: false, error: 'Avatar image is too large. Please try a smaller photo.' };
    }

    if (imageBase64.length < MIN_VALID_BASE64) {
      return { success: false, error: 'Avatar processing failed. Please try a different image.' };
    }

    console.log(`[ImageUpload] Uploading avatar ${(imageBase64.length / 1024).toFixed(0)}KB to storage directly`);

    let bytes: Uint8Array;
    try {
      bytes = base64ToBytes(imageBase64);
    } catch (decodeErr: any) {
      console.error('[ImageUpload] Avatar base64 decode failed:', decodeErr.message);
      return { success: false, error: 'Failed to process avatar. Please try a different photo.' };
    }

    console.log(`[ImageUpload] Avatar decoded ${bytes.length} bytes, uploading to Supabase storage...`);

    const ext = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg';
    const prefix = (userId || 'anon').substring(0, 40);
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 10);
    const fileName = `${prefix}_${timestamp}_${randomSuffix}.${ext}`;
    const bucket = 'avatars';

    const { supabaseUrl, supabaseKey } = await import('./supabaseClient');

    const uploadUrl = `${supabaseUrl}/storage/v1/object/${bucket}/${fileName}`;

    // Retry avatar uploads too (2 retries)
    for (let attempt = 0; attempt <= 2; attempt++) {
      if (attempt > 0) {
        await delay(BASE_DELAY_MS * Math.pow(2, attempt - 1));
      }

      try {
        const uploadResp = await fetch(uploadUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'apikey': supabaseKey,
            'Content-Type': mimeType || 'image/jpeg',
            'x-upsert': 'true',
          },
          body: bytes,
        });

        if (uploadResp.ok) {
          const avatarUrl = `${supabaseUrl}/storage/v1/object/public/${bucket}/${fileName}`;
          console.log(`[ImageUpload] Avatar upload SUCCESS: ${avatarUrl}`);

          // Sync avatar across profile and needs
          try {
            const { supabase: db } = await import('./supabase');
            const { error: profileErr } = await db.from('profiles').update({ avatar: avatarUrl }).eq('id', userId);
            if (profileErr) console.warn('[ImageUpload] Failed to update profile avatar:', profileErr.message);

            const { data: updatedNeeds, error: needsErr } = await db
              .from('needs')
              .update({ user_avatar: avatarUrl })
              .eq('user_id', userId)
              .select('id');
            if (needsErr) console.warn('[ImageUpload] Failed to sync avatar to needs:', needsErr.message);
            else console.log(`[ImageUpload] Synced avatar to ${updatedNeeds?.length || 0} existing need(s)`);

            try {
              await db.from('contributions').update({ user_avatar: avatarUrl }).eq('user_id', userId);
            } catch {}
          } catch (syncErr: any) {
            console.warn('[ImageUpload] Avatar sync error (non-fatal):', syncErr.message);
          }

          return { success: true, avatarUrl };
        }

        if (uploadResp.status >= 400 && uploadResp.status < 500 && uploadResp.status !== 408 && uploadResp.status !== 429) {
          const errText = await uploadResp.text();
          console.error(`[ImageUpload] Avatar upload failed (${uploadResp.status}): ${errText}`);
          let userError = 'Avatar upload failed. Please try again.';
          try {
            const errObj = JSON.parse(errText);
            if (errObj.error === 'Bucket not found') userError = 'Avatar storage not configured.';
            else if (uploadResp.status === 413) userError = 'Avatar image is too large.';
            else if (uploadResp.status === 403) userError = 'Upload permission denied.';
          } catch {}
          return { success: false, error: userError };
        }
      } catch (fetchErr: any) {
        console.error(`[ImageUpload] Avatar fetch error (attempt ${attempt + 1}):`, fetchErr.message);
        if (attempt === 2) {
          return { success: false, error: fetchErr.message || 'Avatar upload failed' };
        }
      }
    }

    return { success: false, error: 'Avatar upload failed after retries' };
  } catch (err: any) {
    console.error('[ImageUpload] Avatar upload exception:', err.message);
    return { success: false, error: err.message || 'Avatar upload failed' };
  }
}


// ============================================================
// CONVENIENCE: PICK + UPLOAD COMBOS
// ============================================================
export async function pickAndUploadNeedPhoto(
  userId: string, needTitle?: string, onProgress?: UploadProgressCallback
): Promise<{ success: boolean; photoUrl?: string; localUri?: string; error?: string }> {
  const picked = await pickNeedPhoto();
  if (!picked) return { success: false, error: 'cancelled' };
  
  if (!picked.base64 || picked.base64.length < MIN_VALID_BASE64) {
    console.error(`[ImageUpload] Picked photo has invalid base64 (${picked.base64?.length || 0} chars)`);
    return { success: false, localUri: picked.uri, error: 'Photo could not be processed. Please try a different image.' };
  }
  
  const result = await uploadNeedPhoto(userId, picked.base64, picked.mimeType, needTitle, onProgress);
  return { ...result, localUri: picked.uri };
}

export async function pickAndUploadAvatar(
  userId: string
): Promise<{ success: boolean; avatarUrl?: string; localUri?: string; error?: string }> {
  const picked = await pickImage();
  if (!picked) return { success: false, error: 'cancelled' };
  
  if (!picked.base64 || picked.base64.length < MIN_VALID_BASE64) {
    return { success: false, localUri: picked.uri, error: 'Photo could not be processed. Please try a different image.' };
  }
  
  const result = await uploadAvatar(userId, picked.base64, picked.mimeType);
  return { ...result, localUri: picked.uri };
}

// Legacy export for compatibility
export function processNeedImage(file: File): Promise<ImagePickResult> {
  return compressImage(file, 1200, 0.8);
}
