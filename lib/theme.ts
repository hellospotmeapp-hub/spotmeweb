export const Colors = {
  primary: '#F2785C',       // Soft coral
  primaryLight: '#FFF0EC',  // Very light coral
  primaryDark: '#D4563E',   // Darker coral
  secondary: '#8BAF8E',     // Sage green
  secondaryLight: '#E8F0E9',// Light sage
  secondaryDark: '#6B8F6E', // Dark sage
  accent: '#F5C563',        // Warm gold
  accentLight: '#FFF8E7',   // Light gold
  background: '#FAFAF8',    // Warm white
  surface: '#FFFFFF',
  surfaceAlt: '#F5F3F0',    // Warm gray surface
  text: '#2D2926',          // Warm dark
  textSecondary: '#7A746E', // Warm medium gray
  textLight: '#A9A29B',     // Light text
  border: '#E8E4DF',        // Warm border
  borderLight: '#F0EDE9',
  error: '#E85D5D',
  success: '#5CB85C',
  warning: '#F5C563',
  overlay: 'rgba(45, 41, 38, 0.5)',
  white: '#FFFFFF',
  black: '#2D2926',
  // Category colors
  bills: '#7B9ED9',
  kids: '#E8A0BF',
  groceries: '#8BAF8E',
  health: '#F2785C',
  transport: '#F5C563',
  other: '#B8A9C9',
  selfCare: '#D4A0D9',       // Soft lavender/orchid for Mama Recharge
  selfCareLight: '#F5E6F7',  // Light lavender
  selfCareDark: '#9B6B9F',   // Deep orchid
  rechargeGold: '#E8B94E',   // Warm gold for Thursday spotlight
  rechargeRose: '#E8A0BF',   // Soft rose
};


export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
};

export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 999,
};

export const FontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  xxl: 24,
  xxxl: 30,
  hero: 36,
};

export const Shadow = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
};

export const CategoryColors: Record<string, string> = {
  'Bills': Colors.bills,
  'Kids': Colors.kids,
  'Groceries': Colors.groceries,
  'Health/Fitness': Colors.health,
  'Transportation': Colors.transport,
  'Self-Care': Colors.selfCare,
  'Other': Colors.other,
};
