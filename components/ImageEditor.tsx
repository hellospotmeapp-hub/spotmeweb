import React, { useState, useRef, useCallback, memo } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, Image, Animated,
  Dimensions, Platform, PanResponder, ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, BorderRadius, FontSize, Spacing, Shadow } from '@/app/lib/theme';
import { hapticLight, hapticMedium, hapticSuccess } from '@/app/lib/haptics';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CANVAS_SIZE = Math.min(SCREEN_WIDTH - 48, 360);

interface ImageEditorProps {
  visible: boolean;
  imageUri: string;
  onSave: (editedUri: string, editedBase64: string) => void;
  onCancel: () => void;
}

function ImageEditorInner({ visible, imageUri, onSave, onCancel }: ImageEditorProps) {
  const [rotation, setRotation] = useState(0);
  const [scale, setScale] = useState(1);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);

  const panX = useRef(new Animated.Value(0)).current;
  const panY = useRef(new Animated.Value(0)).current;
  const lastOffset = useRef({ x: 0, y: 0 });

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        panX.setOffset(lastOffset.current.x);
        panY.setOffset(lastOffset.current.y);
        panX.setValue(0);
        panY.setValue(0);
      },
      onPanResponderMove: Animated.event(
        [null, { dx: panX, dy: panY }],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: (_, gesture) => {
        lastOffset.current = {
          x: lastOffset.current.x + gesture.dx,
          y: lastOffset.current.y + gesture.dy,
        };
        setOffsetX(lastOffset.current.x);
        setOffsetY(lastOffset.current.y);
        panX.flattenOffset();
        panY.flattenOffset();
      },
    })
  ).current;

  const handleRotate = useCallback((degrees: number) => {
    hapticLight();
    setRotation(prev => (prev + degrees) % 360);
  }, []);

  const handleZoomIn = useCallback(() => {
    hapticLight();
    setScale(prev => Math.min(prev + 0.25, 3));
  }, []);

  const handleZoomOut = useCallback(() => {
    hapticLight();
    setScale(prev => Math.max(prev - 0.25, 0.5));
  }, []);

  const handleReset = useCallback(() => {
    hapticMedium();
    setRotation(0);
    setScale(1);
    setOffsetX(0);
    setOffsetY(0);
    lastOffset.current = { x: 0, y: 0 };
    panX.setValue(0);
    panY.setValue(0);
  }, []);

  const handleSave = useCallback(async () => {
    setIsProcessing(true);
    hapticMedium();

    if (Platform.OS === 'web') {
      try {
        // Use canvas to apply transformations on web
        const img = new window.Image();
        img.crossOrigin = 'anonymous';
        
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error('Failed to load image'));
          img.src = imageUri;
        });

        const maxDim = 1200;
        let w = img.naturalWidth || img.width;
        let h = img.naturalHeight || img.height;

        // Apply rotation dimensions
        const isRotated90 = rotation === 90 || rotation === 270;
        if (isRotated90) [w, h] = [h, w];

        // Scale down to max 1200px
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas context failed');

        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, w, h);

        // Apply transformations
        ctx.save();
        ctx.translate(w / 2, h / 2);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.scale(scale, scale);
        ctx.translate(-w / 2 + offsetX * (1 / scale), -h / 2 + offsetY * (1 / scale));

        if (isRotated90) {
          ctx.drawImage(img, 0, 0, h, w);
        } else {
          ctx.drawImage(img, 0, 0, w, h);
        }
        ctx.restore();

        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        const base64 = dataUrl.split(',')[1] || '';

        hapticSuccess();
        onSave(dataUrl, base64);
      } catch (err) {
        console.error('[ImageEditor] Web canvas error:', err);
        // Fallback: return original
        const base64 = imageUri.includes(',') ? imageUri.split(',')[1] || '' : '';
        onSave(imageUri, base64);
      }
    } else {
      // Native: use expo-image-manipulator
      try {
        const ImageManipulator = await import('expo-image-manipulator');
        const actions: any[] = [];

        if (rotation !== 0) {
          actions.push({ rotate: rotation });
        }
        if (scale !== 1) {
          // Get original dimensions and apply scale
          actions.push({ resize: { width: Math.round(1200 * scale) } });
        } else {
          actions.push({ resize: { width: 1200 } });
        }

        const result = await ImageManipulator.manipulateAsync(
          imageUri,
          actions,
          { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG, base64: true }
        );

        hapticSuccess();
        onSave(result.uri, result.base64 || '');
      } catch (err) {
        console.error('[ImageEditor] Native manipulator error:', err);
        // Fallback: return original
        onSave(imageUri, '');
      }
    }

    setIsProcessing(false);
  }, [imageUri, rotation, scale, offsetX, offsetY, onSave]);

  const handleClose = useCallback(() => {
    handleReset();
    onCancel();
  }, [onCancel, handleReset]);

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={handleClose} style={styles.headerBtn} activeOpacity={0.7}>
              <MaterialIcons name="close" size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Edit Photo</Text>
            <TouchableOpacity
              onPress={handleSave}
              style={[styles.headerBtn, styles.saveBtn]}
              activeOpacity={0.7}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <ActivityIndicator size="small" color={Colors.white} />
              ) : (
                <Text style={styles.saveBtnText}>Done</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Canvas area */}
          <View style={styles.canvasContainer}>
            <View style={styles.cropFrame}>
              <Animated.View
                {...panResponder.panHandlers}
                style={[
                  styles.imageWrapper,
                  {
                    transform: [
                      { translateX: panX },
                      { translateY: panY },
                      { rotate: `${rotation}deg` },
                      { scale },
                    ],
                  },
                ]}
              >
                <Image
                  source={{ uri: imageUri }}
                  style={styles.editImage}
                  resizeMode="contain"
                />
              </Animated.View>
            </View>

            {/* Crop grid overlay */}
            <View style={styles.gridOverlay} pointerEvents="none">
              <View style={[styles.gridLine, styles.gridLineH, { top: '33.33%' }]} />
              <View style={[styles.gridLine, styles.gridLineH, { top: '66.66%' }]} />
              <View style={[styles.gridLine, styles.gridLineV, { left: '33.33%' }]} />
              <View style={[styles.gridLine, styles.gridLineV, { left: '66.66%' }]} />
            </View>
          </View>

          {/* Rotation info */}
          <Text style={styles.rotationInfo}>{rotation}°</Text>

          {/* Controls */}
          <View style={styles.controls}>
            <View style={styles.controlRow}>
              <TouchableOpacity style={styles.controlBtn} onPress={() => handleRotate(-90)} activeOpacity={0.7}>
                <MaterialIcons name="rotate-left" size={24} color={Colors.text} />
                <Text style={styles.controlLabel}>-90°</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.controlBtn} onPress={() => handleRotate(90)} activeOpacity={0.7}>
                <MaterialIcons name="rotate-right" size={24} color={Colors.text} />
                <Text style={styles.controlLabel}>+90°</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.controlBtn} onPress={handleZoomOut} activeOpacity={0.7}>
                <MaterialIcons name="zoom-out" size={24} color={Colors.text} />
                <Text style={styles.controlLabel}>Zoom -</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.controlBtn} onPress={handleZoomIn} activeOpacity={0.7}>
                <MaterialIcons name="zoom-in" size={24} color={Colors.text} />
                <Text style={styles.controlLabel}>Zoom +</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.controlBtn} onPress={handleReset} activeOpacity={0.7}>
                <MaterialIcons name="replay" size={24} color={Colors.textSecondary} />
                <Text style={styles.controlLabel}>Reset</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Tip */}
          <Text style={styles.tipText}>
            Drag to reposition. Tap rotate/zoom to adjust.
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const ImageEditor = memo(ImageEditorInner);
export default ImageEditor;

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
    paddingBottom: Platform.OS === 'web' ? 40 : 34,
    maxHeight: '92%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: FontSize.lg,
    fontWeight: '800',
    color: Colors.text,
  },
  saveBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.lg,
    width: 'auto' as any,
    borderRadius: BorderRadius.lg,
  },
  saveBtnText: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.white,
  },
  canvasContainer: {
    width: CANVAS_SIZE,
    height: CANVAS_SIZE,
    alignSelf: 'center',
    marginVertical: Spacing.lg,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
    position: 'relative',
  },
  cropFrame: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  imageWrapper: {
    width: CANVAS_SIZE,
    height: CANVAS_SIZE,
  },
  editImage: {
    width: '100%',
    height: '100%',
  },
  gridOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  gridLine: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  gridLineH: {
    left: 0,
    right: 0,
    height: 1,
  },
  gridLineV: {
    top: 0,
    bottom: 0,
    width: 1,
  },
  rotationInfo: {
    textAlign: 'center',
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.textLight,
    marginBottom: Spacing.sm,
  },
  controls: {
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.md,
  },
  controlRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  controlBtn: {
    alignItems: 'center',
    gap: 4,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    minWidth: 56,
    minHeight: 56,
    justifyContent: 'center',
  },
  controlLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  tipText: {
    textAlign: 'center',
    fontSize: FontSize.xs,
    color: Colors.textLight,
    paddingHorizontal: Spacing.xl,
  },
});
