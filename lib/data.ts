export interface User {
  id: string;
  name: string;
  avatar: string;
  bio: string;
  city: string;
  joinedDate: string;
  totalRaised: number;
  totalGiven: number;
  verified: boolean;
  trustScore?: number;
  trustLevel?: 'new' | 'active' | 'verified' | 'trusted' | 'champion';
}

export interface Contribution {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  amount: number;
  note?: string;
  timestamp: string;
}

export interface Need {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  userCity: string;
  userVerified?: boolean;
  userTrustScore?: number;
  userTrustLevel?: string;
  title: string;
  message: string;
  category: string;
  goalAmount: number;
  raisedAmount: number;
  photo?: string;
  status: 'Collecting' | 'Goal Met' | 'Payout Requested' | 'Paid' | 'Expired' | 'Deleted';
  verificationStatus?: 'pending' | 'approved' | 'rejected' | 'flagged' | 'info_requested';
  verifiedAt?: string;
  contributorCount: number;
  contributions: Contribution[];
  createdAt: string;
  expiresAt?: string;
  updatedAt?: string;
  featured?: boolean;
}

export interface Receipt {
  id: string;
  receiptNumber: string;
  contributorName: string;
  needTitle: string;
  recipientName: string;
  amount: number;
  platformFee: number;
  netAmount: number;
  paymentMethod: string;
  transactionRef?: string;
  status: string;
  isAnonymous: boolean;
  createdAt: string;
}

export interface ThankYouUpdate {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  needId: string;
  needTitle: string;
  message: string;
  videoUrl?: string;
  photoUrl?: string;
  pinned: boolean;
  createdAt: string;
  likes: number;
}

export interface TrustScoreDetails {
  score: number;
  level: string;
  factors: {
    accountAge: number;
    identityVerified: number;
    contributionsMade: number;
    totalGiven: number;
    needsFunded: number;
    reportsPenalty: number;
    engagement: number;
  };
  profile: {
    verified: boolean;
    identityVerified: boolean;
    accountAgeDays: number;
    needsCreated: number;
    needsFunded: number;
    contributionsMade: number;
    reportsReceived: number;
  };
}

export const TRUST_LEVELS = {
  new: { label: 'New', color: '#A9A29B', icon: 'person-outline' },
  active: { label: 'Active', color: '#7B9ED9', icon: 'trending-up' },
  verified: { label: 'Verified', color: '#8BAF8E', icon: 'verified-user' },
  trusted: { label: 'Trusted', color: '#F2785C', icon: 'shield' },
  champion: { label: 'Champion', color: '#F5C563', icon: 'star' },
};

export const VERIFICATION_STATUSES = {
  pending: { label: 'Under Review', color: '#F5C563', icon: 'hourglass-empty' },
  approved: { label: 'Verified', color: '#5CB85C', icon: 'check-circle' },
  rejected: { label: 'Not Approved', color: '#E85D5D', icon: 'cancel' },
  flagged: { label: 'Flagged', color: '#E85D5D', icon: 'flag' },
  info_requested: { label: 'Info Needed', color: '#F5C563', icon: 'info' },
};

export interface Notification {
  id: string;
  type: 'contribution' | 'goal_met' | 'milestone' | 'payout' | 'welcome' | 'payment_failed' | 'payout_ready' | 'payout_issue';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  needId?: string;
  avatar?: string;
  paymentId?: string;
  failureCode?: string;
}

export const CATEGORIES = [
  { name: 'All', icon: 'apps' },
  { name: 'Bills', icon: 'receipt' },
  { name: 'Kids', icon: 'child-care' },
  { name: 'Groceries', icon: 'shopping-cart' },
  { name: 'Health/Fitness', icon: 'fitness-center' },
  { name: 'Self-Care', icon: 'spa' },
  { name: 'Transportation', icon: 'directions-car' },
  { name: 'Other', icon: 'more-horiz' },
];

export const RECHARGE_CATEGORIES = [
  { name: 'Gym / Pilates', icon: 'fitness-center', color: '#E8A0BF' },
  { name: 'Hair & Beauty', icon: 'content-cut', color: '#D4A0D9' },
  { name: 'Nails & Spa', icon: 'spa', color: '#B8A9C9' },
  { name: 'Workout Gear', icon: 'checkroom', color: '#F2785C' },
  { name: 'Classes & Hobbies', icon: 'palette', color: '#7B9ED9' },
  { name: 'Rest & Wellness', icon: 'self-improvement', color: '#8BAF8E' },
];

const AVATARS = [
  'https://d64gsuwffb70l.cloudfront.net/698fe0b37fe9438e65b48d58_1771037056297_f9a83069.png',
  'https://d64gsuwffb70l.cloudfront.net/698fe0b37fe9438e65b48d58_1771037056573_451fb65f.png',
  'https://d64gsuwffb70l.cloudfront.net/698fe0b37fe9438e65b48d58_1771037041799_20c595bd.jpg',
  'https://d64gsuwffb70l.cloudfront.net/698fe0b37fe9438e65b48d58_1771037064960_2d7609c5.png',
  'https://d64gsuwffb70l.cloudfront.net/698fe0b37fe9438e65b48d58_1771037049254_f950ccb1.png',
  'https://d64gsuwffb70l.cloudfront.net/698fe0b37fe9438e65b48d58_1771037060145_0ca59f8e.png',
  'https://d64gsuwffb70l.cloudfront.net/698fe0b37fe9438e65b48d58_1771037062543_b10ff8a6.png',
  'https://d64gsuwffb70l.cloudfront.net/698fe0b37fe9438e65b48d58_1771037046421_52a3035d.jpg',
];

export const NEED_PHOTOS = [
  'https://d64gsuwffb70l.cloudfront.net/698fe0b37fe9438e65b48d58_1771036986417_a166c8a9.png',
  'https://d64gsuwffb70l.cloudfront.net/698fe0b37fe9438e65b48d58_1771036981567_f2878445.jpg',
  'https://d64gsuwffb70l.cloudfront.net/698fe0b37fe9438e65b48d58_1771036982144_4e58e2c7.jpg',
  'https://d64gsuwffb70l.cloudfront.net/698fe0b37fe9438e65b48d58_1771036989869_9c5ac389.png',
  'https://d64gsuwffb70l.cloudfront.net/698fe0b37fe9438e65b48d58_1771037005168_3648d3d0.jpg',
  'https://d64gsuwffb70l.cloudfront.net/698fe0b37fe9438e65b48d58_1771037012144_f5922740.png',
  'https://d64gsuwffb70l.cloudfront.net/698fe0b37fe9438e65b48d58_1771037021921_1ea40934.png',
  'https://d64gsuwffb70l.cloudfront.net/698fe0b37fe9438e65b48d58_1771037014280_ef6c652b.png',
  'https://d64gsuwffb70l.cloudfront.net/698fe0b37fe9438e65b48d58_1771037090926_6f96c94c.png',
  'https://d64gsuwffb70l.cloudfront.net/698fe0b37fe9438e65b48d58_1771037081113_9a83e69c.jpg',
  'https://d64gsuwffb70l.cloudfront.net/698fe0b37fe9438e65b48d58_1771037080260_25a5baea.jpg',
  'https://d64gsuwffb70l.cloudfront.net/698fe0b37fe9438e65b48d58_1771037087747_e7329fd7.jpg',
];

export const HERO_IMAGE = 'https://d64gsuwffb70l.cloudfront.net/698fe0b37fe9438e65b48d58_1771036966816_3239ff44.png';

// Treat Yourself Thursday spotlight, derived from live Self-Care needs
export function getRechargeSpotlight(needs: Need[]) {
  const selfCare = needs.filter(n => n.category === 'Self-Care');
  const pick = selfCare
    .filter(n => n.status === 'Collecting' && n.goalAmount > 0)
    .sort((a, b) => (b.raisedAmount / b.goalAmount) - (a.raisedAmount / a.goalAmount)
      || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
  const now = new Date();
  const weekNumber = Math.ceil(((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / 86400000 + 1) / 7);
  return {
    currentMom: pick ? {
      id: pick.id,
      name: pick.userName || 'SpotMe Mom',
      avatar: pick.userAvatar || AVATARS[0],
      city: pick.userCity || '',
      request: pick.title,
      message: pick.message,
      goalAmount: pick.goalAmount,
      raisedAmount: pick.raisedAmount,
      supporters: pick.contributorCount,
    } : null,
    weekNumber,
    totalMomsSupported: selfCare.filter(n => n.raisedAmount > 0).length,
    totalRaised: selfCare.reduce((sum, n) => sum + (n.raisedAmount || 0), 0),
  };
}

export const COMMUNITY_GUIDELINES = [
  { title: 'Be Honest', description: 'Only post Needs that are genuine. Describe your situation truthfully and use funds as described.' },
  { title: 'Be Kind', description: 'Treat every member with respect. Leave supportive notes and encourage others in the community.' },
  { title: 'Keep It Small', description: 'SpotMe is for everyday needs, not emergencies or large fundraising. Maximum goal is $300.' },
  { title: 'Stay Reasonable', description: 'You can have up to 4 active needs at a time. Wait for one to be resolved before posting more if you\'ve reached the limit.' },
  { title: 'Protect Privacy', description: 'Don\'t share personal information about others. Respect everyone\'s privacy and boundaries.' },
  { title: 'Report Concerns', description: 'If something doesn\'t feel right, use the report feature. Our team reviews every report within 24 hours.' },
  { title: 'No Harassment', description: 'Zero tolerance for bullying, harassment, or discrimination of any kind.' },
  { title: 'Gratitude Matters', description: 'When your goal is met, consider thanking your contributors. A little gratitude goes a long way.' },
];

export const FAQ_ITEMS = [
  { q: 'How does SpotMe work?', a: 'Post a Need with a title, category, and goal amount ($25-$300). Other community members can contribute small amounts to help you reach your goal.' },
  { q: 'Is there a fee?', a: 'SpotMe takes no platform fee — 100% of your contribution goes to the recipient. Stripe charges a standard processing fee (2.9% + $0.30). At checkout, you can leave an optional tip to support SpotMe.' },

  { q: 'How do I get my money?', a: 'Once your goal is met, tap "Request Payout" on your Need. Payouts are processed within 2-3 business days to your linked payment method.' },
  { q: 'Can I contribute anonymously?', a: 'Yes! When contributing, you can choose to hide your name. Your contribution will show as "A kind stranger."' },
  { q: 'What if my goal isn\'t met?', a: 'You still receive whatever has been contributed. Needs stay active for 14 days. After that, you can request a payout for the amount raised.' },
  { q: 'How do I report a suspicious post?', a: 'Tap the three dots on any Need card and select "Report." Choose a reason and our team will review it within 24 hours.' },
  { q: 'Can I edit my Need after posting?', a: 'You can edit the message and photo, but not the goal amount or category once contributions have been made.' },
  { q: 'Is my information safe?', a: 'We use industry-standard encryption and never share your personal information with other users or third parties.' },
  { q: 'Can I post a thank you update?', a: 'Yes! Once your need is funded, you can post a thank you message, photo, or video. Pin it to your profile so supporters can see the impact of their help.' },

];

