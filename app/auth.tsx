import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, Image } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, BorderRadius, FontSize, Spacing, Shadow } from '@/app/lib/theme';
import { useApp } from '@/app/lib/store';
import { pickImage, uploadAvatar } from '@/app/lib/imageUpload';

export default function AuthScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { login, signup, updateProfile, resetPassword } = useApp();
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>('signin');
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

  // Forgot password state
  const [forgotEmail, setForgotEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [forgotStep, setForgotStep] = useState<'email' | 'reset' | 'done'>('email');
  const [forgotError, setForgotError] = useState('');

  // Avatar state
  const [avatarLocalUri, setAvatarLocalUri] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarUploadedUrl, setAvatarUploadedUrl] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState('');


  // Helper: navigate back to home — on web always use replace to avoid
  // stale /auth entries lingering in the navigation stack.  On native
  // use router.back() so the modal dismiss animation plays.
  const goHome = useCallback(() => {
    if (Platform.OS === 'web') {
      try { router.replace('/(tabs)'); } catch {
        try { window.location.href = '/'; } catch {}
      }
    } else {
      try { router.back(); } catch {
        try { router.replace('/(tabs)'); } catch {}
      }
    }
  }, [router]);

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

  const handlePickAvatar = async () => {
    setAvatarError('');
    try {
      const picked = await pickImage();
      if (!picked) return; // cancelled

      // Show local preview immediately
      setAvatarLocalUri(picked.uri);

      // Upload in background (we'll use a temp ID, then update after signup)
      setAvatarUploading(true);
      const tempId = `signup_${Date.now()}`;
      const result = await uploadAvatar(tempId, picked.base64, picked.mimeType);

      if (result.success && result.avatarUrl) {
        setAvatarUploadedUrl(result.avatarUrl);
      } else {
        // Upload failed but we still have local preview
        // We'll try again after signup with the real user ID
        console.log('Avatar upload deferred:', result.error);
        setAvatarError('Photo saved locally. Will upload when you complete setup.');
      }
    } catch (err: any) {
      setAvatarError('Could not select photo. Please try again.');
      console.error('Pick avatar error:', err);
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setServerError('');
    setIsSubmitting(true);
    console.log('[SpotMe Auth] handleSubmit called, mode:', mode, 'step:', step);

    try {
      if (mode === 'signup' && step === 1) {
        setStep(2);
        setIsSubmitting(false);
        return;
      }

      let result: { success: boolean; error?: string } | undefined;
      
      try {
        if (mode === 'signup') {
          console.log('[SpotMe Auth] Calling signup with:', { name: name.trim(), email: email.trim().toLowerCase() });
          result = await signup(name.trim(), email.trim().toLowerCase(), password, bio.trim(), city.trim());
        } else {
          console.log('[SpotMe Auth] Calling login with:', { email: email.trim().toLowerCase() });
          result = await login(name.trim() || '', email.trim().toLowerCase(), password);
        }
      } catch (callErr: any) {
        console.error('[SpotMe Auth] Call threw error:', callErr);
        result = { success: false, error: callErr?.message || 'An unexpected error occurred' };
      }

      console.log('[SpotMe Auth] Result:', JSON.stringify(result));

      if (result && result.success) {
        // If we have an uploaded avatar URL, update the profile
        if (mode === 'signup' && avatarUploadedUrl) {
          try {
            updateProfile({ avatar: avatarUploadedUrl });
          } catch (e) {
            console.log('[SpotMe Auth] Avatar update failed (non-critical):', e);
          }
        }

        // Brief delay to show success before navigating
        setTimeout(() => goHome(), 200);

      } else {
        const errorMsg = result?.error || 'Something went wrong. Please check your connection and try again.';
        console.log('[SpotMe Auth] Error:', errorMsg);
        setServerError(errorMsg);
      }
    } catch (err: any) {
      const errorMsg = err?.message || err?.toString?.() || 'Something went wrong';
      console.error('[SpotMe Auth] Unexpected error:', errorMsg, err);
      setServerError(`Error: ${errorMsg}. If this keeps happening, try closing Safari and reopening.`);
    } finally {
      setIsSubmitting(false);
    }
  };



  const handleSocialLogin = async (provider: 'google' | 'apple') => {
    setServerError('');
    setIsSubmitting(true);
    console.log('[SpotMe Auth] Social login:', provider);
    try {
      // For social login, create a profile with the provider name
      const socialName = provider === 'google' ? 'Google User' : 'Apple User';
      const socialEmail = `${provider}_${Date.now()}@spotme.app`;
      const result = await signup(socialName, socialEmail, `${provider}_auth_${Date.now()}`);
      if (result && result.success) {
        goHome();

      } else {
        setServerError(result?.error || `${provider} login failed. Please try email signup instead.`);
      }
    } catch (err: any) {
      const errorMsg = err?.message || 'Social login failed';
      console.error('[SpotMe Auth] Social login error:', errorMsg, err);
      setServerError(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkipProfile = async () => {
    setIsSubmitting(true);
    console.log('[SpotMe Auth] Skip profile, signing up directly');
    try {
      const result = await signup(name.trim() || 'SpotMe User', email.trim().toLowerCase(), password, '', '');
      if (result && result.success) {
        // Still apply avatar if uploaded
        if (avatarUploadedUrl) {
          try {
            updateProfile({ avatar: avatarUploadedUrl });
          } catch {}
        }
        goHome();

      } else {
        setServerError(result?.error || 'Something went wrong. Please try again.');
      }
    } catch (err: any) {
      const errorMsg = err?.message || 'Something went wrong';
      console.error('[SpotMe Auth] Skip profile error:', errorMsg, err);
      setServerError(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = async () => {
    setForgotError('');
    setIsSubmitting(true);
    try {
      if (forgotStep === 'email') {
        // Validate email
        if (!forgotEmail.trim() || !forgotEmail.includes('@')) {
          setForgotError('Please enter a valid email address');
          setIsSubmitting(false);
          return;
        }
        // Move to reset step
        setForgotStep('reset');
      } else if (forgotStep === 'reset') {
        // Validate new password
        if (!newPassword.trim() || newPassword.length < 6) {
          setForgotError('Password must be at least 6 characters');
          setIsSubmitting(false);
          return;
        }
        const result = await resetPassword(forgotEmail.trim().toLowerCase(), newPassword);
        if (result.success) {
          setForgotStep('done');
        } else {
          setForgotError(result.error || 'Could not reset password. Please try again.');
        }
      }
    } catch (err: any) {
      setForgotError(err?.message || 'Something went wrong');
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
      <TouchableOpacity style={[styles.closeBtn, Platform.OS === 'web' && { top: 16 }]} onPress={goHome}>
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

        {/* ===== FORGOT PASSWORD MODE ===== */}
        {mode === 'forgot' ? (
          <View style={styles.formSection}>
            {forgotStep === 'done' ? (
              <>
                <View style={styles.forgotSuccessIcon}>
                  <MaterialIcons name="check-circle" size={64} color={Colors.success} />
                </View>
                <Text style={styles.formTitle}>Password Reset!</Text>
                <Text style={styles.formSubtitle}>
                  Your password has been updated successfully. You can now sign in with your new password.
                </Text>
                <TouchableOpacity
                  style={styles.primaryBtn}
                  onPress={() => {
                    setMode('signin');
                    setForgotStep('email');
                    setForgotEmail('');
                    setNewPassword('');
                    setForgotError('');
                    setEmail(forgotEmail);
                    setPassword('');
                  }}
                  activeOpacity={0.8}
                >
                  <MaterialIcons name="login" size={20} color={Colors.white} />
                  <Text style={styles.primaryBtnText}>Sign In Now</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={styles.forgotIconWrap}>
                  <MaterialIcons
                    name={forgotStep === 'email' ? 'lock-outline' : 'vpn-key'}
                    size={48}
                    color={Colors.primary}
                  />
                </View>
                <Text style={styles.formTitle}>
                  {forgotStep === 'email' ? 'Forgot Password?' : 'Create New Password'}
                </Text>
                <Text style={styles.formSubtitle}>
                  {forgotStep === 'email'
                    ? 'Enter the email address associated with your account and we\'ll help you reset your password.'
                    : `Enter a new password for ${forgotEmail}`}
                </Text>

                {forgotError ? (
                  <View style={styles.errorBanner}>
                    <MaterialIcons name="error-outline" size={18} color={Colors.error} />
                    <Text style={styles.errorBannerText}>{forgotError}</Text>
                  </View>
                ) : null}

                {forgotStep === 'email' ? (
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Email address</Text>
                    <TextInput
                      style={[styles.input, Platform.OS === 'web' && { outlineStyle: 'none' as any }]}
                      value={forgotEmail}
                      onChangeText={(t) => { setForgotEmail(t); setForgotError(''); }}
                      placeholder="you@example.com"
                      placeholderTextColor={Colors.textLight}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoFocus
                    />
                  </View>
                ) : (
                  <>
                    <View style={styles.forgotEmailBadge}>
                      <MaterialIcons name="email" size={16} color={Colors.primary} />
                      <Text style={styles.forgotEmailBadgeText}>{forgotEmail}</Text>
                    </View>
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>New password</Text>
                      <View style={styles.passwordRow}>
                        <TextInput
                          style={[styles.input, styles.passwordInput, Platform.OS === 'web' && { outlineStyle: 'none' as any }]}
                          value={newPassword}
                          onChangeText={(t) => { setNewPassword(t); setForgotError(''); }}
                          placeholder="At least 6 characters"
                          placeholderTextColor={Colors.textLight}
                          secureTextEntry={!showPassword}
                          autoFocus
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
                    </View>
                    {newPassword.length > 0 && (
                      <View style={styles.passwordStrength}>
                        <View style={[styles.strengthBar, { backgroundColor: newPassword.length >= 8 ? Colors.success : newPassword.length >= 6 ? Colors.accent : Colors.error }]} />
                        <Text style={[styles.strengthText, { color: newPassword.length >= 8 ? Colors.success : newPassword.length >= 6 ? Colors.accent : Colors.error }]}>
                          {newPassword.length >= 8 ? 'Strong password' : newPassword.length >= 6 ? 'Good password' : 'Too short'}
                        </Text>
                      </View>
                    )}
                  </>
                )}

                <TouchableOpacity
                  style={[styles.primaryBtn, isSubmitting && styles.primaryBtnDisabled]}
                  onPress={handleForgotPassword}
                  activeOpacity={0.8}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color={Colors.white} size="small" />
                  ) : (
                    <>
                      <Text style={styles.primaryBtnText}>
                        {forgotStep === 'email' ? 'Continue' : 'Reset Password'}
                      </Text>
                      <MaterialIcons name="arrow-forward" size={20} color={Colors.white} />
                    </>
                  )}
                </TouchableOpacity>

                {forgotStep === 'reset' && (
                  <TouchableOpacity
                    style={styles.forgotBackBtn}
                    onPress={() => { setForgotStep('email'); setForgotError(''); }}
                  >
                    <MaterialIcons name="arrow-back" size={16} color={Colors.textSecondary} />
                    <Text style={styles.forgotBackText}>Change email</Text>
                  </TouchableOpacity>
                )}
              </>
            )}

            {/* Back to sign in */}
            {forgotStep !== 'done' && (
              <TouchableOpacity
                style={styles.forgotBackToSignIn}
                onPress={() => {
                  setMode('signin');
                  setForgotStep('email');
                  setForgotEmail('');
                  setNewPassword('');
                  setForgotError('');
                }}
              >
                <MaterialIcons name="arrow-back" size={16} color={Colors.primary} />
                <Text style={styles.forgotBackToSignInText}>Back to Sign In</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : mode === 'signup' && step === 2 ? (
          <View style={styles.formSection}>
            <Text style={styles.formTitle}>Set up your profile</Text>
            <Text style={styles.formSubtitle}>Help the community get to know you</Text>

            {/* Avatar Picker */}
            <TouchableOpacity
              style={styles.avatarPicker}
              onPress={handlePickAvatar}
              activeOpacity={0.7}
              disabled={avatarUploading}
            >
              {avatarLocalUri ? (
                <Image source={{ uri: avatarLocalUri }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <MaterialIcons name="person" size={40} color={Colors.textLight} />
                </View>
              )}
              <View style={[styles.avatarEditBtn, avatarUploading && styles.avatarEditBtnUploading]}>
                {avatarUploading ? (
                  <ActivityIndicator size={12} color={Colors.white} />
                ) : (
                  <MaterialIcons name="camera-alt" size={16} color={Colors.white} />
                )}
              </View>
            </TouchableOpacity>

            {avatarUploading && (
              <Text style={styles.avatarStatusText}>Uploading photo...</Text>
            )}
            {avatarUploadedUrl && !avatarUploading && (
              <Text style={[styles.avatarStatusText, { color: Colors.success }]}>Photo uploaded!</Text>
            )}
            {avatarError && !avatarUploading && (
              <Text style={[styles.avatarStatusText, { color: Colors.accent }]}>{avatarError}</Text>
            )}
            {!avatarLocalUri && !avatarUploading && !avatarError && (
              <Text style={styles.avatarHintText}>Tap to add a profile photo</Text>
            )}

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
              <TouchableOpacity
                style={styles.forgotBtn}
                onPress={() => {
                  setMode('forgot');
                  setForgotStep('email');
                  setForgotEmail(email); // Pre-fill with current email if any
                  setNewPassword('');
                  setForgotError('');
                }}
              >
                <Text style={styles.forgotText}>Forgot password?</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Toggle mode - only show for signin/signup, not forgot */}
        {mode !== 'forgot' && (
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
        )}

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
    marginBottom: Spacing.xs,
  },
  avatarPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.border,
    borderStyle: 'dashed',
  },
  avatarImage: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 3,
    borderColor: Colors.primary,
  },
  avatarEditBtn: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: Colors.background,
    ...Shadow.sm,
  },
  avatarEditBtnUploading: {
    backgroundColor: Colors.accent,
  },
  avatarStatusText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    textAlign: 'center',
    fontWeight: '600',
  },
  avatarHintText: {
    fontSize: FontSize.xs,
    color: Colors.textLight,
    textAlign: 'center',
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

  forgotSuccessIcon: {
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  forgotIconWrap: {
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  forgotEmailBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  forgotEmailBadgeText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.primary,
  },
  passwordStrength: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  strengthBar: {
    height: 4,
    width: 60,
    borderRadius: 2,
  },
  strengthText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  forgotBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
  },
  forgotBackText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  forgotBackToSignIn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  forgotBackToSignInText: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.primary,
  },
});

