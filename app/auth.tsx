import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, BorderRadius, FontSize, Spacing, Shadow } from '@/app/lib/theme';
import { useApp } from '@/app/lib/store';

export default function AuthScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { login, signup } = useApp();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [bio, setBio] = useState('');
  const [city, setCity] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (mode === 'signup' && step === 1) {
      if (!name.trim()) newErrors.name = 'Name is required';
    }
    if (!email.trim()) newErrors.email = 'Email is required';
    else if (!email.includes('@') || !email.includes('.')) newErrors.email = 'Enter a valid email';
    if (!password.trim()) newErrors.password = 'Password is required';
    else if (password.length < 6) newErrors.password = 'At least 6 characters';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setServerError('');
    setIsSubmitting(true);

    try {
      if (mode === 'signup' && step === 1) {
        setStep(2);
        setIsSubmitting(false);
        return;
      }

      let result;
      if (mode === 'signup') {
        result = await signup(name.trim(), email.trim().toLowerCase(), password, bio.trim(), city.trim());
      } else {
        result = await login(name.trim() || '', email.trim().toLowerCase(), password);
      }

      if (result.success) {
        router.back();
      } else {
        setServerError(result.error || 'Something went wrong. Please try again.');
      }
    } catch (err: any) {
      setServerError(err.message || 'Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSocialLogin = async (provider: 'google' | 'apple') => {
    setServerError('');
    setIsSubmitting(true);
    try {
      // For social login, create a profile with the provider name
      const socialName = provider === 'google' ? 'Google User' : 'Apple User';
      const socialEmail = `${provider}_${Date.now()}@spotme.app`;
      const result = await signup(socialName, socialEmail, `${provider}_auth_${Date.now()}`);
      if (result.success) {
        router.back();
      } else {
        setServerError(result.error || `${provider} login failed`);
      }
    } catch (err: any) {
      setServerError(err.message || 'Social login failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkipProfile = async () => {
    setIsSubmitting(true);
    try {
      const result = await signup(name.trim() || 'SpotMe User', email.trim().toLowerCase(), password, '', '');
      if (result.success) {
        router.back();
      } else {
        setServerError(result.error || 'Something went wrong');
      }
    } catch (err: any) {
      setServerError(err.message || 'Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  };

  const topPadding = Platform.OS === 'web' ? 16 : insets.top;
  const Wrapper = Platform.OS === 'web' ? View : KeyboardAvoidingView;
  const wrapperProps = Platform.OS === 'web' ? {} : { behavior: 'padding' as const };

  return (
    <Wrapper
      style={[styles.container, { paddingTop: topPadding }]}
      {...wrapperProps}
    >
      {/* Close button */}
      <TouchableOpacity style={[styles.closeBtn, Platform.OS === 'web' && { top: 16 }]} onPress={() => router.back()}>
        <MaterialIcons name="close" size={24} color={Colors.textSecondary} />
      </TouchableOpacity>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Logo */}
        <View style={styles.logoSection}>
          <Text style={styles.logo}>SpotMe</Text>
          <Text style={styles.tagline}>No tragedy. Just life.</Text>
        </View>

        {/* Server error */}
        {serverError ? (
          <View style={styles.errorBanner}>
            <MaterialIcons name="error-outline" size={18} color={Colors.error} />
            <Text style={styles.errorBannerText}>{serverError}</Text>
          </View>
        ) : null}

        {mode === 'signup' && step === 2 ? (
          <View style={styles.formSection}>
            <Text style={styles.formTitle}>Set up your profile</Text>
            <Text style={styles.formSubtitle}>Help the community get to know you</Text>

            <View style={styles.avatarPicker}>
              <View style={styles.avatarPlaceholder}>
                <MaterialIcons name="person" size={40} color={Colors.textLight} />
              </View>
              <TouchableOpacity style={styles.avatarEditBtn}>
                <MaterialIcons name="camera-alt" size={16} color={Colors.white} />
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Short bio</Text>
              <TextInput
                style={[styles.input, styles.textArea, Platform.OS === 'web' && { outlineStyle: 'none' as any }]}
                value={bio}
                onChangeText={setBio}
                placeholder="Tell people a bit about yourself..."
                placeholderTextColor={Colors.textLight}
                multiline
                maxLength={120}
              />
              <Text style={styles.charCount}>{bio.length}/120</Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>City (optional)</Text>
              <TextInput
                style={[styles.input, Platform.OS === 'web' && { outlineStyle: 'none' as any }]}
                value={city}
                onChangeText={setCity}
                placeholder="e.g., Austin, TX"
                placeholderTextColor={Colors.textLight}
              />
            </View>

            <TouchableOpacity
              style={[styles.primaryBtn, isSubmitting && styles.primaryBtnDisabled]}
              onPress={handleSubmit}
              activeOpacity={0.8}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color={Colors.white} size="small" />
              ) : (
                <Text style={styles.primaryBtnText}>Complete Setup</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.skipBtn} onPress={handleSkipProfile} disabled={isSubmitting}>
              <Text style={styles.skipBtnText}>Skip for now</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.formSection}>
            <Text style={styles.formTitle}>
              {mode === 'signin' ? 'Welcome back' : 'Create your account'}
            </Text>
            <Text style={styles.formSubtitle}>
              {mode === 'signin'
                ? 'Sign in to continue helping your community'
                : 'Join thousands of people helping each other'}
            </Text>

            <TouchableOpacity
              style={[styles.socialBtn, isSubmitting && { opacity: 0.6 }]}
              activeOpacity={0.7}
              onPress={() => handleSocialLogin('google')}
              disabled={isSubmitting}
            >
              <MaterialIcons name="g-translate" size={20} color={Colors.text} />
              <Text style={styles.socialBtnText}>Continue with Google</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.socialBtn, styles.appleSocialBtn, isSubmitting && { opacity: 0.6 }]}
              activeOpacity={0.7}
              onPress={() => handleSocialLogin('apple')}
              disabled={isSubmitting}
            >
              <MaterialIcons name="apple" size={22} color={Colors.white} />
              <Text style={[styles.socialBtnText, { color: Colors.white }]}>Continue with Apple</Text>
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            {mode === 'signup' && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Full name</Text>
                <TextInput
                  style={[styles.input, errors.name && styles.inputError, Platform.OS === 'web' && { outlineStyle: 'none' as any }]}
                  value={name}
                  onChangeText={(t) => { setName(t); setErrors(e => ({...e, name: ''})); setServerError(''); }}
                  placeholder="Your name"
                  placeholderTextColor={Colors.textLight}
                  autoCapitalize="words"
                />
                {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Email</Text>
              <TextInput
                style={[styles.input, errors.email && styles.inputError, Platform.OS === 'web' && { outlineStyle: 'none' as any }]}
                value={email}
                onChangeText={(t) => { setEmail(t); setErrors(e => ({...e, email: ''})); setServerError(''); }}
                placeholder="you@example.com"
                placeholderTextColor={Colors.textLight}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Password</Text>
              <View style={styles.passwordRow}>
                <TextInput
                  style={[styles.input, styles.passwordInput, errors.password && styles.inputError, Platform.OS === 'web' && { outlineStyle: 'none' as any }]}
                  value={password}
                  onChangeText={(t) => { setPassword(t); setErrors(e => ({...e, password: ''})); setServerError(''); }}
                  placeholder="At least 6 characters"
                  placeholderTextColor={Colors.textLight}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity
                  style={styles.eyeBtn}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <MaterialIcons
                    name={showPassword ? 'visibility' : 'visibility-off'}
                    size={20}
                    color={Colors.textLight}
                  />
                </TouchableOpacity>
              </View>
              {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
            </View>

            <TouchableOpacity
              style={[styles.primaryBtn, isSubmitting && styles.primaryBtnDisabled]}
              onPress={handleSubmit}
              activeOpacity={0.8}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color={Colors.white} size="small" />
              ) : (
                <>
                  <Text style={styles.primaryBtnText}>
                    {mode === 'signin' ? 'Sign In' : 'Continue'}
                  </Text>
                  <MaterialIcons name="arrow-forward" size={20} color={Colors.white} />
                </>
              )}
            </TouchableOpacity>

            {mode === 'signin' && (
              <TouchableOpacity style={styles.forgotBtn}>
                <Text style={styles.forgotText}>Forgot password?</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Toggle mode */}
        <View style={styles.toggleSection}>
          <Text style={styles.toggleText}>
            {mode === 'signin' ? "Don't have an account?" : 'Already have an account?'}
          </Text>
          <TouchableOpacity onPress={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setStep(1); setErrors({}); setServerError(''); }}>
            <Text style={styles.toggleLink}>
              {mode === 'signin' ? 'Sign Up' : 'Sign In'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Security badge */}
        <View style={styles.securityBadge}>
          <MaterialIcons name="lock" size={14} color={Colors.textLight} />
          <Text style={styles.securityText}>
            Secured with end-to-end encryption
          </Text>
        </View>

        <Text style={styles.termsText}>
          By continuing, you agree to SpotMe's Terms of Service and Privacy Policy.
        </Text>
      </ScrollView>
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  closeBtn: {
    position: 'absolute',
    top: 60,
    right: Spacing.xl,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: Spacing.xxl,
    paddingBottom: 40,
  },
  logoSection: {
    alignItems: 'center',
    paddingTop: Spacing.huge,
    marginBottom: Spacing.xxxl,
  },
  logo: {
    fontSize: 42,
    fontWeight: '900',
    color: Colors.primary,
    letterSpacing: -1,
  },
  tagline: {
    fontSize: FontSize.md,
    color: Colors.textLight,
    fontStyle: 'italic',
    marginTop: Spacing.xs,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: '#FFF0F0',
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: '#FFD4D4',
  },
  errorBannerText: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.error,
    fontWeight: '600',
  },
  formSection: {
    gap: Spacing.lg,
  },
  formTitle: {
    fontSize: FontSize.xxl,
    fontWeight: '900',
    color: Colors.text,
    textAlign: 'center',
  },
  formSubtitle: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  socialBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  appleSocialBtn: {
    backgroundColor: Colors.text,
    borderColor: Colors.text,
  },
  socialBtnText: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginVertical: Spacing.sm,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerText: {
    fontSize: FontSize.sm,
    color: Colors.textLight,
  },
  inputGroup: {
    gap: Spacing.xs,
  },
  inputLabel: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
    marginLeft: Spacing.xs,
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
  inputError: {
    borderColor: Colors.error,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: FontSize.xs,
    color: Colors.textLight,
    textAlign: 'right',
  },
  passwordRow: {
    position: 'relative',
  },
  passwordInput: {
    paddingRight: 50,
  },
  eyeBtn: {
    position: 'absolute',
    right: Spacing.lg,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  errorText: {
    fontSize: FontSize.xs,
    color: Colors.error,
    marginLeft: Spacing.xs,
  },
  primaryBtn: {
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
  primaryBtnDisabled: {
    opacity: 0.7,
  },
  primaryBtnText: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.white,
  },
  forgotBtn: {
    alignSelf: 'center',
    paddingVertical: Spacing.sm,
  },
  forgotText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.primary,
  },
  avatarPicker: {
    alignSelf: 'center',
    position: 'relative',
    marginBottom: Spacing.md,
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.border,
    borderStyle: 'dashed',
  },
  avatarEditBtn: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.surface,
  },
  skipBtn: {
    alignSelf: 'center',
    paddingVertical: Spacing.md,
  },
  skipBtnText: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  toggleSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.xxxl,
  },
  toggleText: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
  },
  toggleLink: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.primary,
  },
  securityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.xl,
  },
  securityText: {
    fontSize: FontSize.xs,
    color: Colors.textLight,
  },
  termsText: {
    fontSize: FontSize.xs,
    color: Colors.textLight,
    textAlign: 'center',
    marginTop: Spacing.md,
    lineHeight: 18,
  },
});
