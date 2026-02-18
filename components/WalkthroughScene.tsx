import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions, Image } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, BorderRadius, FontSize, Spacing, Shadow } from '@/app/lib/theme';
import { NEED_PHOTOS } from '@/app/lib/data';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PHONE_WIDTH = Math.min(SCREEN_WIDTH * 0.65, 280);
const PHONE_HEIGHT = PHONE_WIDTH * 1.95;

interface SceneProps {
  sceneIndex: number;
  isActive: boolean;
}

// Mini phone frame component
const PhoneFrame: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <View style={phoneStyles.frame}>
    <View style={phoneStyles.notch} />
    <View style={phoneStyles.screen}>
      {children}
    </View>
    <View style={phoneStyles.homeBar} />
  </View>
);

// ─── Scene 0: Welcome / Logo ─────────────────────────────────────────────────
const WelcomeScene: React.FC<{ fadeAnim: Animated.Value; scaleAnim: Animated.Value }> = ({ fadeAnim, scaleAnim }) => (
  <Animated.View style={[sceneStyles.centered, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
    <View style={sceneStyles.logoCircle}>
      <MaterialIcons name="favorite" size={48} color={Colors.white} />
    </View>
    <Text style={sceneStyles.logoText}>SpotMe</Text>
    <Text style={sceneStyles.logoTagline}>Let me show you{'\n'}how it works.</Text>
    <View style={sceneStyles.welcomeDots}>
      <View style={[sceneStyles.dot, { backgroundColor: Colors.primary }]} />
      <View style={[sceneStyles.dot, { backgroundColor: Colors.accent }]} />
      <View style={[sceneStyles.dot, { backgroundColor: Colors.secondary }]} />
    </View>
  </Animated.View>
);

// ─── Scene 1: Home Feed ──────────────────────────────────────────────────────
const HomeFeedScene: React.FC<{ fadeAnim: Animated.Value; scrollAnim: Animated.Value }> = ({ fadeAnim, scrollAnim }) => (
  <Animated.View style={[sceneStyles.phoneContainer, { opacity: fadeAnim }]}>
    <PhoneFrame>
      <Animated.View style={{ transform: [{ translateY: scrollAnim }] }}>
        {/* Mini top bar */}
        <View style={miniStyles.topBar}>
          <Text style={miniStyles.logo}>SpotMe</Text>
          <View style={miniStyles.avatar} />
        </View>
        {/* Mini hero */}
        <View style={miniStyles.hero}>
          <Text style={miniStyles.heroText}>Small acts.{'\n'}Big impact.</Text>
        </View>
        {/* Mini stats */}
        <View style={miniStyles.statsRow}>
          <View style={miniStyles.stat}><Text style={miniStyles.statNum}>15</Text><Text style={miniStyles.statLabel}>Active</Text></View>
          <View style={miniStyles.stat}><Text style={miniStyles.statNum}>$2.4k</Text><Text style={miniStyles.statLabel}>Raised</Text></View>
          <View style={miniStyles.stat}><Text style={miniStyles.statNum}>89</Text><Text style={miniStyles.statLabel}>Spots</Text></View>
        </View>
        {/* Mini need cards with realistic content */}
        {[
          { title: 'Electric bill due Friday', pct: 73, cat: 'Bills' },
          { title: 'Groceries for the kids', pct: 100, cat: 'Groceries' },
          { title: 'School supplies for Mia', pct: 70, cat: 'Kids' },
        ].map((item, i) => (
          <View key={i} style={miniStyles.needCard}>
            <View style={miniStyles.cardHeader}>
              <View style={miniStyles.cardAvatar} />
              <View style={miniStyles.cardInfo}>
                <Text style={{ fontSize: 6, fontWeight: '700', color: Colors.text }} numberOfLines={1}>{item.title}</Text>
                <Text style={{ fontSize: 4, color: Colors.textLight }}>{item.cat}</Text>
              </View>
            </View>
            <View style={miniStyles.progressBar}>
              <View style={[miniStyles.progressFill, { width: `${item.pct}%`, backgroundColor: item.pct >= 100 ? Colors.success : Colors.primary }]} />
            </View>
            <Text style={{ fontSize: 5, color: Colors.textSecondary, marginTop: 2 }}>{item.pct}% funded</Text>
          </View>
        ))}
      </Animated.View>
    </PhoneFrame>
    <Text style={sceneStyles.sceneCaption}>Your home feed</Text>
  </Animated.View>
);

// ─── Scene 2: Post a Need ────────────────────────────────────────────────────
const PostRequestScene: React.FC<{ fadeAnim: Animated.Value; pulseAnim: Animated.Value }> = ({ fadeAnim, pulseAnim }) => (
  <Animated.View style={[sceneStyles.phoneContainer, { opacity: fadeAnim }]}>
    <PhoneFrame>
      <View style={miniStyles.topBar}>
        <Text style={miniStyles.logo}>SpotMe</Text>
        <View style={miniStyles.avatar} />
      </View>
      <View style={{ padding: 12, gap: 8 }}>
        <Text style={[miniStyles.sectionTitle, { fontSize: 11, fontWeight: '800' }]}>Post a Need</Text>
        {/* Form fields */}
        <View style={miniStyles.formField}>
          <Text style={miniStyles.formLabel}>What do you need?</Text>
          <View style={miniStyles.formInput}>
            <Text style={miniStyles.formPlaceholder}>Electric bill help...</Text>
          </View>
        </View>
        <View style={miniStyles.formField}>
          <Text style={miniStyles.formLabel}>Tell your story</Text>
          <View style={[miniStyles.formInput, { height: 40 }]}>
            <Text style={miniStyles.formPlaceholder}>My bill came in higher...</Text>
          </View>
        </View>
        <View style={miniStyles.formField}>
          <Text style={miniStyles.formLabel}>Goal amount</Text>
          <View style={miniStyles.formInput}>
            <Text style={[miniStyles.formPlaceholder, { color: Colors.text }]}>$85</Text>
          </View>
        </View>
        <Animated.View style={[miniStyles.postButton, { transform: [{ scale: pulseAnim }] }]}>
          <Text style={miniStyles.postButtonText}>Post Need</Text>
        </Animated.View>
      </View>
      {/* Highlighted plus button at bottom */}
      <View style={miniStyles.bottomTabBar}>
        <View style={miniStyles.tabItem}><MaterialIcons name="home" size={12} color={Colors.textLight} /></View>
        <View style={miniStyles.tabItem}><MaterialIcons name="search" size={12} color={Colors.textLight} /></View>
        <Animated.View style={[miniStyles.plusButtonHighlight, { transform: [{ scale: pulseAnim }] }]}>
          <MaterialIcons name="add" size={16} color={Colors.white} />
        </Animated.View>
        <View style={miniStyles.tabItem}><MaterialIcons name="notifications-none" size={12} color={Colors.textLight} /></View>
        <View style={miniStyles.tabItem}><MaterialIcons name="person-outline" size={12} color={Colors.textLight} /></View>
      </View>
    </PhoneFrame>
    <Text style={sceneStyles.sceneCaption}>Tap the plus button to post</Text>
  </Animated.View>
);

// ─── Scene 3: Categories ─────────────────────────────────────────────────────
const CategoriesScene: React.FC<{ fadeAnim: Animated.Value; staggerAnims: Animated.Value[] }> = ({ fadeAnim, staggerAnims }) => {
  const categories = [
    { name: 'Bills', icon: 'receipt', color: Colors.bills },
    { name: 'Kids', icon: 'child-care', color: Colors.kids },
    { name: 'Groceries', icon: 'shopping-cart', color: Colors.groceries },
    { name: 'Self-Care', icon: 'spa', color: Colors.selfCare },
    { name: 'Health', icon: 'fitness-center', color: Colors.health },
    { name: 'Transport', icon: 'directions-car', color: Colors.transport },
  ];

  return (
    <Animated.View style={[sceneStyles.phoneContainer, { opacity: fadeAnim }]}>
      <PhoneFrame>
        <View style={miniStyles.topBar}>
          <Text style={miniStyles.logo}>SpotMe</Text>
          <View style={miniStyles.avatar} />
        </View>
        <View style={{ padding: 12 }}>
          <Text style={[miniStyles.sectionTitle, { fontSize: 11, fontWeight: '800', marginBottom: 8 }]}>Browse by Category</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {categories.map((cat, i) => (
              <Animated.View
                key={cat.name}
                style={[
                  miniStyles.categoryCard,
                  {
                    opacity: staggerAnims[i] || 1,
                    transform: [{ scale: staggerAnims[i] || 1 }],
                  },
                ]}
              >
                <View style={[miniStyles.categoryIcon, { backgroundColor: cat.color + '20' }]}>
                  <MaterialIcons name={cat.icon as any} size={16} color={cat.color} />
                </View>
                <Text style={miniStyles.categoryName}>{cat.name}</Text>
              </Animated.View>
            ))}
          </View>
          {/* Mama Recharge highlight */}
          <View style={miniStyles.rechargeHighlight}>
            <View style={miniStyles.rechargeIconCircle}>
              <MaterialIcons name="spa" size={12} color={Colors.selfCare} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={miniStyles.rechargeText}>Mama Recharge</Text>
              <Text style={{ fontSize: 5, color: Colors.selfCareDark, marginTop: 1 }}>Self-care moments just for you</Text>
            </View>
            <MaterialIcons name="chevron-right" size={12} color={Colors.selfCare} />
          </View>
        </View>
      </PhoneFrame>
      <Text style={sceneStyles.sceneCaption}>Browse by category</Text>
    </Animated.View>
  );
};

// ─── Scene 4: Support / Contribute ───────────────────────────────────────────
const SupportScene: React.FC<{ fadeAnim: Animated.Value; tapAnim: Animated.Value }> = ({ fadeAnim, tapAnim }) => (
  <Animated.View style={[sceneStyles.phoneContainer, { opacity: fadeAnim }]}>
    <PhoneFrame>
      <View style={{ padding: 12, gap: 8 }}>
        <View style={miniStyles.detailCard}>
          <Image source={{ uri: NEED_PHOTOS[0] }} style={miniStyles.detailImage} />
          <View style={{ padding: 8, gap: 4 }}>
            <View style={miniStyles.cardHeader}>
              <View style={miniStyles.cardAvatar} />
              <View style={miniStyles.cardInfo}>
                <Text style={{ fontSize: 7, fontWeight: '700', color: Colors.text }}>Sarah Mitchell</Text>
                <Text style={{ fontSize: 5, color: Colors.textLight }}>Austin, TX</Text>
              </View>
            </View>
            <Text style={{ fontSize: 8, fontWeight: '700', color: Colors.text }}>Electric bill is due Friday</Text>
            <Text style={{ fontSize: 6, color: Colors.textSecondary, lineHeight: 9 }}>My electric bill came in higher than expected...</Text>
            <View style={miniStyles.progressBar}>
              <View style={[miniStyles.progressFill, { width: '73%' }]} />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 6, color: Colors.textSecondary }}>$62 of $85</Text>
              <Text style={{ fontSize: 6, fontWeight: '700', color: Colors.primary }}>73%</Text>
            </View>
            {/* Prominent "Spot Them" button with tap animation */}
            <Animated.View style={[miniStyles.supportButton, { transform: [{ scale: tapAnim }] }]}>
              <MaterialIcons name="favorite" size={10} color={Colors.white} />
              <Text style={miniStyles.supportButtonText}>Spot Them</Text>
            </Animated.View>
            {/* Amount hint */}
            <View style={miniStyles.amountHints}>
              <View style={miniStyles.amountChip}><Text style={miniStyles.amountChipText}>$5</Text></View>
              <View style={miniStyles.amountChip}><Text style={miniStyles.amountChipText}>$10</Text></View>
              <View style={[miniStyles.amountChip, miniStyles.amountChipActive]}><Text style={[miniStyles.amountChipText, { color: Colors.white }]}>$20</Text></View>
              <View style={miniStyles.amountChip}><Text style={miniStyles.amountChipText}>$50</Text></View>
            </View>
          </View>
        </View>
      </View>
    </PhoneFrame>
    <Text style={sceneStyles.sceneCaption}>Tap "Spot Them" to help</Text>
  </Animated.View>
);

// ─── Scene 5: Smart Split ────────────────────────────────────────────────────
const SmartSplitScene: React.FC<{ fadeAnim: Animated.Value; splitAnims: Animated.Value[] }> = ({ fadeAnim, splitAnims }) => (
  <Animated.View style={[sceneStyles.phoneContainer, { opacity: fadeAnim }]}>
    <PhoneFrame>
      <View style={{ padding: 12, gap: 6 }}>
        <View style={miniStyles.smartSplitHeader}>
          <MaterialIcons name="auto-awesome" size={14} color={Colors.accent} />
          <Text style={{ fontSize: 10, fontWeight: '800', color: Colors.text }}>Smart Split</Text>
        </View>
        <Text style={{ fontSize: 7, color: Colors.textSecondary, textAlign: 'center' }}>One payment helps 5 people at once</Text>
        <View style={miniStyles.splitDiagram}>
          <View style={miniStyles.splitCenter}>
            <Text style={{ fontSize: 10, fontWeight: '800', color: Colors.primary }}>$30</Text>
          </View>
          {/* Split lines */}
          {[0, 1, 2, 3, 4].map(i => (
            <Animated.View
              key={i}
              style={[
                miniStyles.splitTarget,
                {
                  top: 8 + i * 22,
                  right: 10,
                  opacity: splitAnims[i] || 1,
                  transform: [{ translateX: splitAnims[i]?.interpolate?.({
                    inputRange: [0, 1],
                    outputRange: [30, 0],
                  }) || 0 }],
                },
              ]}
            >
              <View style={miniStyles.splitLine} />
              <View style={miniStyles.splitAvatar} />
              <Text style={{ fontSize: 6, color: Colors.text, fontWeight: '600' }}>${[8, 7, 6, 5, 4][i]}</Text>
            </Animated.View>
          ))}
        </View>
        <View style={miniStyles.splitStats}>
          <View style={miniStyles.splitStatItem}>
            <Text style={{ fontSize: 10, fontWeight: '800', color: Colors.primary }}>5</Text>
            <Text style={{ fontSize: 5, color: Colors.textLight }}>People</Text>
          </View>
          <View style={miniStyles.splitStatItem}>
            <Text style={{ fontSize: 10, fontWeight: '800', color: Colors.secondary }}>2</Text>
            <Text style={{ fontSize: 5, color: Colors.textLight }}>Goals Met</Text>
          </View>
          <View style={miniStyles.splitStatItem}>
            <Text style={{ fontSize: 10, fontWeight: '800', color: Colors.accent }}>$30</Text>
            <Text style={{ fontSize: 5, color: Colors.textLight }}>Total</Text>
          </View>
        </View>
      </View>
    </PhoneFrame>
    <Text style={sceneStyles.sceneCaption}>One payment, multiple people</Text>
  </Animated.View>
);

// ─── Scene 6: Community ──────────────────────────────────────────────────────
const CommunityScene: React.FC<{ fadeAnim: Animated.Value }> = ({ fadeAnim }) => (
  <Animated.View style={[sceneStyles.phoneContainer, { opacity: fadeAnim }]}>
    <PhoneFrame>
      <View style={miniStyles.topBar}>
        <Text style={miniStyles.logo}>SpotMe</Text>
        <View style={miniStyles.avatar} />
      </View>
      <View style={{ padding: 10, gap: 6 }}>
        {/* Activity feed items */}
        {[
          { name: 'David C.', action: 'spotted Sarah $20', icon: 'favorite', color: Colors.primary },
          { name: 'Elena R.', action: 'goal met!', icon: 'celebration', color: Colors.accent },
          { name: 'James P.', action: 'spotted Marcus $10', icon: 'favorite', color: Colors.primary },
          { name: 'Aisha W.', action: 'posted a need', icon: 'add-circle', color: Colors.secondary },
          { name: 'Priya S.', action: 'spotted Aisha $5', icon: 'favorite', color: Colors.primary },
          { name: 'Tyler B.', action: 'goal met!', icon: 'celebration', color: Colors.accent },
        ].map((item, i) => (
          <View key={i} style={miniStyles.activityItem}>
            <View style={[miniStyles.activityIcon, { backgroundColor: item.color + '20' }]}>
              <MaterialIcons name={item.icon as any} size={10} color={item.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 7, color: Colors.text }}>
                <Text style={{ fontWeight: '700' }}>{item.name}</Text> {item.action}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </PhoneFrame>
    <Text style={sceneStyles.sceneCaption}>People showing up every day</Text>
  </Animated.View>
);

// ─── Scene 7: Closing ────────────────────────────────────────────────────────
const ClosingScene: React.FC<{ fadeAnim: Animated.Value; scaleAnim: Animated.Value }> = ({ fadeAnim, scaleAnim }) => (
  <Animated.View style={[sceneStyles.centered, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
    <View style={sceneStyles.closingHeart}>
      <MaterialIcons name="favorite" size={56} color={Colors.primary} />
    </View>
    <Text style={sceneStyles.closingTitle}>We're glad{'\n'}you're here.</Text>
    <View style={sceneStyles.closingSteps}>
      <View style={sceneStyles.closingStep}>
        <View style={[sceneStyles.closingStepIcon, { backgroundColor: Colors.primaryLight }]}>
          <MaterialIcons name="search" size={16} color={Colors.primary} />
        </View>
        <Text style={sceneStyles.closingStepText}>Browse</Text>
      </View>
      <MaterialIcons name="chevron-right" size={14} color={Colors.textLight} />
      <View style={sceneStyles.closingStep}>
        <View style={[sceneStyles.closingStepIcon, { backgroundColor: Colors.secondaryLight }]}>
          <MaterialIcons name="add-circle-outline" size={16} color={Colors.secondary} />
        </View>
        <Text style={sceneStyles.closingStepText}>Post</Text>
      </View>
      <MaterialIcons name="chevron-right" size={14} color={Colors.textLight} />
      <View style={sceneStyles.closingStep}>
        <View style={[sceneStyles.closingStepIcon, { backgroundColor: Colors.accentLight }]}>
          <MaterialIcons name="favorite-border" size={16} color={Colors.accent} />
        </View>
        <Text style={sceneStyles.closingStepText}>Support</Text>
      </View>
      <MaterialIcons name="chevron-right" size={14} color={Colors.textLight} />
      <View style={sceneStyles.closingStep}>
        <View style={[sceneStyles.closingStepIcon, { backgroundColor: Colors.selfCareLight }]}>
          <MaterialIcons name="replay" size={16} color={Colors.selfCare} />
        </View>
        <Text style={sceneStyles.closingStepText}>Repeat</Text>
      </View>
    </View>
    <View style={sceneStyles.closingDivider} />
    <Text style={sceneStyles.closingLogo}>SpotMe</Text>
  </Animated.View>
);

// ─── Main Scene Component ────────────────────────────────────────────────────
export default function WalkthroughScene({ sceneIndex, isActive }: SceneProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const scrollAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const tapAnim = useRef(new Animated.Value(1)).current;
  const staggerAnims = useRef([...Array(6)].map(() => new Animated.Value(0))).current;
  const splitAnims = useRef([...Array(5)].map(() => new Animated.Value(0))).current;

  useEffect(() => {
    if (isActive) {
      // Fade in
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, friction: 8, useNativeDriver: true }),
      ]).start();

      // Scene-specific animations
      if (sceneIndex === 1) {
        // Slow scroll animation for home feed — feels like browsing
        Animated.loop(
          Animated.sequence([
            Animated.timing(scrollAnim, { toValue: -50, duration: 4000, useNativeDriver: true }),
            Animated.timing(scrollAnim, { toValue: 0, duration: 4000, useNativeDriver: true }),
          ])
        ).start();
      }

      if (sceneIndex === 2) {
        // Pulse animation for post button + plus button
        Animated.loop(
          Animated.sequence([
            Animated.timing(pulseAnim, { toValue: 1.08, duration: 800, useNativeDriver: true }),
            Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
          ])
        ).start();
      }

      if (sceneIndex === 3) {
        // Stagger categories in
        const animations = staggerAnims.map((anim, i) =>
          Animated.sequence([
            Animated.delay(i * 150),
            Animated.spring(anim, { toValue: 1, friction: 6, useNativeDriver: true }),
          ])
        );
        Animated.parallel(animations).start();
      }

      if (sceneIndex === 4) {
        // Tap animation for "Spot Them" button
        Animated.loop(
          Animated.sequence([
            Animated.timing(tapAnim, { toValue: 0.92, duration: 250, useNativeDriver: true }),
            Animated.timing(tapAnim, { toValue: 1.08, duration: 200, useNativeDriver: true }),
            Animated.timing(tapAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
            Animated.delay(1800),
          ])
        ).start();
      }

      if (sceneIndex === 5) {
        // Smart split stagger — lines fly in one by one
        const animations = splitAnims.map((anim, i) =>
          Animated.sequence([
            Animated.delay(i * 250),
            Animated.spring(anim, { toValue: 1, friction: 6, useNativeDriver: true }),
          ])
        );
        Animated.parallel(animations).start();
      }
    } else {
      // Reset all animations
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.9);
      scrollAnim.setValue(0);
      staggerAnims.forEach(a => a.setValue(0));
      splitAnims.forEach(a => a.setValue(0));
    }
  }, [isActive, sceneIndex]);

  const scenes = [
    <WelcomeScene fadeAnim={fadeAnim} scaleAnim={scaleAnim} />,
    <HomeFeedScene fadeAnim={fadeAnim} scrollAnim={scrollAnim} />,
    <PostRequestScene fadeAnim={fadeAnim} pulseAnim={pulseAnim} />,
    <CategoriesScene fadeAnim={fadeAnim} staggerAnims={staggerAnims} />,
    <SupportScene fadeAnim={fadeAnim} tapAnim={tapAnim} />,
    <SmartSplitScene fadeAnim={fadeAnim} splitAnims={splitAnims} />,
    <CommunityScene fadeAnim={fadeAnim} />,
    <ClosingScene fadeAnim={fadeAnim} scaleAnim={scaleAnim} />,
  ];

  return (
    <View style={sceneStyles.container}>
      {scenes[sceneIndex]}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const sceneStyles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 32,
  },
  phoneContainer: {
    alignItems: 'center',
    gap: 20,
  },
  logoCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.lg,
    marginBottom: 8,
  },
  logoText: {
    fontSize: 42,
    fontWeight: '900',
    color: Colors.primary,
    letterSpacing: -1,
  },
  logoTagline: {
    fontSize: 17,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    fontWeight: '500',
  },
  welcomeDots: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sceneCaption: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textSecondary,
    letterSpacing: 0.3,
  },
  closingHeart: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  closingTitle: {
    fontSize: 36,
    fontWeight: '900',
    color: Colors.text,
    textAlign: 'center',
    lineHeight: 42,
    letterSpacing: -0.5,
  },
  closingSteps: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  closingStep: {
    alignItems: 'center',
    gap: 4,
  },
  closingStepIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closingStepText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  closingDivider: {
    width: 40,
    height: 3,
    backgroundColor: Colors.primary,
    borderRadius: 2,
    marginVertical: 8,
  },
  closingLogo: {
    fontSize: 24,
    fontWeight: '900',
    color: Colors.primary,
    letterSpacing: -0.5,
  },
});

const phoneStyles = StyleSheet.create({
  frame: {
    width: PHONE_WIDTH,
    height: PHONE_HEIGHT,
    backgroundColor: Colors.surface,
    borderRadius: 28,
    borderWidth: 3,
    borderColor: '#1a1a1a',
    overflow: 'hidden',
    ...Shadow.lg,
  },
  notch: {
    width: 80,
    height: 20,
    backgroundColor: '#1a1a1a',
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    alignSelf: 'center',
  },
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
    overflow: 'hidden',
  },
  homeBar: {
    width: 60,
    height: 4,
    backgroundColor: '#1a1a1a',
    borderRadius: 2,
    alignSelf: 'center',
    marginVertical: 6,
  },
});

const miniStyles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  logo: {
    fontSize: 12,
    fontWeight: '900',
    color: Colors.primary,
  },
  avatar: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.primaryLight,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  hero: {
    marginHorizontal: 10,
    backgroundColor: Colors.primary,
    borderRadius: 10,
    padding: 10,
    height: 55,
    justifyContent: 'flex-end',
  },
  heroText: {
    fontSize: 10,
    fontWeight: '900',
    color: Colors.white,
    lineHeight: 12,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginHorizontal: 10,
    marginTop: 6,
    backgroundColor: Colors.surface,
    borderRadius: 8,
    padding: 6,
    ...Shadow.sm,
  },
  stat: {
    alignItems: 'center',
  },
  statNum: {
    fontSize: 8,
    fontWeight: '800',
    color: Colors.text,
  },
  statLabel: {
    fontSize: 5,
    color: Colors.textLight,
  },
  needCard: {
    marginHorizontal: 10,
    marginTop: 6,
    backgroundColor: Colors.surface,
    borderRadius: 8,
    padding: 8,
    ...Shadow.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardAvatar: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.primaryLight,
  },
  cardInfo: {
    flex: 1,
    gap: 2,
  },
  textLine: {
    height: 5,
    backgroundColor: Colors.borderLight,
    borderRadius: 2,
  },
  progressBar: {
    height: 4,
    backgroundColor: Colors.borderLight,
    borderRadius: 2,
    marginTop: 6,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 2,
  },
  sectionTitle: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.text,
  },
  formField: {
    gap: 3,
  },
  formLabel: {
    fontSize: 6,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  formInput: {
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 6,
    padding: 6,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  formPlaceholder: {
    fontSize: 6,
    color: Colors.textLight,
  },
  postButton: {
    backgroundColor: Colors.primary,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
    marginTop: 4,
  },
  postButtonText: {
    fontSize: 8,
    fontWeight: '700',
    color: Colors.white,
  },
  // Bottom tab bar for Post scene — highlights the plus button
  bottomTabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderTopWidth: 0.5,
    borderTopColor: Colors.borderLight,
    backgroundColor: Colors.surface,
  },
  tabItem: {
    padding: 4,
  },
  plusButtonHighlight: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.md,
  },
  categoryCard: {
    width: '30%',
    backgroundColor: Colors.surface,
    borderRadius: 8,
    padding: 8,
    alignItems: 'center',
    gap: 4,
    ...Shadow.sm,
  },
  categoryIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryName: {
    fontSize: 6,
    fontWeight: '600',
    color: Colors.text,
  },
  rechargeHighlight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.selfCareLight,
    borderRadius: 8,
    padding: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: Colors.selfCare + '40',
  },
  rechargeIconCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.selfCare + '30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rechargeText: {
    fontSize: 7,
    fontWeight: '700',
    color: Colors.selfCareDark,
  },
  detailCard: {
    backgroundColor: Colors.surface,
    borderRadius: 10,
    overflow: 'hidden',
    ...Shadow.sm,
  },
  detailImage: {
    width: '100%',
    height: 80,
  },
  supportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: Colors.primary,
    borderRadius: 8,
    paddingVertical: 6,
    marginTop: 4,
  },
  supportButtonText: {
    fontSize: 8,
    fontWeight: '700',
    color: Colors.white,
  },
  // Amount hint chips for the Support scene
  amountHints: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
    marginTop: 4,
  },
  amountChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 0.5,
    borderColor: Colors.borderLight,
  },
  amountChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  amountChipText: {
    fontSize: 6,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  smartSplitHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  splitDiagram: {
    height: 130,
    position: 'relative',
    marginTop: 4,
  },
  splitCenter: {
    position: 'absolute',
    left: 20,
    top: 40,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  splitTarget: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  splitLine: {
    width: 30,
    height: 1,
    backgroundColor: Colors.border,
  },
  splitAvatar: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.primaryLight,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  splitStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: Colors.surface,
    borderRadius: 8,
    padding: 8,
    ...Shadow.sm,
  },
  splitStatItem: {
    alignItems: 'center',
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.borderLight,
  },
  activityIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
