import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { goBack } from '@/lib/navigation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, FontSize, Spacing } from '@/lib/theme';

const SECTIONS = [
  { title: '1. Who we are', body: 'SpotMe ("we", "us") is a community platform where people post everyday needs and neighbors contribute to them. This policy explains what personal information we collect, how we use it, and the choices you have. Contact: hellospotme.app@gmail.com.' },
  { title: '2. Information you give us', body: 'Account: your name, email address and password (stored only as a secure hash by our authentication provider). Profile: optional photo, bio and city. Needs: the title, story, photo, category and goal you post. Contributions: the amount, an optional note, and whether you chose to give anonymously. Comments, reports and verification requests you submit.' },
  { title: '3. Payments and payouts', body: 'Card payments are processed by Stripe. SpotMe never receives or stores your full card number. To receive payouts you create a Stripe Connect account; Stripe collects and holds the identity and bank details it requires. We store the Stripe account ID and payout status so we can send your funds.' },
  { title: '4. Information collected automatically', body: 'When something goes wrong in the app we record an error report, which can include the page, your browser or device type, and your account ID if you are signed in. If you turn on push notifications we store the notification address your device provides.' },
  { title: '5. How we use information', body: 'To run your account; show needs and contributions; process payments, receipts and payouts; send notifications about your needs and donations; prevent fraud and enforce our Terms; and fix problems. We do not sell your personal information and we do not use it for third-party advertising.' },
  { title: '6. What is public', body: 'Your name, profile photo, city and bio, the needs you post, comments, and contributions you make without choosing "anonymous" are visible to other users and visitors. Your email address and payment details are never shown publicly.' },
  { title: '7. Service providers', body: 'We share information only with providers that operate SpotMe for us: Supabase (database, authentication and file storage), Stripe (payments and payouts), and Vercel (website hosting). Each processes data on our behalf under its own security and privacy commitments. We may also disclose information when required by law.' },
  { title: '8. Retention and deletion', body: 'You can delete your account at any time in Settings → Delete Account. This removes your login and personal profile information, your notifications, and needs that received no donations. Records of completed payments are kept in anonymized form because financial and tax rules require it.' },
  { title: '9. Security', body: 'Data is transmitted over encrypted connections and access to it is restricted by account. No system is perfectly secure, so please use a strong, unique password.' },
  { title: '10. Children', body: 'SpotMe is for people 18 and older. We do not knowingly collect information from children. If you believe a child has created an account, contact us and we will remove it.' },
  { title: '11. Your choices and rights', body: 'You can view and update your profile in the app, turn notifications off, give anonymously, and delete your account. Depending on where you live you may have additional rights, such as requesting a copy of your data. Email hellospotme.app@gmail.com to make a request.' },
  { title: '12. Changes', body: 'We will update this page when our practices change and revise the date below. Significant changes will be announced in the app.' },
];

export default function PrivacyScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <TouchableOpacity
          onPress={() => goBack(router)}
          style={s.backBtn}
          accessibilityLabel="Go back"
        >
          <MaterialIcons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Privacy Policy</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <Text style={s.updated}>Last updated: November 3, 2026</Text>
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
