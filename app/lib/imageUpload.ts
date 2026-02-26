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
// UNIVERSAL PICKER (avatar - small, square-ish)
// ============================================================
export function pickImage(): Promise<ImagePickResult | null> {
  if (Platform.OS === 'web') return pickImageWeb();
  return pickImageNative({ maxSize: 400, quality: 0.7, allowsEditing: true, aspect: [1, 1] });
}

// ============================================================
// NEED PHOTO PICKER (larger, no crop)
// ============================================================
export function pickNeedPhoto(): Promise<ImagePickResult | null> {
  if (Platform.OS === 'web') return pickNeedPhotoWeb();
  return pickImageNative({ maxSize: 800, quality: 0.65, allowsEditing: false });
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
    // Dynamic import so web builds don't break if the native module isn't available
    const ImagePicker = await import('expo-image-picker');

    // Request permissions
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      console.warn('[ImageUpload] Media library permission denied');
      // Try to show an alert
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
      // Try to read the file manually as a fallback
      return null;
    }

    // If the base64 is too large, we need to re-compress
    if (base64.length > MAX_BASE64_SIZE) {
      console.warn(`[ImageUpload] Native image too large (${(base64.length / 1024).toFixed(0)}KB), needs compression`);
      // On native, we can try picking again with lower quality
      // For now, return what we have and let uploadNeedPhoto handle re-compression
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
      quality: 0.65,
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
        resolve(await compressImage(file, 800, 0.65));
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
// WEB IMAGE COMPRESSION
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
    { maxDim: Math.min(maxDim, 600), quality: 0.5 },
    { maxDim: 400, quality: 0.4 },
    { maxDim: 300, quality: 0.3 },
    { maxDim: 250, quality: 0.25 },
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
// UPLOAD FUNCTIONS
// ============================================================
export async function uploadNeedPhoto(
  userId: string, imageBase64: string, mimeType: string = 'image/jpeg', needTitle?: string
): Promise<{ success: boolean; photoUrl?: string; error?: string }> {
  try {
    if (!imageBase64 || imageBase64.length < MIN_VALID_BASE64) {
      console.error(`[ImageUpload] Base64 too short (${imageBase64?.length || 0} chars)`);
      return { success: false, error: 'Photo could not be processed. Please try a different image.' };
    }

    // Re-compress if too large (web only - native images from expo-image-picker are already compressed)
    if (imageBase64.length > 1_200_000 && Platform.OS === 'web') {
      console.warn(`[ImageUpload] Base64 too large (${(imageBase64.length/1024).toFixed(0)}KB), re-compressing...`);
      try {
        const recompressed = await recompressBase64(imageBase64, 600, 0.4);
        if (recompressed && recompressed.base64.length >= MIN_VALID_BASE64) {
          imageBase64 = recompressed.base64;
          mimeType = 'image/jpeg';
          console.log(`[ImageUpload] Re-compressed to ${(imageBase64.length/1024).toFixed(0)}KB`);
        }
      } catch (e) {
        console.warn('[ImageUpload] Re-compression failed:', e);
      }
    }

    if (imageBase64.length > 1_500_000) {
      return { success: false, error: 'Image is too large even after compression. Please try a smaller photo.' };
    }

    if (imageBase64.length < MIN_VALID_BASE64) {
      return { success: false, error: 'Photo processing failed. Please try selecting a different image.' };
    }

    console.log(`[ImageUpload] Uploading ${(imageBase64.length/1024).toFixed(0)}KB base64 to server`);

    const { data, error } = await supabase.functions.invoke('upload-need-photo', {
      body: { userId, imageBase64, mimeType, needTitle },
    });
    if (error) return { success: false, error: error.message || 'Upload failed' };
    if (data?.success && data.photoUrl) return { success: true, photoUrl: data.photoUrl };
    return { success: false, error: data?.error || 'Upload failed' };
  } catch (err: any) {
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
        }
      } catch {}
    }

    if (imageBase64.length < MIN_VALID_BASE64) {
      return { success: false, error: 'Avatar processing failed. Please try a different image.' };
    }

    const { data, error } = await supabase.functions.invoke('upload-avatar', {
      body: { userId, imageBase64, mimeType },
    });
    if (error) return { success: false, error: error.message || 'Upload failed' };
    if (data?.success && data.avatarUrl) return { success: true, avatarUrl: data.avatarUrl };
    return { success: false, error: data?.error || 'Upload failed' };
  } catch (err: any) {
    return { success: false, error: err.message || 'Upload failed' };
  }
}

// ============================================================
// CONVENIENCE: PICK + UPLOAD COMBOS
// ============================================================
export async function pickAndUploadNeedPhoto(
  userId: string, needTitle?: string
): Promise<{ success: boolean; photoUrl?: string; localUri?: string; error?: string }> {
  const picked = await pickNeedPhoto();
  if (!picked) return { success: false, error: 'cancelled' };
  
  if (!picked.base64 || picked.base64.length < MIN_VALID_BASE64) {
    console.error(`[ImageUpload] Picked photo has invalid base64 (${picked.base64?.length || 0} chars)`);
    return { success: false, localUri: picked.uri, error: 'Photo could not be processed. Please try a different image.' };
  }
  
  const result = await uploadNeedPhoto(userId, picked.base64, picked.mimeType, needTitle);
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
  return compressImage(file, 800, 0.7);
}
