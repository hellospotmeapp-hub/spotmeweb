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
  status: 'Collecting' | 'Goal Met' | 'Payout Requested' | 'Paid' | 'Expired';
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

export const MOCK_USERS: User[] = [
  { id: 'u1', name: 'Sarah Mitchell', avatar: AVATARS[0], bio: 'Mom of two, freelance designer. Trying my best every day.', city: 'Austin, TX', joinedDate: '2025-09-15', totalRaised: 450, totalGiven: 120, verified: true },
  { id: 'u2', name: 'Marcus Johnson', avatar: AVATARS[1], bio: 'College student working part-time. Community is everything.', city: 'Chicago, IL', joinedDate: '2025-10-02', totalRaised: 200, totalGiven: 85, verified: false },
  { id: 'u3', name: 'Elena Rodriguez', avatar: AVATARS[2], bio: 'Teacher by day, artist by night. Love helping neighbors.', city: 'Denver, CO', joinedDate: '2025-08-20', totalRaised: 600, totalGiven: 340, verified: true },
  { id: 'u4', name: 'James Park', avatar: AVATARS[3], bio: 'Software developer. Believe in paying it forward.', city: 'Seattle, WA', joinedDate: '2025-11-01', totalRaised: 150, totalGiven: 520, verified: true },
  { id: 'u5', name: 'Aisha Williams', avatar: AVATARS[4], bio: 'Nurse and single mom. Grateful for every bit of help.', city: 'Atlanta, GA', joinedDate: '2025-07-10', totalRaised: 800, totalGiven: 200, verified: true },
  { id: 'u6', name: 'David Chen', avatar: AVATARS[5], bio: 'Retired teacher. Love supporting young families.', city: 'Portland, OR', joinedDate: '2025-06-15', totalRaised: 0, totalGiven: 1200, verified: true },
  { id: 'u7', name: 'Priya Sharma', avatar: AVATARS[6], bio: 'Grad student in social work. Passionate about mutual aid.', city: 'Boston, MA', joinedDate: '2025-12-01', totalRaised: 175, totalGiven: 95, verified: false },
  { id: 'u8', name: 'Tyler Brooks', avatar: AVATARS[7], bio: 'Barista and aspiring musician. Life is a journey.', city: 'Nashville, TN', joinedDate: '2026-01-05', totalRaised: 100, totalGiven: 45, verified: false },
];

export const CURRENT_USER: User = {
  id: 'current',
  name: 'Alex Rivera',
  avatar: AVATARS[3],
  bio: 'Just trying to make it through the week. Love this community.',
  city: 'San Francisco, CA',
  joinedDate: '2025-10-15',
  totalRaised: 325,
  totalGiven: 180,
  verified: true,
};

export const MOCK_NEEDS: Need[] = [
  {
    id: 'n1', userId: 'u1', userName: 'Sarah Mitchell', userAvatar: AVATARS[0], userCity: 'Austin, TX',
    title: 'Electric bill is due Friday', message: 'My electric bill came in higher than expected this month because of the cold snap. Just need a little help to cover the difference.',
    category: 'Bills', goalAmount: 85, raisedAmount: 62, photo: NEED_PHOTOS[0],
    status: 'Collecting', contributorCount: 8, createdAt: '2026-02-12T10:00:00Z', featured: true,
    contributions: [
      { id: 'c1', userId: 'u4', userName: 'James Park', userAvatar: AVATARS[3], amount: 10, note: 'Stay warm!', timestamp: '2026-02-12T11:00:00Z' },
      { id: 'c2', userId: 'u6', userName: 'David Chen', userAvatar: AVATARS[5], amount: 20, note: 'Happy to help a neighbor.', timestamp: '2026-02-12T12:30:00Z' },
      { id: 'c3', userId: 'u3', userName: 'Elena Rodriguez', userAvatar: AVATARS[2], amount: 5, timestamp: '2026-02-12T14:00:00Z' },
    ],
  },
  {
    id: 'n2', userId: 'u2', userName: 'Marcus Johnson', userAvatar: AVATARS[1], userCity: 'Chicago, IL',
    title: 'Textbooks for spring semester', message: 'Need two textbooks for my engineering classes. Used copies are still $120 total. Every dollar helps me stay in school.',
    category: 'Other', goalAmount: 120, raisedAmount: 45, photo: NEED_PHOTOS[1],
    status: 'Collecting', contributorCount: 5, createdAt: '2026-02-11T08:00:00Z',
    contributions: [
      { id: 'c4', userId: 'u5', userName: 'Aisha Williams', userAvatar: AVATARS[4], amount: 10, note: 'Education matters!', timestamp: '2026-02-11T09:00:00Z' },
      { id: 'c5', userId: 'u6', userName: 'David Chen', userAvatar: AVATARS[5], amount: 25, note: 'Keep studying hard!', timestamp: '2026-02-11T10:00:00Z' },
    ],
  },
  {
    id: 'n3', userId: 'u5', userName: 'Aisha Williams', userAvatar: AVATARS[4], userCity: 'Atlanta, GA',
    title: 'Groceries for the kids this week', message: 'Payday is next Friday but the fridge is empty. Just need enough to get through the week for me and my two kids.',
    category: 'Groceries', goalAmount: 75, raisedAmount: 75, photo: NEED_PHOTOS[2],
    status: 'Goal Met', contributorCount: 12, createdAt: '2026-02-10T07:00:00Z', featured: true,
    contributions: [
      { id: 'c6', userId: 'u1', userName: 'Sarah Mitchell', userAvatar: AVATARS[0], amount: 15, note: 'Mom to mom, I got you.', timestamp: '2026-02-10T08:00:00Z' },
      { id: 'c7', userId: 'u4', userName: 'James Park', userAvatar: AVATARS[3], amount: 10, timestamp: '2026-02-10T09:00:00Z' },
    ],
  },
  {
    id: 'n4', userId: 'u3', userName: 'Elena Rodriguez', userAvatar: AVATARS[2], userCity: 'Denver, CO',
    title: 'New tires before the snow', message: 'My front tires are bald and we have a big storm coming. Need to replace them to get to work safely.',
    category: 'Transportation', goalAmount: 200, raisedAmount: 134, photo: NEED_PHOTOS[8],
    status: 'Collecting', contributorCount: 15, createdAt: '2026-02-09T12:00:00Z',
    contributions: [
      { id: 'c8', userId: 'u6', userName: 'David Chen', userAvatar: AVATARS[5], amount: 50, note: 'Safety first!', timestamp: '2026-02-09T13:00:00Z' },
      { id: 'c9', userId: 'u1', userName: 'Sarah Mitchell', userAvatar: AVATARS[0], amount: 10, timestamp: '2026-02-09T14:00:00Z' },
    ],
  },
  {
    id: 'n5', userId: 'u7', userName: 'Priya Sharma', userAvatar: AVATARS[6], userCity: 'Boston, MA',
    title: 'Gym membership renewal', message: 'Exercise is my therapy. My gym membership expired and I can\'t afford to renew it this month. It keeps me sane during grad school.',
    category: 'Health/Fitness', goalAmount: 45, raisedAmount: 30, photo: NEED_PHOTOS[4],
    status: 'Collecting', contributorCount: 6, createdAt: '2026-02-13T09:00:00Z',
    contributions: [
      { id: 'c10', userId: 'u4', userName: 'James Park', userAvatar: AVATARS[3], amount: 10, note: 'Mental health matters!', timestamp: '2026-02-13T10:00:00Z' },
    ],
  },
  {
    id: 'n6', userId: 'u8', userName: 'Tyler Brooks', userAvatar: AVATARS[7], userCity: 'Nashville, TN',
    title: 'Bus pass for the month', message: 'My car broke down and I need a monthly bus pass to get to work. Can\'t miss any more shifts.',
    category: 'Transportation', goalAmount: 65, raisedAmount: 65, photo: NEED_PHOTOS[5],
    status: 'Payout Requested', contributorCount: 9, createdAt: '2026-02-08T06:00:00Z',
    contributions: [
      { id: 'c11', userId: 'u3', userName: 'Elena Rodriguez', userAvatar: AVATARS[2], amount: 20, note: 'Get to work safely!', timestamp: '2026-02-08T07:00:00Z' },
    ],
  },
  {
    id: 'n7', userId: 'u1', userName: 'Sarah Mitchell', userAvatar: AVATARS[0], userCity: 'Austin, TX',
    title: 'School supplies for my daughter', message: 'My daughter needs art supplies for a school project due next week. The list they sent home is surprisingly expensive.',
    category: 'Kids', goalAmount: 40, raisedAmount: 28, photo: NEED_PHOTOS[6],
    status: 'Collecting', contributorCount: 4, createdAt: '2026-02-13T15:00:00Z',
    contributions: [
      { id: 'c12', userId: 'u5', userName: 'Aisha Williams', userAvatar: AVATARS[4], amount: 10, note: 'For the little artist!', timestamp: '2026-02-13T16:00:00Z' },
    ],
  },
  {
    id: 'n8', userId: 'u4', userName: 'James Park', userAvatar: AVATARS[3], userCity: 'Seattle, WA',
    title: 'Prescription co-pay this month', message: 'Insurance changed my co-pay and I wasn\'t prepared. Need help covering my monthly medication.',
    category: 'Health/Fitness', goalAmount: 55, raisedAmount: 55, photo: NEED_PHOTOS[7],
    status: 'Paid', contributorCount: 7, createdAt: '2026-02-05T10:00:00Z',
    contributions: [
      { id: 'c13', userId: 'u6', userName: 'David Chen', userAvatar: AVATARS[5], amount: 25, note: 'Health comes first.', timestamp: '2026-02-05T11:00:00Z' },
    ],
  },
  {
    id: 'n9', userId: 'u6', userName: 'David Chen', userAvatar: AVATARS[5], userCity: 'Portland, OR',
    title: 'Internet bill for the month', message: 'Fixed income month was tight. Need help with the internet bill so I can stay connected with my grandkids.',
    category: 'Bills', goalAmount: 60, raisedAmount: 18, photo: NEED_PHOTOS[9],
    status: 'Collecting', contributorCount: 3, createdAt: '2026-02-14T01:00:00Z',
    contributions: [
      { id: 'c14', userId: 'u7', userName: 'Priya Sharma', userAvatar: AVATARS[6], amount: 5, note: 'Stay connected!', timestamp: '2026-02-14T02:00:00Z' },
    ],
  },
  {
    id: 'n10', userId: 'u5', userName: 'Aisha Williams', userAvatar: AVATARS[4], userCity: 'Atlanta, GA',
    title: 'Soccer cleats for my son', message: 'My son made the school soccer team! He needs cleats by next week for practice. So proud of him.',
    category: 'Kids', goalAmount: 50, raisedAmount: 35, photo: NEED_PHOTOS[10],
    status: 'Collecting', contributorCount: 5, createdAt: '2026-02-12T16:00:00Z',
    contributions: [
      { id: 'c15', userId: 'u3', userName: 'Elena Rodriguez', userAvatar: AVATARS[2], amount: 15, note: 'Go team!', timestamp: '2026-02-12T17:00:00Z' },
    ],
  },
  {
    id: 'n11', userId: 'u2', userName: 'Marcus Johnson', userAvatar: AVATARS[1], userCity: 'Chicago, IL',
    title: 'Laundromat money for the week', message: 'Washer broke in my building. Need quarters for the laundromat down the street until it gets fixed.',
    category: 'Other', goalAmount: 25, raisedAmount: 25, photo: NEED_PHOTOS[11],
    status: 'Goal Met', contributorCount: 6, createdAt: '2026-02-07T14:00:00Z',
    contributions: [
      { id: 'c16', userId: 'u1', userName: 'Sarah Mitchell', userAvatar: AVATARS[0], amount: 5, note: 'Clean clothes matter!', timestamp: '2026-02-07T15:00:00Z' },
    ],
  },
  // Mama Recharge / Self-Care needs
  {
    id: 'mr1', userId: 'u1', userName: 'Sarah Mitchell', userAvatar: AVATARS[0], userCity: 'Austin, TX',
    title: 'Pilates class pass for the month', message: 'I used to go to Pilates before the kids came along. It was my time to breathe. I\'d love to get back to it, even just once a week.',
    category: 'Self-Care', goalAmount: 60, raisedAmount: 42, photo: NEED_PHOTOS[4],
    status: 'Collecting', contributorCount: 7, createdAt: '2026-02-14T08:00:00Z', featured: true,
    contributions: [
      { id: 'mc1', userId: 'u6', userName: 'David Chen', userAvatar: AVATARS[5], amount: 15, note: 'You deserve this, mama!', timestamp: '2026-02-14T09:00:00Z' },
      { id: 'mc2', userId: 'u3', userName: 'Elena Rodriguez', userAvatar: AVATARS[2], amount: 10, note: 'Self-care is not selfish!', timestamp: '2026-02-14T10:00:00Z' },
    ],
  },
  {
    id: 'mr2', userId: 'u5', userName: 'Aisha Williams', userAvatar: AVATARS[4], userCity: 'Atlanta, GA',
    title: 'Hair touch-up before my birthday', message: 'My birthday is next week and I haven\'t had my hair done in months. Just want to feel like myself again for one day.',
    category: 'Self-Care', goalAmount: 75, raisedAmount: 55, photo: NEED_PHOTOS[6],
    status: 'Collecting', contributorCount: 9, createdAt: '2026-02-13T11:00:00Z',
    contributions: [
      { id: 'mc3', userId: 'u1', userName: 'Sarah Mitchell', userAvatar: AVATARS[0], amount: 20, note: 'Happy early birthday! Treat yourself!', timestamp: '2026-02-13T12:00:00Z' },
      { id: 'mc4', userId: 'u4', userName: 'James Park', userAvatar: AVATARS[3], amount: 10, note: 'You deserve it!', timestamp: '2026-02-13T13:00:00Z' },
    ],
  },
  {
    id: 'mr3', userId: 'u3', userName: 'Elena Rodriguez', userAvatar: AVATARS[2], userCity: 'Denver, CO',
    title: 'New workout leggings', message: 'My only pair of workout pants has holes in them. I\'d love a new pair so I can keep up my morning walks. It\'s the one thing that keeps me grounded.',
    category: 'Self-Care', goalAmount: 40, raisedAmount: 40, photo: NEED_PHOTOS[10],
    status: 'Goal Met', contributorCount: 8, createdAt: '2026-02-10T09:00:00Z',
    contributions: [
      { id: 'mc5', userId: 'u5', userName: 'Aisha Williams', userAvatar: AVATARS[4], amount: 10, note: 'Walk it out, queen!', timestamp: '2026-02-10T10:00:00Z' },
    ],
  },
  {
    id: 'mr4', userId: 'u7', userName: 'Priya Sharma', userAvatar: AVATARS[6], userCity: 'Boston, MA',
    title: 'Pottery class this spring', message: 'I\'ve always wanted to try pottery. There\'s a beginner class at the community center and it would give me something just for me.',
    category: 'Self-Care', goalAmount: 55, raisedAmount: 18, photo: NEED_PHOTOS[3],
    status: 'Collecting', contributorCount: 3, createdAt: '2026-02-15T07:00:00Z',
    contributions: [
      { id: 'mc6', userId: 'u6', userName: 'David Chen', userAvatar: AVATARS[5], amount: 10, note: 'Creativity heals!', timestamp: '2026-02-15T08:00:00Z' },
    ],
  },
];

// Treat Yourself Thursday spotlight
export const THURSDAY_SPOTLIGHT = {
  currentMom: {
    id: 'mr2',
    name: 'Aisha Williams',
    avatar: AVATARS[4],
    city: 'Atlanta, GA',
    request: 'Hair touch-up before my birthday',
    message: 'My birthday is next week and I haven\'t had my hair done in months. Just want to feel like myself again for one day.',
    goalAmount: 75,
    raisedAmount: 55,
    supporters: 9,
  },
  weekNumber: 12,
  totalMomsSupported: 47,
  totalRaised: 3240,
};

export const MOCK_NOTIFICATIONS: Notification[] = [

  { id: 'not1', type: 'contribution', title: 'New Spot!', message: 'James Park spotted you $10 on "Electric bill is due Friday"', timestamp: '2026-02-14T02:30:00Z', read: false, needId: 'n1', avatar: AVATARS[3] },
  { id: 'not2', type: 'milestone', title: '75% There!', message: 'Your need "Electric bill is due Friday" is 75% funded!', timestamp: '2026-02-13T18:00:00Z', read: false, needId: 'n1' },
  { id: 'not3', type: 'goal_met', title: 'Goal Met!', message: 'Congratulations! "Groceries for the kids this week" reached its goal!', timestamp: '2026-02-12T20:00:00Z', read: true, needId: 'n3' },
  { id: 'not4', type: 'contribution', title: 'New Spot!', message: 'Elena Rodriguez spotted you $5 on "Electric bill is due Friday"', timestamp: '2026-02-12T14:00:00Z', read: true, needId: 'n1', avatar: AVATARS[2] },
  { id: 'not5', type: 'payout', title: 'Payout Approved', message: 'Your payout for "Bus pass for the month" has been approved!', timestamp: '2026-02-11T10:00:00Z', read: true, needId: 'n6' },
  { id: 'not6', type: 'contribution', title: 'New Spot!', message: 'David Chen spotted you $25 on "Textbooks for spring semester"', timestamp: '2026-02-11T10:00:00Z', read: true, needId: 'n2', avatar: AVATARS[5] },
  { id: 'not7', type: 'welcome', title: 'Welcome to SpotMe!', message: 'Thanks for joining our community. Start by browsing Needs or creating your own.', timestamp: '2026-02-10T08:00:00Z', read: true },
];

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

export const MOCK_THANK_YOU_UPDATES: ThankYouUpdate[] = [
  {
    id: 'ty1',
    userId: 'u5',
    userName: 'Aisha Williams',
    userAvatar: AVATARS[4],
    needId: 'n3',
    needTitle: 'Groceries for the kids this week',
    message: 'Thank you SO much to everyone who helped! The kids had full bellies all week. My son even said "Mom, we have snacks!" I cried a little. This community is everything.',
    videoUrl: 'https://d64gsuwffb70l.cloudfront.net/698fe0b37fe9438e65b48d58_1771036982144_4e58e2c7.jpg',
    pinned: true,
    createdAt: '2026-02-12T10:00:00Z',
    likes: 24,
  },
  {
    id: 'ty2',
    userId: 'u2',
    userName: 'Marcus Johnson',
    userAvatar: AVATARS[1],
    needId: 'n11',
    needTitle: 'Laundromat money for the week',
    message: 'Clean clothes for the week! It sounds small but it made such a difference. Thank you to every single person who chipped in. I appreciate you all.',
    pinned: true,
    createdAt: '2026-02-09T14:00:00Z',
    likes: 11,
  },
  {
    id: 'ty3',
    userId: 'u3',
    userName: 'Elena Rodriguez',
    userAvatar: AVATARS[2],
    needId: 'mr3',
    needTitle: 'New workout leggings',
    message: 'Got my new leggings and went on the most amazing morning walk today! Feeling so grateful. You all helped me keep my sanity. Here is me on my walk this morning!',
    photoUrl: NEED_PHOTOS[10],
    pinned: true,
    createdAt: '2026-02-12T08:00:00Z',
    likes: 18,
  },
  {
    id: 'ty4',
    userId: 'u8',
    userName: 'Tyler Brooks',
    userAvatar: AVATARS[7],
    needId: 'n6',
    needTitle: 'Bus pass for the month',
    message: 'Bus pass secured! Made it to every shift this month. My manager even noticed my consistency. Thank you for believing in me when things were tough.',
    pinned: false,
    createdAt: '2026-02-10T16:00:00Z',
    likes: 15,
  },
  {
    id: 'ty5',
    userId: 'u4',
    userName: 'James Park',
    userAvatar: AVATARS[3],
    needId: 'n8',
    needTitle: 'Prescription co-pay this month',
    message: 'Picked up my meds today. Such a relief not to have to choose between medication and groceries this month. This community literally keeps me healthy.',
    pinned: true,
    createdAt: '2026-02-07T12:00:00Z',
    likes: 21,
  },
];
