import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, BorderRadius, FontSize, Spacing } from '@/app/lib/theme';

const SECTIONS = [
  { title: '1. Acceptance of Terms', body: 'By accessing or using SpotMe ("the Platform"), you agree to be bound by these Terms of Service. If you do not agree, do not use the Platform. SpotMe reserves the right to update these terms at any time. Continued use after changes constitutes acceptance.' },
  { title: '2. Eligibility', body: 'You must be at least 18 years old to use SpotMe. By creating an account, you represent that you are of legal age and have the capacity to enter into a binding agreement.' },
  { title: '3. Account Responsibilities', body: 'You are responsible for maintaining the confidentiality of your account credentials. You agree to provide accurate information during registration and to update it as needed. You may not create multiple accounts or impersonate others.' },
  { title: '4. Posting Needs', body: 'Needs posted on SpotMe must be genuine and truthful. You may post up to 4 active needs at a time, each with a maximum goal of $300. Misrepresenting your situation, posting fraudulent needs, or using funds for purposes other than described is strictly prohibited and may result in account termination.' },
  { title: '5. Contributions', body: 'Contributions are voluntary and non-refundable once processed. SpotMe does not guarantee that any need will be fully funded. Contributors acknowledge that they are giving freely and that SpotMe is not responsible for how recipients use the funds.' },
  { title: '6. Fees', body: 'SpotMe does not charge a platform fee on contributions. 100% of every contribution goes directly to the recipient. Payment processing is handled by Stripe, which charges a standard processing fee (2.9% + $0.30). At checkout, contributors may leave an optional tip to support SpotMe\'s operations. Tips are entirely voluntary and do not affect the amount received by the person in need.' },

  { title: '7. Payouts', body: 'Recipients may request payouts once their need reaches its goal. Payouts are processed via Stripe Connect and typically take 2-3 business days. SpotMe reserves the right to delay or withhold payouts if fraud or a terms violation is suspected.' },
  { title: '8. Prohibited Conduct', body: 'You may not: post false or misleading needs; harass, bully, or discriminate against other users; use the platform for illegal activities; attempt to circumvent platform fees; create fake accounts or manipulate the system; solicit funds for emergencies better served by professional organizations.' },
  { title: '9. Content & Reporting', body: 'SpotMe may review, moderate, or remove any content that violates these terms or community guidelines. Users can report suspicious activity, and all reports are reviewed within 24 hours.' },
  { title: '10. Privacy', body: 'Your use of SpotMe is also governed by our Privacy Policy. We collect only the information necessary to operate the platform and never sell your personal data to third parties.' },
  { title: '11. Limitation of Liability', body: 'SpotMe is provided "as is" without warranties of any kind. SpotMe is not liable for any damages arising from your use of the platform, including but not limited to lost funds, unauthorized access, or service interruptions.' },
  { title: '12. Termination', body: 'SpotMe may suspend or terminate your account at any time for violations of these terms. You may delete your account at any time through your profile settings.' },
  { title: '13. Contact', body: 'For questions about these Terms of Service, contact us at hellospotme.app@gmail.com.' },
];

export default function TermsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}><MaterialIcons name="arrow-back" size={24} color={Colors.text} /></TouchableOpacity>
        <Text style={s.headerTitle}>Terms of Service</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <Text style={s.updated}>Last updated: February 19, 2026</Text>
        {SECTIONS.map((sec, i) => (
          <View key={i} style={s.section}>
            <Text style={s.sectionTitle}>{sec.title}</Text>
            <Text style={s.sectionBody}>{sec.body}</Text>
          </View>
        ))}
        <Text style={s.footer}>© 2026 SpotMe. All rights reserved.</Text>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.text },
  content: { padding: Spacing.md, paddingBottom: 40 },
  updated: { fontSize: 13, color: Colors.textLight, marginBottom: 16, fontStyle: 'italic' },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: Colors.text, marginBottom: 6 },
  sectionBody: { fontSize: 14, color: Colors.textSecondary, lineHeight: 22 },
  footer: { textAlign: 'center', fontSize: 12, color: Colors.textLight, marginTop: 20 },
});
