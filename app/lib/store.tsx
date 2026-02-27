import React, { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';
import { Platform } from 'react-native';
import { supabase, safeInvoke } from './supabase';
import { Need, Notification, User, Contribution, Receipt, TrustScoreDetails, ThankYouUpdate, MOCK_NEEDS, MOCK_NOTIFICATIONS, MOCK_THANK_YOU_UPDATES, CURRENT_USER } from './data';
import { offlineManager, QueuedAction } from './offlineManager';


// In-memory fallback for when localStorage is unavailable
const memoryStore: Record<string, string> = {};

const storage = {
  async get(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      try {
        const val = localStorage.getItem(key);
        if (val !== null) return val;
      } catch {}
      return memoryStore[key] || null;
    }
    return memoryStore[key] || null;
  },
  async set(key: string, value: string): Promise<void> {
    memoryStore[key] = value;
    if (Platform.OS === 'web') {
      try { localStorage.setItem(key, value); } catch {}
    }
  },
  async remove(key: string): Promise<void> {
    delete memoryStore[key];
    if (Platform.OS === 'web') {
      try { localStorage.removeItem(key); } catch {}
    }
  },
};

// ============================================================
// PENDING NEEDS CACHE — survives page refresh even if server
// call hasn't completed yet.  Stored in localStorage under
// 'spotme_pending_needs' as a JSON array of Need objects.
// ============================================================
const PENDING_NEEDS_KEY = 'spotme_pending_needs';
const DELETED_NEEDS_KEY = 'spotme_deleted_needs';

/** Read all pending (unconfirmed) needs from localStorage */
function getPendingNeeds(): Need[] {
  if (Platform.OS === 'web') {
    try {
      const raw = localStorage.getItem(PENDING_NEEDS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
  }
  // Also check in-memory fallback
  try {
    const raw = memoryStore[PENDING_NEEDS_KEY];
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

/** Persist a newly created need to the pending cache */
function savePendingNeed(need: Need): void {
  try {
    const current = getPendingNeeds();
    // Avoid duplicates by local ID
    const updated = current.filter(n => n.id !== need.id);
    updated.push(need);
    const json = JSON.stringify(updated);
    memoryStore[PENDING_NEEDS_KEY] = json;
    if (Platform.OS === 'web') {
      try { localStorage.setItem(PENDING_NEEDS_KEY, json); } catch {}
    }
    console.log(`[SpotMe PendingNeeds] Saved pending need: ${need.id} ("${need.title}") — ${updated.length} total pending`);
  } catch (err) {
    console.warn('[SpotMe PendingNeeds] Failed to save pending need:', err);
  }
}

/** Remove a pending need by its local ID (called when server confirms save) */
function removePendingNeed(localId: string): void {
  try {
    const current = getPendingNeeds();
    const updated = current.filter(n => n.id !== localId);
    if (updated.length === current.length) return; // Nothing to remove
    const json = JSON.stringify(updated);
    memoryStore[PENDING_NEEDS_KEY] = json;
    if (Platform.OS === 'web') {
      try { localStorage.setItem(PENDING_NEEDS_KEY, json); } catch {}
    }
    console.log(`[SpotMe PendingNeeds] Cleared confirmed need: ${localId} — ${updated.length} remaining`);
  } catch (err) {
    console.warn('[SpotMe PendingNeeds] Failed to remove pending need:', err);
  }
}

/** Clear ALL pending needs from the cache */
function clearAllPendingNeeds(): void {
  try {
    delete memoryStore[PENDING_NEEDS_KEY];
    if (Platform.OS === 'web') {
      try { localStorage.removeItem(PENDING_NEEDS_KEY); } catch {}
    }
  } catch {}
}

// ============================================================
// DELETED NEEDS TRACKING — prevents "zombie" needs from
// reappearing after deletion when server polling fetches them.
// Stored in localStorage under 'spotme_deleted_needs' as a
// JSON array of { id, deletedAt } objects.
// ============================================================

interface DeletedNeedRecord {
  id: string;
  deletedAt: string;
}

/** Read deleted need IDs from localStorage */
function getDeletedNeedIds(): Set<string> {
  const records = getDeletedNeedRecords();
  return new Set(records.map(r => r.id));
}

function getDeletedNeedRecords(): DeletedNeedRecord[] {
  if (Platform.OS === 'web') {
    try {
      const raw = localStorage.getItem(DELETED_NEEDS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
  }
  try {
    const raw = memoryStore[DELETED_NEEDS_KEY];
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

/** Mark a need as deleted (persists to localStorage) */
function markNeedDeleted(needId: string): void {
  try {
    const records = getDeletedNeedRecords();
    // Avoid duplicates
    if (records.some(r => r.id === needId)) return;
    const updated = [...records, { id: needId, deletedAt: new Date().toISOString() }];
    const json = JSON.stringify(updated);
    memoryStore[DELETED_NEEDS_KEY] = json;
    if (Platform.OS === 'web') {
      try { localStorage.setItem(DELETED_NEEDS_KEY, json); } catch {}
    }
    console.log(`[SpotMe DeletedNeeds] Marked need as deleted: ${needId} — ${updated.length} total deleted`);
  } catch (err) {
    console.warn('[SpotMe DeletedNeeds] Failed to mark need as deleted:', err);
  }
}

/** Clean up old deleted need records (older than 24 hours) */
function cleanupDeletedNeeds(): void {
  try {
    const records = getDeletedNeedRecords();
    const cutoff = Date.now() - (24 * 60 * 60 * 1000); // 24 hours
    const cleaned = records.filter(r => new Date(r.deletedAt).getTime() > cutoff);
    if (cleaned.length === records.length) return;
    const json = JSON.stringify(cleaned);
    memoryStore[DELETED_NEEDS_KEY] = json;
    if (Platform.OS === 'web') {
      try { localStorage.setItem(DELETED_NEEDS_KEY, json); } catch {}
    }
    console.log(`[SpotMe DeletedNeeds] Cleaned up ${records.length - cleaned.length} old records`);
  } catch {}
}

/** Clear ALL deleted need records (called on logout) */
function clearAllDeletedNeeds(): void {
  try {
    delete memoryStore[DELETED_NEEDS_KEY];
    if (Platform.OS === 'web') {
      try { localStorage.removeItem(DELETED_NEEDS_KEY); } catch {}
    }
  } catch {}
}

/** Filter out deleted needs from a needs array */
function filterDeletedNeeds(needs: Need[]): Need[] {
  const deletedIds = getDeletedNeedIds();
  if (deletedIds.size === 0) return needs;
  return needs.filter(n => !deletedIds.has(n.id));
}


/**
 * Reconcile pending needs against server-fetched needs.
 * If a server need matches a pending need (same title + userId + created
 * within 2 minutes), the pending need is considered confirmed and removed.
 * Returns any remaining unconfirmed pending needs that should be merged
 * into the displayed list.
 */
function reconcilePendingNeeds(serverNeeds: Need[]): Need[] {
  const pending = getPendingNeeds();
  if (pending.length === 0) return [];

  const remaining: Need[] = [];

  for (const pn of pending) {
    // Check if this pending need now exists on the server
    const match = serverNeeds.find(sn => {
      // Exact local-ID match (server returned the same ID — unlikely but possible)
      if (sn.id === pn.id) return true;
      // Fuzzy match: same user + same title + created within 2 minutes
      const sameUser = sn.userId === pn.userId;
      const sameTitle = sn.title.trim().toLowerCase() === pn.title.trim().toLowerCase();
      const timeDiff = Math.abs(new Date(sn.createdAt).getTime() - new Date(pn.createdAt).getTime());
      return sameUser && sameTitle && timeDiff < 120000; // 2 minutes
    });

    if (match) {
      // Confirmed on server — remove from pending cache
      removePendingNeed(pn.id);
    } else {
      // Check if the pending need is stale (older than 30 minutes = likely failed permanently)
      const age = Date.now() - new Date(pn.createdAt).getTime();
      if (age > 30 * 60 * 1000) {
        // Stale — remove from pending cache
        removePendingNeed(pn.id);
        console.log(`[SpotMe PendingNeeds] Removed stale pending need (${Math.round(age / 60000)}min old): ${pn.id}`);
      } else {
        remaining.push(pn);
      }
    }
  }

  return remaining;
}

/**
 * Merge pending needs into a server-fetched needs array.
 * Pending needs are prepended (newest first) and duplicates are avoided.
 */
function mergeWithPendingNeeds(serverNeeds: Need[]): Need[] {
  const remaining = reconcilePendingNeeds(serverNeeds);
  if (remaining.length === 0) return serverNeeds;

  // Filter out any pending needs whose IDs already exist in server data
  const serverIds = new Set(serverNeeds.map(n => n.id));
  const toMerge = remaining.filter(pn => !serverIds.has(pn.id));

  if (toMerge.length === 0) return serverNeeds;

  console.log(`[SpotMe PendingNeeds] Merging ${toMerge.length} unconfirmed needs with ${serverNeeds.length} server needs`);
  return [...toMerge, ...serverNeeds];
}


// ---- Cart Item ----
export interface CartItem {
  needId: string;
  needTitle: string;
  amount: number;
  note?: string;
  userName: string;
  userAvatar: string;
  addedAt: string;
}

interface PaymentResult {
  success: boolean;
  paymentId?: string;
  checkoutUrl?: string;
  clientSecret?: string;
  mode?: 'stripe' | 'stripe_connect' | 'direct';
  destinationCharge?: boolean;
  tipAmount?: number;
  recipientReceives?: number;
  error?: string;
  stripeNotConfigured?: boolean;
  stripeSetupError?: string;
}

interface PayoutResult {
  success: boolean;
  message?: string;
  error?: string;
  payoutId?: string;
  status?: string;
}
interface PayoutStatus {
  hasAccount: boolean;
  onboardingComplete: boolean;
  payoutsEnabled: boolean;
  accountId?: string;
  bankInfo?: BankInfo | null;
}

interface BankInfo {
  bankName: string | null;
  last4: string | null;
  routingNumber?: string | null;
  currency: string;
  country: string;
  accountHolderName?: string | null;
  status: string;
  type: string;
  isDefault?: boolean;
}


interface FailedPayment {
  id: string;
  amount: number;
  needId: string;
  needTitle: string;
  failureReason: string;
  failureCode: string;
  failedAt: string;
  createdAt: string;
  type: string;
  canRetry: boolean;
  retryCount?: number;
  maxRetries?: number;
  autoRetryScheduled?: boolean;
  lastRetryAt?: string;
  retries?: {
    id: string;
    retryNumber: number;
    status: string;
    scheduledAt: string;
    attemptedAt?: string;
    completedAt?: string;
    result?: string;
    error?: string;
  }[];
  note?: string;
  isAnonymous?: boolean;
}


interface PayoutDashboard {
  account: {
    hasAccount: boolean;
    payoutsEnabled: boolean;
    onboardingComplete: boolean;
    chargesEnabled: boolean;
    detailsSubmitted: boolean;
    lastWebhookAt: string | null;
  };
  summary: {
    totalReceived: number;
    totalFees: number;
    netReceived: number;
    directDeposits: number;
    directDepositCount: number;
    platformCollectCount: number;
    pendingAmount: number;
    paidAmount: number;
    totalPayments: number;
  };
  needs: {
    id: string;
    title: string;
    goalAmount: number;
    raisedAmount: number;
    status: string;
    contributorCount: number;
    category: string;
    createdAt: string;
    paymentsCount: number;
    directPayments: number;
  }[];
  monthlyData: {
    month: string;
    gross: number;
    fees: number;
    net: number;
    count: number;
  }[];
  recentTransactions: {
    id: string;
    amount: number;
    fee: number;
    net: number;
    needTitle: string;
    needId: string;
    contributorName: string;
    destinationCharge: boolean;
    webhookConfirmed: boolean;
    completedAt: string;
    type: string;
  }[];
}

interface ActivityItem {
  id: string;
  type: string;
  userId: string | null;
  userName: string | null;
  userAvatar: string | null;
  needId: string | null;
  needTitle: string | null;
  amount: number | null;
  message: string | null;
  createdAt: string;
}

interface AppState {
  needs: Need[];
  notifications: Notification[];
  thankYouUpdates: ThankYouUpdate[];
  currentUser: User;
  isLoggedIn: boolean;
  searchQuery: string;
  selectedCategory: string;
  isLoading: boolean;
  pushEnabled: boolean;
  payoutStatus: PayoutStatus | null;
  failedPayments: FailedPayment[];
  payoutDashboard: PayoutDashboard | null;
  receipts: Receipt[];
  trustScoreDetails: TrustScoreDetails | null;
  rateLimitError: string | null;
  cart: CartItem[];
  cartTotal: number;
  savedNeeds: string[];
  activityFeed: ActivityItem[];
  isOffline: boolean;
  pendingActions: number;
  isSyncing: boolean;
  syncOfflineActions: () => Promise<void>;
  // Actions
  contribute: (needId: string, amount: number, note?: string) => void;
  contributeWithPayment: (needId: string, amount: number, note?: string, isAnonymous?: boolean, tipAmount?: number) => Promise<PaymentResult>;
  spreadWithPayment: (allocations: any[], totalAmount: number, spreadMode: string, isAnonymous?: boolean) => Promise<PaymentResult>;
  createNeed: (need: Omit<Need, 'id' | 'userId' | 'userName' | 'userAvatar' | 'userCity' | 'status' | 'contributorCount' | 'contributions' | 'createdAt' | 'raisedAmount'>) => void;
  editNeed: (needId: string, updates: { title?: string; message?: string; photo?: string; goalAmount?: number }) => Promise<boolean>;
  deleteNeed: (needId: string) => Promise<{ success: boolean; error?: string }>;
  requestPayout: (needId: string) => Promise<PayoutResult>;
  reportNeed: (needId: string, reason: string) => void;
  blockUser: (userId: string) => void;
  markNotificationRead: (notificationId: string) => void;
  markAllNotificationsRead: () => void;
  setSearchQuery: (query: string) => void;
  setSelectedCategory: (category: string) => void;
  login: (name: string, email: string, password?: string) => Promise<{ success: boolean; error?: string }>;
  signup: (name: string, email: string, password: string, bio?: string, city?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  updateProfile: (updates: Partial<User>) => void;
  getFilteredNeeds: () => Need[];
  unreadNotificationCount: number;
  refreshNeeds: () => Promise<void>;
  fetchActivity: () => Promise<void>;
  subscribeToPush: () => Promise<boolean>;
  unsubscribeFromPush: () => Promise<void>;
  setupPayouts: () => Promise<{ success: boolean; onboardingUrl?: string; error?: string }>;
  checkPayoutStatus: () => Promise<PayoutStatus>;
  completePayoutOnboarding: () => Promise<boolean>;
  fetchFailedPayments: () => Promise<void>;
  retryPayment: (failedPaymentId: string) => Promise<PaymentResult>;
  fetchPayoutDashboard: () => Promise<void>;
  fetchReceipts: () => Promise<void>;
  fetchTrustScore: () => Promise<TrustScoreDetails | null>;
  verifyNeed: (needId: string, action: string, notes?: string) => Promise<boolean>;
  reportNeedTracked: (needId: string, reason: string, details?: string) => Promise<boolean>;
  createThankYou: (needId: string, message: string, videoUrl?: string, photoUrl?: string) => void;
  togglePinUpdate: (updateId: string) => void;
  likeUpdate: (updateId: string) => void;
  addToCart: (item: Omit<CartItem, 'addedAt'>) => void;
  removeFromCart: (needId: string) => void;
  updateCartItem: (needId: string, updates: Partial<CartItem>) => void;
  clearCart: () => void;
  isInCart: (needId: string) => boolean;
  resetPassword: (email: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
  saveNeed: (needId: string) => void;
  unsaveNeed: (needId: string) => void;
  isSaved: (needId: string) => boolean;
  checkAndExpireNeeds: () => void;
  isNeedExpired: (need: Need) => boolean;
  // Bank setup, auto-expire, payout receipts
  fetchBankInfo: () => Promise<BankInfo | null>;
  resendPayoutReceipt: (payoutId: string, email?: string) => Promise<{ success: boolean; sentTo?: string; error?: string }>;
  triggerAutoExpire: () => Promise<{ success: boolean; expiredCount?: number; emailsSent?: number; error?: string }>;
  openStripeDashboard: () => Promise<{ success: boolean; loginUrl?: string; error?: string }>;
  bankInfo: BankInfo | null;
  autoExpireLastRun: string | null;
  // Auto-payout & refund management
  autoPayoutEnabled: boolean;
  setAutoPayoutEnabled: (enabled: boolean) => void;
  processAutoPayouts: () => Promise<{ success: boolean; processed?: number; errors?: number; results?: any[]; error?: string }>;
  processRefund: (paymentId: string, amount: number, reason: string, note?: string) => Promise<{ success: boolean; refundId?: string; error?: string }>;
  fetchRefundablePayments: () => Promise<any[]>;
  refundablePayments: any[];
  // Email receipt system
  sendContributionReceipt: (params: {
    paymentId?: string; paymentIntentId?: string; amount: number; tipAmount?: number;
    needTitle?: string; needId?: string; recipientName?: string;
  }) => Promise<{ success: boolean; emailSent?: boolean; receiptNumber?: string; error?: string }>;
  resendContributionReceipt: (params: {
    paymentId?: string; paymentIntentId?: string; amount: number; tipAmount?: number;
    needTitle?: string; needId?: string; recipientName?: string;
  }) => Promise<{ success: boolean; emailSent?: boolean; receiptNumber?: string; error?: string }>;
  fetchEmailReceiptHistory: () => Promise<any[]>;
  emailReceipts: any[];
}





const GUEST_USER: User = {
  id: 'guest',
  name: 'Guest',
  avatar: '',
  bio: '',
  city: '',
  joinedDate: '2026-01-01T00:00:00.000Z',
  totalRaised: 0,
  totalGiven: 0,
  verified: false,
};

// ---- NEED EXPIRATION CONSTANTS ----
const NEED_EXPIRATION_DAYS = 14;
const NEED_EXPIRATION_MS = NEED_EXPIRATION_DAYS * 24 * 60 * 60 * 1000;

// ---- Check if a need is expired based on time ----
function isNeedExpiredByTime(need: Need): boolean {
  if (need.status === 'Expired') return true;
  if (need.status !== 'Collecting') return false; // Only collecting needs can expire
  
  const expiresAt = need.expiresAt 
    ? new Date(need.expiresAt).getTime()
    : new Date(need.createdAt).getTime() + NEED_EXPIRATION_MS;
  
  return Date.now() >= expiresAt;
}

// ---- Apply expiration to needs array ----
function applyExpirations(needs: Need[]): Need[] {
  return needs.map(need => {
    if (need.status === 'Collecting' && isNeedExpiredByTime(need)) {
      return { ...need, status: 'Expired' as const };
    }
    return need;
  });
}

function getInitialAuthState(): { user: User; loggedIn: boolean } {
  if (Platform.OS === 'web') {
    try {
      const raw = localStorage.getItem('spotme_user');
      if (raw) {
        const user = JSON.parse(raw);
        if (user && user.id && user.id !== 'guest') {
          return { user, loggedIn: true };
        }
      }
    } catch {}
  }
  return { user: GUEST_USER, loggedIn: false };
}

function getInitialCart(): CartItem[] {
  if (Platform.OS === 'web') {
    try {
      const raw = localStorage.getItem('spotme_cart');
      if (raw) return JSON.parse(raw);
    } catch {}
  }
  return [];
}

function getInitialSavedNeeds(): string[] {
  if (Platform.OS === 'web') {
    try {
      const raw = localStorage.getItem('spotme_saved_needs');
      if (raw) return JSON.parse(raw);
    } catch {}
  }
  return [];
}

const AppContext = createContext<AppState | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [needs, setNeeds] = useState<Need[]>(() => applyExpirations(MOCK_NEEDS));
  const [notifications, setNotifications] = useState<Notification[]>(MOCK_NOTIFICATIONS);
  const [thankYouUpdates, setThankYouUpdates] = useState<ThankYouUpdate[]>(MOCK_THANK_YOU_UPDATES);

  const _initial = getInitialAuthState();
  const [currentUser, setCurrentUser] = useState<User>(_initial.user);
  const [isLoggedIn, setIsLoggedIn] = useState(_initial.loggedIn);
  const [isLoading, setIsLoading] = useState(Platform.OS !== 'web');

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [blockedUsers, setBlockedUsers] = useState<string[]>([]);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [payoutStatus, setPayoutStatus] = useState<PayoutStatus | null>(null);
  const [failedPayments, setFailedPayments] = useState<FailedPayment[]>([]);
  const [payoutDashboard, setPayoutDashboard] = useState<PayoutDashboard | null>(null);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [trustScoreDetails, setTrustScoreDetails] = useState<TrustScoreDetails | null>(null);
  const [rateLimitError, setRateLimitError] = useState<string | null>(null);
  const [savedNeeds, setSavedNeeds] = useState<string[]>(getInitialSavedNeeds);
  const [cart, setCart] = useState<CartItem[]>(getInitialCart);
  const [activityFeed, setActivityFeed] = useState<ActivityItem[]>([]);

  const pollRef = useRef<any>(null);
  const dbReady = useRef(false);
  const expirationCheckRef = useRef<any>(null);
  const logoutIntentionalRef = useRef(false);


  // ---- Offline State ----
  const [isOffline, setIsOffline] = useState(false);
  const [pendingActions, setPendingActions] = useState(offlineManager.pendingCount);
  const [isSyncing, setIsSyncing] = useState(false);

  // ---- Initialize offline manager ----
  useEffect(() => {
    offlineManager.init();
    setIsOffline(!offlineManager.isOnline);
    setPendingActions(offlineManager.pendingCount);

    const unsubscribe = offlineManager.subscribe((status) => {
      const offline = status === 'offline';
      setIsOffline(offline);
      if (!offline) {
        syncOfflineActionsInternal();
      }
    });

    return unsubscribe;
  }, []);

  // ---- CLIENT-SIDE EXPIRATION CHECK ----
  // Runs every minute to check if any needs should be expired
  const checkAndExpireNeeds = useCallback(() => {
    setNeeds(prev => {
      const updated = applyExpirations(prev);
      // Only update state if something actually changed
      const changed = updated.some((n, i) => n.status !== prev[i].status);
      return changed ? updated : prev;
    });
  }, []);

  // Run expiration check periodically
  useEffect(() => {
    // Check immediately
    checkAndExpireNeeds();
    // Then check every 60 seconds
    expirationCheckRef.current = setInterval(checkAndExpireNeeds, 60000);
    return () => clearInterval(expirationCheckRef.current);
  }, [checkAndExpireNeeds]);

  // ---- Check if a specific need is expired ----
  const isNeedExpired = useCallback((need: Need): boolean => {
    return isNeedExpiredByTime(need);
  }, []);

  // ============================================================
  // AUTH STATE RECOVERY GUARD
  // If navigation causes a brief state reset (e.g. component tree
  // re-mount), this effect detects the guest state and immediately
  // recovers the user from localStorage / memoryStore before any
  // child component renders the logged-out UI.
  // ============================================================
  useEffect(() => {
    // Skip recovery if the user intentionally logged out
    if (logoutIntentionalRef.current) return;
    // Only run when state indicates guest
    if (isLoggedIn || currentUser.id !== 'guest') return;

    // --- Attempt 1: synchronous localStorage read (web) ---
    if (Platform.OS === 'web') {
      try {
        const raw = localStorage.getItem('spotme_user');
        if (raw) {
          const user = JSON.parse(raw);
          if (user && user.id && user.id !== 'guest') {
            console.log('[SpotMe Auth Recovery] Recovered auth from localStorage:', user.name);
            setCurrentUser(user);
            setIsLoggedIn(true);
            return;
          }
        }
      } catch {}
    }

    // --- Attempt 2: in-memory fallback store ---
    try {
      const raw = memoryStore['spotme_user'];
      if (raw) {
        const user = JSON.parse(raw);
        if (user && user.id && user.id !== 'guest') {
          console.log('[SpotMe Auth Recovery] Recovered auth from memoryStore:', user.name);
          setCurrentUser(user);
          setIsLoggedIn(true);
          return;
        }
      }
    } catch {}
  }, [isLoggedIn, currentUser.id]);


  // Load user + cart + pending needs from storage on mount
  // Load user + cart + pending needs from storage on mount
  useEffect(() => {
    // Clean up old deleted need records on startup
    cleanupDeletedNeeds();

    (async () => {
      try {
        const saved = await storage.get('spotme_user');
        if (saved) {
          const user = JSON.parse(saved);
          if (user && user.id && user.id !== 'guest') {
            setCurrentUser(user);
            setIsLoggedIn(true);
          }
        }
        const savedCart = await storage.get('spotme_cart');
        if (savedCart) {
          try { setCart(JSON.parse(savedCart)); } catch {}
        }
        const savedNeedsData = await storage.get('spotme_saved_needs');
        if (savedNeedsData) {
          try { setSavedNeeds(JSON.parse(savedNeedsData)); } catch {}
        }
        if (Platform.OS === 'web' && 'Notification' in window) {
          setPushEnabled(Notification.permission === 'granted');
        }

        // ---- PENDING NEEDS: Restore any needs cached in localStorage ----
        const pendingNeeds = getPendingNeeds();
        if (pendingNeeds.length > 0) {
          console.log(`[SpotMe PendingNeeds] Restoring ${pendingNeeds.length} pending needs from localStorage`);
          setNeeds(prev => {
            const existingIds = new Set(prev.map(n => n.id));
            const toRestore = pendingNeeds.filter(pn => !existingIds.has(pn.id));
            return toRestore.length > 0 ? [...toRestore, ...prev] : prev;
          });
        }

        const cached = offlineManager.getCachedNeeds();
        if (cached.needs && cached.needs.length > 0) {
          setNeeds(applyExpirations(filterDeletedNeeds(cached.needs)));
          console.log(`[SpotMe Offline] Loaded ${cached.needs.length} cached needs`);
        }

        await fetchNeeds();
      } catch {}
      setIsLoading(false);
    })();
  }, []);



  // Check payout status when user logs in
  useEffect(() => {
    if (isLoggedIn && currentUser.id !== 'guest') {
      checkPayoutStatusInternal();
    }
  }, [isLoggedIn, currentUser.id]);

  // Poll for updates every 15 seconds
  useEffect(() => {
    pollRef.current = setInterval(() => {
      if (dbReady.current && !isOffline) {
        fetchNeedsSilent();
        if (isLoggedIn && currentUser.id !== 'guest') {
          fetchNotificationsSilent();
        }
      }
    }, 15000);
    return () => clearInterval(pollRef.current);
  }, [isLoggedIn, currentUser.id, isOffline]);

  const fetchNeeds = async () => {
    try {
      const { data, error } = await safeInvoke('process-contribution', {
        body: { action: 'fetch_needs' },
      }, 8000);
      if (!error && data?.success && data.needs?.length > 0) {
        // Filter out deleted needs BEFORE merging with pending
        const filteredServerNeeds = filterDeletedNeeds(data.needs);
        // Merge server data with any unconfirmed pending needs from localStorage
        const merged = mergeWithPendingNeeds(filteredServerNeeds);
        // Apply client-side expiration check to merged data
        setNeeds(applyExpirations(merged));
        dbReady.current = true;
        offlineManager.markOnline();
        offlineManager.cacheNeeds(data.needs);
      } else if (error) {
        const msg = error?.message?.toLowerCase() || '';
        if (msg.includes('network') || msg.includes('fetch') || msg.includes('timeout') || msg.includes('load failed')) {
          offlineManager.markOffline();
        }
        const cached = offlineManager.getCachedNeeds();
        if (cached.needs && cached.needs.length > 0) {
          setNeeds(applyExpirations(filterDeletedNeeds(cached.needs)));
        }
      }
    } catch (err) {
      offlineManager.markOffline();
      const cached = offlineManager.getCachedNeeds();
      if (cached.needs && cached.needs.length > 0) {
        setNeeds(applyExpirations(filterDeletedNeeds(cached.needs)));
      }
    }
  };



  const fetchNeedsSilent = async () => {
    if (isOffline) return;
    try {
      const { data, error } = await safeInvoke('process-contribution', {
        body: { action: 'fetch_needs' },
      }, 8000);
      if (!error && data?.success && data.needs?.length > 0) {
        // Filter out deleted needs BEFORE merging with pending
        const filteredServerNeeds = filterDeletedNeeds(data.needs);
        // Merge server data with any unconfirmed pending needs from localStorage
        const merged = mergeWithPendingNeeds(filteredServerNeeds);
        setNeeds(applyExpirations(merged));
        offlineManager.markOnline();
        offlineManager.cacheNeeds(data.needs);
      } else if (error) {
        const msg = error?.message?.toLowerCase() || '';
        if (msg.includes('network') || msg.includes('fetch') || msg.includes('timeout') || msg.includes('load failed')) {
          offlineManager.markOffline();
        }
      }
    } catch {
      offlineManager.markOffline();
    }
  };



  const fetchNotificationsSilent = async () => {
    if (isOffline) return;
    try {
      const { data, error } = await safeInvoke('send-notification', {
        body: { action: 'fetch_notifications', userId: currentUser.id },
      }, 8000);
      if (!error && data?.success && data.notifications) {
        setNotifications(data.notifications);
        offlineManager.cacheNotifications(data.notifications);
      }
    } catch {}
  };

  const refreshNeeds = useCallback(async () => {
    await fetchNeeds();
  }, []);

  // ---- STRIPE CONNECT PAYMENT: Single Contribution ----
  const contributeWithPayment = useCallback(async (
    needId: string, amount: number, note?: string, isAnonymous?: boolean, tipAmount?: number
  ): Promise<PaymentResult> => {
    try {
      const need = needs.find(n => n.id === needId);
      
      // ---- EXPIRATION CHECK: Block contributions to expired needs ----
      if (need && (need.status === 'Expired' || isNeedExpiredByTime(need))) {
        return { success: false, error: 'This need has expired and is no longer accepting contributions.' };
      }
      if (need && need.status !== 'Collecting') {
        return { success: false, error: 'This need is no longer accepting contributions.' };
      }

      const returnUrl = Platform.OS === 'web' ? window.location.origin : 'https://spotmeone.com';


      const { data, error } = await supabase.functions.invoke('stripe-checkout', {
        body: {
          action: 'create_checkout',
          amount,
          needId,
          needTitle: need?.title || '',
          contributorId: currentUser.id !== 'guest' ? currentUser.id : null,
          contributorName: currentUser.name,
          contributorAvatar: currentUser.avatar,
          note: note || '',
          isAnonymous: isAnonymous || false,
          tipAmount: tipAmount || 0,
          returnUrl,
          type: 'contribution',
        },
      });

      if (error) throw new Error(error.message);

      if (data?.success) {
        if (data.alreadyPaid || data.mode === 'already_completed') {
          setTimeout(() => fetchNeedsSilent(), 500);
          return { success: true, paymentId: data.paymentId, mode: 'direct' };
        }

        if (data.clientSecret && data.mode === 'stripe') {
          if (Platform.OS === 'web') {
            const resolvedTip = data.tipAmount ?? data.applicationFee ?? tipAmount ?? 0;
            const checkoutParams = new URLSearchParams({
              client_secret: data.clientSecret,
              payment_id: data.paymentId || '',
              amount: String(amount),
              tip_amount: String(resolvedTip),
              need_title: need?.title || '',
              destination_charge: String(!!data.destinationCharge),
              application_fee: String(resolvedTip),
              recipient_receives: String(data.recipientReceives || amount),
            });
            if (data.stripeAccount) {
              checkoutParams.set('stripe_account', data.stripeAccount);
            }
            window.location.href = `/payment-checkout?${checkoutParams.toString()}`;
          }

          return {
            success: true,
            paymentId: data.paymentId,
            clientSecret: data.clientSecret,
            mode: 'stripe_connect',
            destinationCharge: data.destinationCharge,
            tipAmount: data.tipAmount,
            recipientReceives: data.recipientReceives,
          };
        }

        if (data.checkoutUrl && data.mode === 'stripe') {
          if (Platform.OS === 'web') {
            window.location.href = data.checkoutUrl;
          }
          return { success: true, paymentId: data.paymentId, checkoutUrl: data.checkoutUrl, mode: 'stripe' };
        }

        if (data.mode === 'direct') {
          setNeeds(prev => prev.map(n => {
            if (n.id === needId) {
              const newRaised = Math.min(n.raisedAmount + amount, n.goalAmount);
              const newContribution: Contribution = {
                id: `c_${Date.now()}`,
                userId: currentUser.id,
                userName: isAnonymous ? 'A kind stranger' : currentUser.name,
                userAvatar: isAnonymous ? '' : currentUser.avatar,
                amount,
                note,
                timestamp: new Date().toISOString(),
              };
              return {
                ...n,
                raisedAmount: newRaised,
                contributorCount: n.contributorCount + 1,
                contributions: [newContribution, ...n.contributions],
                status: newRaised >= n.goalAmount ? 'Goal Met' as const : n.status,
              };
            }
            return n;
          }));

          setCurrentUser(prev => {
            const updated = { ...prev, totalGiven: prev.totalGiven + amount };
            storage.set('spotme_user', JSON.stringify(updated));
            return updated;
          });

          if (need) {
            setNotifications(prev => [{
              id: `not_${Date.now()}`,
              type: 'contribution' as const,
              title: 'Spot Sent!',
              message: `You spotted $${amount} on "${need.title}"`,
              timestamp: new Date().toISOString(),
              read: false,
              needId,
            }, ...prev]);
          }

          setTimeout(() => fetchNeedsSilent(), 1500);
          return {
            success: true,
            paymentId: data.paymentId,
            mode: 'direct',
            stripeNotConfigured: data.stripeNotConfigured || false,
            stripeSetupError: data.stripeSetupError || undefined,
          };
        }
      }

      const errorMsg = data?.error || 'Payment failed';
      throw new Error(errorMsg);
    } catch (err: any) {
      return { success: false, error: err.message || 'Payment failed' };
    }
  }, [currentUser, needs]);


  // ---- STRIPE CONNECT PAYMENT: Spread the Love ----
  const spreadWithPayment = useCallback(async (
    allocations: any[], totalAmount: number, spreadMode: string, isAnonymous?: boolean
  ): Promise<PaymentResult> => {
    try {
      // ---- EXPIRATION CHECK: Filter out expired needs from allocations ----
      const validAllocations = allocations.filter(alloc => {
        const need = needs.find(n => n.id === alloc.needId);
        return need && need.status === 'Collecting' && !isNeedExpiredByTime(need);
      });
      
      if (validAllocations.length === 0) {
        return { success: false, error: 'All selected needs have expired or are no longer accepting contributions.' };
      }

      const returnUrl = Platform.OS === 'web' ? window.location.origin : 'https://spotmeone.com';


      const { data, error } = await supabase.functions.invoke('stripe-checkout', {
        body: {
          action: 'create_checkout',
          amount: totalAmount,
          contributorId: currentUser.id !== 'guest' ? currentUser.id : null,
          contributorName: currentUser.name,
          contributorAvatar: currentUser.avatar,
          isAnonymous: isAnonymous || false,
          returnUrl,
          type: 'spread',
          spreadAllocations: validAllocations,
        },
      });

      if (error) throw new Error(error.message);

      if (data?.success) {
        if (data.clientSecret && data.mode === 'stripe') {
          if (Platform.OS === 'web') {
            const checkoutParams = new URLSearchParams({
              client_secret: data.clientSecret,
              payment_id: data.paymentId || '',
              amount: String(totalAmount),
              need_title: 'Spread the Love',
              destination_charge: String(!!data.destinationCharge),
              application_fee: String(data.applicationFee || 0),
              recipient_receives: String(data.recipientReceives || 0),
            });
            if (data.stripeAccount) {
              checkoutParams.set('stripe_account', data.stripeAccount);
            }
            window.location.href = `/payment-checkout?${checkoutParams.toString()}`;
          }

          return {
            success: true,
            paymentId: data.paymentId,
            clientSecret: data.clientSecret,
            mode: 'stripe_connect',
            destinationCharge: data.destinationCharge,
          };
        }

        if (data.checkoutUrl && data.mode === 'stripe') {
          if (Platform.OS === 'web') {
            window.location.href = data.checkoutUrl;
          }
          return { success: true, paymentId: data.paymentId, checkoutUrl: data.checkoutUrl, mode: 'stripe' };
        }

        // Direct processing
        for (const alloc of validAllocations) {
          setNeeds(prev => prev.map(n => {
            if (n.id === alloc.needId) {
              const newRaised = Math.min(n.raisedAmount + alloc.amount, n.goalAmount);
              return {
                ...n,
                raisedAmount: newRaised,
                contributorCount: n.contributorCount + 1,
                status: newRaised >= n.goalAmount ? 'Goal Met' as const : n.status,
              };
            }
            return n;
          }));
        }

        setCurrentUser(prev => {
          const updated = { ...prev, totalGiven: prev.totalGiven + totalAmount };
          storage.set('spotme_user', JSON.stringify(updated));
          return updated;
        });

        setTimeout(() => fetchNeedsSilent(), 1500);
        return { success: true, paymentId: data.paymentId, mode: 'direct' };
      }

      throw new Error(data?.error || 'Payment failed');
    } catch (err: any) {
      return { success: false, error: err.message || 'Payment failed' };
    }
  }, [currentUser, needs]);

  // ---- PAYOUT SETUP (Stripe Connect Onboarding) ----
  const setupPayouts = useCallback(async (): Promise<{ success: boolean; onboardingUrl?: string; error?: string }> => {
    try {
      if (currentUser.id === 'guest') {
        return { success: false, error: 'Please sign in first' };
      }

      const { data: accountData, error: accountErr } = await supabase.functions.invoke('stripe-connect', {
        body: {
          action: 'create_account',
          email: `${currentUser.id}@spotmeone.com`,

          name: currentUser.name,
        },
      });

      if (accountErr || !accountData?.success) {
        throw new Error(accountData?.error || 'Failed to create payout account');
      }

      if (accountData.onboardingComplete) {
        setPayoutStatus({
          hasAccount: true,
          onboardingComplete: true,
          payoutsEnabled: true,
          accountId: accountData.accountId,
        });
        return { success: true };
      }

      const returnUrl = Platform.OS === 'web' ? window.location.origin : 'https://spotmeone.com';

      const { data: linkData, error: linkErr } = await supabase.functions.invoke('stripe-connect', {
        body: {
          action: 'create_onboarding_link',
          userId: currentUser.id,
          returnUrl: returnUrl + '/settings',
          refreshUrl: returnUrl + '/settings',
        },
      });

      // If the onboarding link response indicates completion (e.g. placeholder accounts),
      // update payout status immediately without needing a redirect
      if (linkData?.success && linkData?.onboardingComplete) {
        setPayoutStatus({
          hasAccount: true,
          onboardingComplete: true,
          payoutsEnabled: true,
          accountId: accountData.accountId,
        });
        return { success: true };
      }

      if (linkErr || !linkData?.success) {
        await completePayoutOnboardingInternal();
        return { success: true };
      }

      return {
        success: true,
        onboardingUrl: linkData.onboardingUrl,
      };
    } catch (err: any) {
      return { success: false, error: err.message || 'Setup failed' };
    }
  }, [currentUser]);


  const checkPayoutStatusInternal = async () => {
    try {
      const { data } = await supabase.functions.invoke('stripe-connect', {
        body: { action: 'check_status', userId: currentUser.id },
      });
      if (data?.success) {
        const status: PayoutStatus = {
          hasAccount: data.hasAccount,
          onboardingComplete: data.onboardingComplete,
          payoutsEnabled: data.payoutsEnabled,
          accountId: data.accountId,
        };
        setPayoutStatus(status);
        return status;
      }
    } catch {}
    return { hasAccount: false, onboardingComplete: false, payoutsEnabled: false };
  };

  const checkPayoutStatus = useCallback(async (): Promise<PayoutStatus> => {
    return checkPayoutStatusInternal();
  }, [currentUser.id]);

  const completePayoutOnboardingInternal = async () => {
    try {
      const { data } = await supabase.functions.invoke('stripe-connect', {
        body: { action: 'complete_onboarding', userId: currentUser.id },
      });
      if (data?.success) {
        setPayoutStatus({
          hasAccount: true,
          onboardingComplete: true,
          payoutsEnabled: true,
        });
        return true;
      }
    } catch {}
    return false;
  };

  const completePayoutOnboarding = useCallback(async (): Promise<boolean> => {
    return completePayoutOnboardingInternal();
  }, [currentUser.id]);

  // Legacy contribute (optimistic + DB)
  const contribute = useCallback(async (needId: string, amount: number, note?: string) => {
    const need = needs.find(n => n.id === needId);
    
    // ---- EXPIRATION CHECK ----
    if (need && (need.status === 'Expired' || isNeedExpiredByTime(need))) {
      setNotifications(prev => [{
        id: `not_${Date.now()}`,
        type: 'welcome' as const,
        title: 'Need Expired',
        message: 'This need has expired and is no longer accepting contributions.',
        timestamp: new Date().toISOString(),
        read: false,
        needId,
      }, ...prev]);
      return;
    }

    setNeeds(prev => prev.map(n => {
      if (n.id === needId) {
        const newRaised = Math.min(n.raisedAmount + amount, n.goalAmount);
        const newContribution: Contribution = {
          id: `c_${Date.now()}`,
          userId: currentUser.id,
          userName: currentUser.name,
          userAvatar: currentUser.avatar,
          amount,
          note,
          timestamp: new Date().toISOString(),
        };
        const isGoalMet = newRaised >= n.goalAmount;
        return {
          ...n,
          raisedAmount: newRaised,
          contributorCount: n.contributorCount + 1,
          contributions: [newContribution, ...n.contributions],
          status: isGoalMet ? 'Goal Met' as const : n.status,
        };
      }
      return n;
    }));

    if (need) {
      const newNotif: Notification = {
        id: `not_${Date.now()}`,
        type: 'contribution',
        title: 'New Spot!',
        message: `${currentUser.name} spotted $${amount} on "${need.title}"`,
        timestamp: new Date().toISOString(),
        read: false,
        needId,
        avatar: currentUser.avatar,
      };
      setNotifications(prev => [newNotif, ...prev]);
    }

    setCurrentUser(prev => {
      const updated = { ...prev, totalGiven: prev.totalGiven + amount };
      storage.set('spotme_user', JSON.stringify(updated));
      return updated;
    });

    try {
      await supabase.functions.invoke('process-contribution', {
        body: {
          action: 'contribute',
          needId,
          amount,
          note,
          contributorId: currentUser.id !== 'guest' ? currentUser.id : null,
          contributorName: currentUser.name,
          contributorAvatar: currentUser.avatar,
          isAnonymous: false,
        },
      });
      offlineManager.markOnline();
      setTimeout(() => fetchNeedsSilent(), 1000);
    } catch (err) {
      offlineManager.enqueue({
        type: 'contribution',
        payload: {
          needId,
          amount,
          note,
          contributorId: currentUser.id !== 'guest' ? currentUser.id : null,
          contributorName: currentUser.name,
          contributorAvatar: currentUser.avatar,
          isAnonymous: false,
        },
      });
      setPendingActions(offlineManager.pendingCount);
    }
  }, [currentUser, needs]);

  const createNeed = useCallback(async (needData: Omit<Need, 'id' | 'userId' | 'userName' | 'userAvatar' | 'userCity' | 'status' | 'contributorCount' | 'contributions' | 'createdAt' | 'raisedAmount'>) => {
    // No need limit — users can create unlimited needs


    const now = new Date();
    const expiresAt = new Date(now.getTime() + NEED_EXPIRATION_MS).toISOString();

    const localNeed: Need = {
      ...needData,
      id: `n_${Date.now()}`,
      userId: currentUser.id,
      userName: currentUser.name,
      userAvatar: currentUser.avatar,
      userCity: currentUser.city,
      status: 'Collecting',
      raisedAmount: 0,
      contributorCount: 0,
      contributions: [],
      createdAt: now.toISOString(),
      expiresAt, // Set expiration date
    };
    setNeeds(prev => [localNeed, ...prev]);

    // ---- PENDING NEEDS CACHE: Persist to localStorage immediately ----
    // This ensures the need survives a page refresh even if the server
    // call hasn't completed or fails silently.
    savePendingNeed(localNeed);

    try {
      const { data } = await supabase.functions.invoke('process-contribution', {
        body: {
          action: 'create_need',
          title: needData.title,
          message: needData.message,
          category: needData.category,
          goalAmount: needData.goalAmount,
          photo: needData.photo,
          userId: currentUser.id !== 'guest' ? currentUser.id : null,
          userName: currentUser.name,
          userAvatar: currentUser.avatar,
          userCity: currentUser.city,
          expiresAt, // Send expiration to server
        },
      });

      if (data?.limitReached) {
        // Server rejected — remove from both local state and pending cache
        setNeeds(prev => prev.filter(n => n.id !== localNeed.id));
        removePendingNeed(localNeed.id);
        setNotifications(prev => [{
          id: `not_${Date.now()}`,
          type: 'welcome' as const,
          title: 'Could Not Create Need',
          message: data.error || 'The server could not create this need. Please try again.',
          timestamp: new Date().toISOString(),
          read: false,
        }, ...prev]);
        return;
      }


      if (data?.success && data.need) {
        // Server confirmed — update local state with real server data and clear pending cache
        setNeeds(prev => prev.map(n => n.id === localNeed.id ? { ...data.need, expiresAt: data.need.expiresAt || expiresAt } : n));
        removePendingNeed(localNeed.id);
        console.log(`[SpotMe PendingNeeds] Need confirmed by server: ${localNeed.id} → ${data.need.id}`);
      }
      offlineManager.markOnline();

      if (currentUser.id !== 'guest') {
        await supabase.functions.invoke('send-notification', {
          body: {
            action: 'broadcast',
            title: 'New Need Posted',
            message: `${currentUser.name} needs help: "${needData.title}"`,
            notificationType: 'welcome',
            needId: data?.need?.id,
          },
        });
      }
    } catch (err) {
      // Server call failed — need stays in pending cache for recovery on next load
      console.log(`[SpotMe PendingNeeds] Server call failed, need preserved in pending cache: ${localNeed.id}`);
      offlineManager.enqueue({
        type: 'create_need',
        payload: {
          title: needData.title,
          message: needData.message,
          category: needData.category,
          goalAmount: needData.goalAmount,
          photo: needData.photo,
          userId: currentUser.id !== 'guest' ? currentUser.id : null,
          userName: currentUser.name,
          userAvatar: currentUser.avatar,
          userCity: currentUser.city,
          expiresAt,
        },
      });
      setPendingActions(offlineManager.pendingCount);
    }
  }, [currentUser, needs]);



  // ---- ENHANCED REQUEST PAYOUT ----
  const requestPayout = useCallback(async (needId: string): Promise<PayoutResult> => {
    const need = needs.find(n => n.id === needId);
    if (!need) {
      return { success: false, error: 'Need not found' };
    }

    // Validate payout eligibility
    const isOwner = need.userId === currentUser.id || need.userId === 'current';
    if (!isOwner) {
      return { success: false, error: 'Only the need owner can request a payout' };
    }

    const canPayout = need.status === 'Goal Met' || 
                      (need.status === 'Expired' && need.raisedAmount > 0) ||
                      (need.status === 'Collecting' && isNeedExpiredByTime(need) && need.raisedAmount > 0);
    
    if (!canPayout) {
      if (need.raisedAmount === 0) {
        return { success: false, error: 'No funds have been raised for this need yet.' };
      }
      if (need.status === 'Payout Requested') {
        return { success: false, error: 'A payout has already been requested for this need.' };
      }
      if (need.status === 'Paid') {
        return { success: false, error: 'This need has already been paid out.' };
      }
      return { success: false, error: 'This need is not eligible for payout yet. Wait until the goal is met or the need expires.' };
    }

    // Optimistic update
    setNeeds(prev => prev.map(n =>
      n.id === needId ? { ...n, status: 'Payout Requested' as const } : n
    ));

    // Add notification
    const newNotif: Notification = {
      id: `not_${Date.now()}`,
      type: 'payout',
      title: 'Payout Requested',
      message: `Your payout of $${need.raisedAmount} for "${need.title}" has been submitted. Processing takes 2-3 business days.`,
      timestamp: new Date().toISOString(),
      read: false,
      needId,
    };
    setNotifications(prev => [newNotif, ...prev]);

    try {
      const { data, error } = await supabase.functions.invoke('stripe-checkout', {
        body: { 
          action: 'request_payout', 
          needId, 
          userId: currentUser.id,
          amount: need.raisedAmount,
          needTitle: need.title,
        },
      });

      if (error || !data?.success) {
        // Revert optimistic update on failure
        setNeeds(prev => prev.map(n =>
          n.id === needId ? { ...n, status: need.status } : n
        ));
        const errMsg = data?.error || error?.message || 'Failed to request payout';
        
        // Update notification to show error
        setNotifications(prev => prev.map(n => 
          n.id === newNotif.id 
            ? { ...n, title: 'Payout Failed', message: errMsg, type: 'payout_issue' as const }
            : n
        ));
        
        return { success: false, error: errMsg };
      }

      // Success - refresh needs from server
      setTimeout(() => fetchNeedsSilent(), 1500);
      
      return { 
        success: true, 
        message: data.message || `Payout of $${need.raisedAmount} requested successfully! Processing takes 2-3 business days.`,
        payoutId: data.payoutId,
        status: 'requested',
      };
    } catch (err: any) {
      // Revert on network error
      setNeeds(prev => prev.map(n =>
        n.id === needId ? { ...n, status: need.status } : n
      ));
      return { success: false, error: err.message || 'Network error. Please try again.' };
    }
  }, [currentUser.id, needs]);


  const reportNeed = useCallback((_needId: string, _reason: string) => {
    const newNotif: Notification = {
      id: `not_${Date.now()}`,
      type: 'welcome',
      title: 'Report Submitted',
      message: 'Thank you for your report. Our team will review it within 24 hours.',
      timestamp: new Date().toISOString(),
      read: false,
    };
    setNotifications(prev => [newNotif, ...prev]);
  }, []);

  const blockUser = useCallback((userId: string) => {
    setBlockedUsers(prev => [...prev, userId]);
  }, []);

  const markNotificationRead = useCallback((notificationId: string) => {
    setNotifications(prev => prev.map(n =>
      n.id === notificationId ? { ...n, read: true } : n
    ));
    supabase.functions.invoke('send-notification', {
      body: { action: 'mark_read', notificationIds: [notificationId] },
    }).catch(() => {});
  }, []);

  const markAllNotificationsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    if (currentUser.id !== 'guest') {
      supabase.functions.invoke('send-notification', {
        body: { action: 'mark_read', userId: currentUser.id, markAll: true },
      }).catch(() => {});
    }
  }, [currentUser.id]);

  const generateLocalId = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let id = 'local_';
    for (let i = 0; i < 20; i++) {
      id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return id;
  };

  const signup = useCallback(async (name: string, email: string, password: string, bio?: string, city?: string): Promise<{ success: boolean; error?: string }> => {
    logoutIntentionalRef.current = false; // Reset: user is actively signing up
    try {

      let storedEmail: string | null = null;
      try { storedEmail = await storage.get('spotme_email'); } catch {}

      if (storedEmail === email) {
        try {
          const storedUser = await storage.get('spotme_user');
          if (storedUser) {
            const user = JSON.parse(storedUser);
            setCurrentUser(user);
            setIsLoggedIn(true);
            return { success: true };
          }
        } catch {}
      }

      const avatarIndex = Math.floor(Math.random() * 8);
      const avatarUrls = [
        'https://d64gsuwffb70l.cloudfront.net/698fe0b37fe9438e65b48d58_1771037056297_f9a83069.png',
        'https://d64gsuwffb70l.cloudfront.net/698fe0b37fe9438e65b48d58_1771037056573_451fb65f.png',
        'https://d64gsuwffb70l.cloudfront.net/698fe0b37fe9438e65b48d58_1771037041799_20c595bd.jpg',
        'https://d64gsuwffb70l.cloudfront.net/698fe0b37fe9438e65b48d58_1771037064960_2d7609c5.png',
        'https://d64gsuwffb70l.cloudfront.net/698fe0b37fe9438e65b48d58_1771037049254_f950ccb1.png',
        'https://d64gsuwffb70l.cloudfront.net/698fe0b37fe9438e65b48d58_1771037060145_0ca59f8e.png',
        'https://d64gsuwffb70l.cloudfront.net/698fe0b37fe9438e65b48d58_1771037062543_b10ff8a6.png',
        'https://d64gsuwffb70l.cloudfront.net/698fe0b37fe9438e65b48d58_1771037046421_52a3035d.jpg',
      ];

      const localUser: User = {
        id: generateLocalId(),
        name: (name && name.trim()) ? name.trim() : 'SpotMe User',
        avatar: avatarUrls[avatarIndex] || '',
        bio: (bio && bio.trim()) ? bio.trim() : '',
        city: (city && city.trim()) ? city.trim() : '',
        joinedDate: new Date().toISOString(),
        totalRaised: 0,
        totalGiven: 0,
        verified: false,
      };

      try {
        await storage.set('spotme_user', JSON.stringify(localUser));
        await storage.set('spotme_email', email);
        await storage.set('spotme_pass', password);
      } catch {}

      setCurrentUser(localUser);
      setIsLoggedIn(true);

      try {
        setNotifications(prev => [{
          id: `not_${Date.now()}`,
          type: 'welcome' as const,
          title: 'Welcome to SpotMe!',
          message: `Hey ${localUser.name}! You're in. Start by browsing Needs or creating your own.`,
          timestamp: new Date().toISOString(),
          read: false,
        }, ...prev]);
      } catch {}

      setTimeout(async () => {
        try {
          const { data } = await supabase.functions.invoke('process-contribution', {
            body: { action: 'create_profile', name: localUser.name, email, password, bio: localUser.bio, city: localUser.city },
          });
          if (data?.success && data.profile) {
            const syncedUser: User = {
              id: data.profile.id,
              name: data.profile.name || localUser.name,
              avatar: data.profile.avatar || localUser.avatar,
              bio: data.profile.bio || localUser.bio,
              city: data.profile.city || localUser.city,
              joinedDate: data.profile.joinedDate || localUser.joinedDate,
              totalRaised: 0, totalGiven: 0, verified: false,
            };
            try { await storage.set('spotme_user', JSON.stringify(syncedUser)); } catch {}
            setCurrentUser(syncedUser);
          }
        } catch {}
      }, 3000);

      return { success: true };
    } catch (err: any) {
      return { success: false, error: `Signup failed: ${err?.message || 'Unknown error'}` };
    }
  }, []);

  const login = useCallback(async (name: string, email: string, password?: string): Promise<{ success: boolean; error?: string }> => {
    logoutIntentionalRef.current = false; // Reset: user is actively logging in
    try {

      let storedEmail: string | null = null;
      let storedPass: string | null = null;
      let storedUser: string | null = null;
      
      try {
        storedEmail = await storage.get('spotme_email');
        storedPass = await storage.get('spotme_pass');
        storedUser = await storage.get('spotme_user');
      } catch {}

      if (storedEmail === email && storedUser) {
        if (password && storedPass && storedPass !== password) {
          return { success: false, error: 'Incorrect password' };
        }
        try {
          const user = JSON.parse(storedUser);
          setCurrentUser(user);
          setIsLoggedIn(true);
          return { success: true };
        } catch {}
      }

      try {
        const { data, error: serverError } = await safeInvoke('process-contribution', {
          body: { action: 'login', email },
        }, 8000);

        if (!serverError && data?.success && data.profile) {
          const user: User = {
            id: data.profile.id,
            name: data.profile.name || name || 'SpotMe User',
            avatar: data.profile.avatar || '',
            bio: data.profile.bio || '',
            city: data.profile.city || '',
            joinedDate: data.profile.joinedDate || new Date().toISOString(),
            totalRaised: data.profile.totalRaised || 0,
            totalGiven: data.profile.totalGiven || 0,
            verified: data.profile.verified || false,
          };
          try {
            await storage.set('spotme_user', JSON.stringify(user));
            await storage.set('spotme_email', email);
            if (password) await storage.set('spotme_pass', password);
          } catch {}
          setCurrentUser(user);
          setIsLoggedIn(true);
          return { success: true };
        }
      } catch {}

      const result = await signup(name || 'SpotMe User', email, password || 'default123');
      return result;
    } catch (err: any) {
      return { success: false, error: `Login failed: ${err?.message || 'Unknown error'}` };
    }
  }, [signup]);

  const logout = useCallback(async () => {
    // Mark as intentional so the auth recovery guard doesn't fight the logout
    logoutIntentionalRef.current = true;

    if (pushEnabled && currentUser.id !== 'guest') {
      try {
        const reg = await navigator.serviceWorker?.ready;
        const sub = await reg?.pushManager?.getSubscription();
        if (sub) {
          await supabase.functions.invoke('send-notification', {
            body: { action: 'unsubscribe', endpoint: sub.endpoint, userId: currentUser.id },
          });
        }
      } catch {}
    }
    setIsLoggedIn(false);
    setCurrentUser(GUEST_USER);
    setPushEnabled(false);
    setPayoutStatus(null);
    setCart([]);
    setSavedNeeds([]);
    clearAllPendingNeeds(); // Clear any pending needs from localStorage on logout
    await storage.remove('spotme_user');
    await storage.remove('spotme_email');
    await storage.remove('spotme_pass');
    await storage.remove('spotme_cart');
    await storage.remove('spotme_saved_needs');
  }, [pushEnabled, currentUser.id]);


  const updateProfile = useCallback(async (updates: Partial<User>) => {
    setCurrentUser(prev => {
      const updated = { ...prev, ...updates };
      storage.set('spotme_user', JSON.stringify(updated));
      return updated;
    });

    if (currentUser.id !== 'guest') {
      try {
        await supabase.functions.invoke('process-contribution', {
          body: { action: 'update_profile', profileId: currentUser.id, updates },
        });
      } catch {}
    }
  }, [currentUser.id]);

  const subscribeToPush = useCallback(async (): Promise<boolean> => {
    if (Platform.OS !== 'web') return false;
    try {
      if (!('Notification' in window) || !('serviceWorker' in navigator)) return false;
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return false;

      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      
      if (!subscription) {
        const vapidPublicKey = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkOs-qy19yPMis-YcUfhKBKzmOoZALNpOBRmOYlnOs';
        try {
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
          });
        } catch {
          setPushEnabled(true);
          if (currentUser.id !== 'guest') {
            await supabase.functions.invoke('send-notification', {
              body: { action: 'subscribe', userId: currentUser.id, subscription: { endpoint: `local-${currentUser.id}`, keys: { p256dh: '', auth: '' } } },
            });
          }
          return true;
        }
      }

      const subJson = subscription.toJSON();
      await supabase.functions.invoke('send-notification', {
        body: { action: 'subscribe', userId: currentUser.id !== 'guest' ? currentUser.id : null, subscription: { endpoint: subJson.endpoint, keys: subJson.keys } },
      });
      setPushEnabled(true);
      return true;
    } catch { return false; }
  }, [currentUser.id]);

  const unsubscribeFromPush = useCallback(async () => {
    if (Platform.OS !== 'web') return;
    try {
      const registration = await navigator.serviceWorker?.ready;
      const subscription = await registration?.pushManager?.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
        await supabase.functions.invoke('send-notification', {
          body: { action: 'unsubscribe', endpoint: subscription.endpoint, userId: currentUser.id },
        });
      }
      setPushEnabled(false);
    } catch {}
  }, [currentUser.id]);

  const getFilteredNeeds = useCallback(() => {
    let filtered = needs.filter(n => !blockedUsers.includes(n.userId));
    if (selectedCategory !== 'All') {
      filtered = filtered.filter(n => n.category === selectedCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(n =>
        n.title.toLowerCase().includes(q) ||
        n.message.toLowerCase().includes(q) ||
        (n.userName || '').toLowerCase().includes(q) ||
        n.category.toLowerCase().includes(q)
      );
    }
    return filtered;
  }, [needs, blockedUsers, selectedCategory, searchQuery]);

  // ---- FAILED PAYMENTS ----
  const fetchFailedPayments = useCallback(async () => {
    if (currentUser.id === 'guest') return;
    try {
      const { data } = await supabase.functions.invoke('stripe-checkout', {
        body: { action: 'fetch_failed_payments', userId: currentUser.id },
      });
      if (data?.success) setFailedPayments(data.failedPayments || []);
    } catch {}
  }, [currentUser.id]);

  const retryPayment = useCallback(async (failedPaymentId: string): Promise<PaymentResult> => {
    try {
      const { data, error } = await supabase.functions.invoke('stripe-checkout', {
        body: { action: 'retry_payment', failedPaymentId, userId: currentUser.id },
      });
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || 'Retry failed');

      if (data.clientSecret && data.mode === 'stripe') {
        if (Platform.OS === 'web') {
          const fp = failedPayments.find(p => p.id === failedPaymentId);
          const checkoutParams = new URLSearchParams({
            client_secret: data.clientSecret,
            payment_id: data.paymentId || '',
            amount: String(fp?.amount || 0),
            need_title: fp?.needTitle || 'Retry Payment',
            destination_charge: String(!!data.destinationCharge),
            application_fee: String(data.applicationFee || 0),
          });
          if (data.stripeAccount) checkoutParams.set('stripe_account', data.stripeAccount);
          window.location.href = `/payment-checkout?${checkoutParams.toString()}`;
        }
        return { success: true, paymentId: data.paymentId, clientSecret: data.clientSecret, mode: 'stripe_connect' };
      }

      setFailedPayments(prev => prev.filter(p => p.id !== failedPaymentId));
      setTimeout(() => fetchNeedsSilent(), 1500);
      return { success: true, paymentId: data.paymentId, mode: 'direct' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Retry failed' };
    }
  }, [currentUser.id, failedPayments]);

  // ---- PAYOUT DASHBOARD ----
  const fetchPayoutDashboard = useCallback(async () => {
    if (currentUser.id === 'guest') return;
    try {
      const { data } = await supabase.functions.invoke('stripe-checkout', {
        body: { action: 'fetch_payout_dashboard', userId: currentUser.id },
      });
      if (data?.success) setPayoutDashboard(data.dashboard);
    } catch {}
  }, [currentUser.id]);

  // ---- RECEIPTS ----
  const fetchReceipts = useCallback(async () => {
    if (currentUser.id === 'guest') return;
    try {
      const { data } = await supabase.functions.invoke('process-contribution', {
        body: { action: 'fetch_receipts', userId: currentUser.id },
      });
      if (data?.success) setReceipts(data.receipts || []);
    } catch {}
  }, [currentUser.id]);

  // ---- TRUST SCORE ----
  const fetchTrustScore = useCallback(async (): Promise<TrustScoreDetails | null> => {
    if (currentUser.id === 'guest') return null;
    try {
      const { data } = await supabase.functions.invoke('process-contribution', {
        body: { action: 'fetch_trust_score', userId: currentUser.id },
      });
      if (data?.success) {
        const details: TrustScoreDetails = {
          score: data.trustScore,
          level: data.trustLevel,
          factors: data.factors,
          profile: data.profile,
        };
        setTrustScoreDetails(details);
        setCurrentUser(prev => {
          const updated = { ...prev, trustScore: data.trustScore, trustLevel: data.trustLevel };
          storage.set('spotme_user', JSON.stringify(updated));
          return updated;
        });
        return details;
      }
    } catch {}
    return null;
  }, [currentUser.id]);

  const verifyNeed = useCallback(async (needId: string, action: string, notes?: string): Promise<boolean> => {
    try {
      const { data } = await supabase.functions.invoke('process-contribution', {
        body: { action: 'verify_need', needId, reviewerId: currentUser.id, verificationAction: action, notes },
      });
      if (data?.success) {
        setNeeds(prev => prev.map(n => n.id === needId ? { ...n, verificationStatus: data.newStatus } : n));
        return true;
      }
    } catch {}
    return false;
  }, [currentUser.id]);

  const reportNeedTracked = useCallback(async (needId: string, reason: string, details?: string): Promise<boolean> => {
    try {
      const need = needs.find(n => n.id === needId);
      const { data } = await supabase.functions.invoke('process-contribution', {
        body: { action: 'report', reporterId: currentUser.id !== 'guest' ? currentUser.id : null, needId, userId: need?.userId, reason, details },
      });
      reportNeed(needId, reason);
      return data?.success || false;
    } catch {
      reportNeed(needId, reason);
      return false;
    }
  }, [currentUser.id, needs, reportNeed]);

  const createThankYou = useCallback((needId: string, message: string, videoUrl?: string, photoUrl?: string) => {
    const need = needs.find(n => n.id === needId);
    if (!need) return;
    const newUpdate: ThankYouUpdate = {
      id: `ty_${Date.now()}`,
      userId: currentUser.id,
      userName: currentUser.name,
      userAvatar: currentUser.avatar,
      needId,
      needTitle: need.title,
      message,
      videoUrl,
      photoUrl,
      pinned: true,
      createdAt: new Date().toISOString(),
      likes: 0,
    };
    setThankYouUpdates(prev => [newUpdate, ...prev]);
    setNotifications(prev => [{
      id: `not_${Date.now()}`,
      type: 'welcome' as const,
      title: 'Thank You Posted!',
      message: `Your thank you update for "${need.title}" is now live on your profile.`,
      timestamp: new Date().toISOString(),
      read: false,
      needId,
    }, ...prev]);
  }, [currentUser, needs]);

  const togglePinUpdate = useCallback((updateId: string) => {
    setThankYouUpdates(prev => prev.map(u => u.id === updateId ? { ...u, pinned: !u.pinned } : u));
  }, []);

  const likeUpdate = useCallback((updateId: string) => {
    setThankYouUpdates(prev => prev.map(u => u.id === updateId ? { ...u, likes: u.likes + 1 } : u));
  }, []);

  const unreadNotificationCount = notifications.filter(n => !n.read).length;
  const cartTotal = cart.reduce((sum, item) => sum + item.amount, 0);

  const addToCart = useCallback((item: Omit<CartItem, 'addedAt'>) => {
    setCart(prev => {
      const exists = prev.find(c => c.needId === item.needId);
      const newCart = exists
        ? prev.map(c => c.needId === item.needId ? { ...item, addedAt: new Date().toISOString() } : c)
        : [...prev, { ...item, addedAt: new Date().toISOString() }];
      storage.set('spotme_cart', JSON.stringify(newCart)).catch(() => {});
      return newCart;
    });
  }, []);

  const removeFromCart = useCallback((needId: string) => {
    setCart(prev => {
      const newCart = prev.filter(c => c.needId !== needId);
      storage.set('spotme_cart', JSON.stringify(newCart)).catch(() => {});
      return newCart;
    });
  }, []);

  const updateCartItem = useCallback((needId: string, updates: Partial<CartItem>) => {
    setCart(prev => {
      const newCart = prev.map(c => c.needId === needId ? { ...c, ...updates } : c);
      storage.set('spotme_cart', JSON.stringify(newCart)).catch(() => {});
      return newCart;
    });
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
    storage.remove('spotme_cart').catch(() => {});
  }, []);

  const isInCart = useCallback((needId: string) => {
    return cart.some(c => c.needId === needId);
  }, [cart]);

  const resetPassword = useCallback(async (email: string, newPassword: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const storedEmail = await storage.get('spotme_email');
      if (storedEmail === email) {
        await storage.set('spotme_pass', newPassword);
        return { success: true };
      }
      try {
        const { data } = await safeInvoke('process-contribution', {
          body: { action: 'login', email },
        }, 8000);
        if (data?.success && data.profile) {
          await storage.set('spotme_email', email);
          await storage.set('spotme_pass', newPassword);
          return { success: true };
        }
      } catch {}
      return { success: false, error: 'No account found with that email address.' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Password reset failed' };
    }
  }, []);

  const saveNeed = useCallback((needId: string) => {
    setSavedNeeds(prev => {
      if (prev.includes(needId)) return prev;
      const updated = [...prev, needId];
      storage.set('spotme_saved_needs', JSON.stringify(updated)).catch(() => {});
      return updated;
    });
  }, []);

  const unsaveNeed = useCallback((needId: string) => {
    setSavedNeeds(prev => {
      const updated = prev.filter(id => id !== needId);
      storage.set('spotme_saved_needs', JSON.stringify(updated)).catch(() => {});
      return updated;
    });
  }, []);

  const isSaved = useCallback((needId: string) => {
    return savedNeeds.includes(needId);
  }, [savedNeeds]);

  const editNeed = useCallback(async (needId: string, updates: { title?: string; message?: string; photo?: string; goalAmount?: number }): Promise<boolean> => {
    try {
      // Use safeInvoke to ensure local API handler is used (bypasses potentially broken supabase.functions override)
      const { data, error } = await safeInvoke('process-contribution', {
        body: { action: 'edit_need', needId, userId: currentUser.id, ...updates },
      });
      if (error || !data?.success) return false;
      setNeeds(prev => prev.map(n => {
        if (n.id === needId) {
          return {
            ...n,
            ...(updates.title !== undefined && { title: updates.title }),
            ...(updates.message !== undefined && { message: updates.message }),
            ...(updates.photo !== undefined && { photo: updates.photo }),
            ...(updates.goalAmount !== undefined && { goalAmount: updates.goalAmount }),
            updatedAt: new Date().toISOString(),
          };
        }
        return n;
      }));
      setTimeout(() => fetchNeedsSilent(), 1000);
      return true;
    } catch { return false; }
  }, [currentUser.id]);


  const deleteNeed = useCallback(async (needId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const need = needs.find(n => n.id === needId);
      if (!need) return { success: false, error: 'Need not found' };
      if (need.userId !== currentUser.id && need.userId !== 'current') {
        return { success: false, error: 'You can only delete your own needs' };
      }
      if (need.raisedAmount > 0) {
        return { success: false, error: 'Cannot delete a need that has received contributions. Contact support for help.' };
      }

      // Mark as deleted FIRST so polling won't bring it back
      markNeedDeleted(needId);

      const isLocalOnly = needId.startsWith('n_') || needId.startsWith('local_');

      if (isLocalOnly) {
        console.log('[deleteNeed] Local-only need, removing from state + pending cache:', needId);
        setNeeds(prev => prev.filter(n => n.id !== needId));
        removePendingNeed(needId);
        setNotifications(prev => [{
          id: `not_${Date.now()}`, type: 'welcome' as const, title: 'Need Deleted',
          message: `Your need "${need.title}" has been removed.`,
          timestamp: new Date().toISOString(), read: false,
        }, ...prev]);
        return { success: true };
      }

      const { data, error } = await safeInvoke('process-contribution', {
        body: { action: 'delete_need', needId, userId: currentUser.id },
      });
      
      if (error || !data?.success) {
        // Still remove locally since we marked it deleted
        setNeeds(prev => prev.filter(n => n.id !== needId));
        return { success: true };
      }

      setNeeds(prev => prev.filter(n => n.id !== needId));
      setNotifications(prev => [{
        id: `not_${Date.now()}`, type: 'welcome' as const, title: 'Need Deleted',
        message: `Your need "${need.title}" has been removed.`,
        timestamp: new Date().toISOString(), read: false,
      }, ...prev]);
      return { success: true };
    } catch (err: any) {
      // Still remove locally since we already marked it deleted
      setNeeds(prev => prev.filter(n => n.id !== needId));
      return { success: true };
    }
  }, [currentUser.id, needs]);




  const fetchActivity = useCallback(async () => {
    try {
      const { data, error } = await safeInvoke('process-contribution', {
        body: { action: 'fetch_activity', limit: 30 },
      }, 8000);
      if (!error && data?.success && data.activities) setActivityFeed(data.activities);
    } catch {}
  }, []);

  // ---- OFFLINE SYNC EXECUTOR ----
  const syncOfflineActionsInternal = async () => {
    if (isSyncing || isOffline) return;
    const queue = offlineManager.getQueue();
    if (queue.length === 0) return;

    setIsSyncing(true);
    const result = await offlineManager.syncQueue(async (action: QueuedAction) => {
      if (action.type === 'contribution') {
        const { data, error } = await safeInvoke('process-contribution', {
          body: { action: 'contribute', ...action.payload },
        }, 10000);
        return !error && data?.success;
      }
      if (action.type === 'create_need') {
        const { data, error } = await safeInvoke('process-contribution', {
          body: { action: 'create_need', ...action.payload },
        }, 10000);
        return !error && data?.success;
      }
      return false;
    });

    setIsSyncing(false);
    setPendingActions(offlineManager.pendingCount);
    if (result.synced > 0) fetchNeedsSilent();
  };
  const syncOfflineActions = useCallback(async () => {
    await syncOfflineActionsInternal();
  }, [isSyncing, isOffline]);

  // ---- NEW: BANK INFO ----
  const [bankInfo, setBankInfo] = useState<BankInfo | null>(null);
  const [autoExpireLastRun, setAutoExpireLastRun] = useState<string | null>(null);

  const fetchBankInfo = useCallback(async (): Promise<BankInfo | null> => {
    if (currentUser.id === 'guest') return null;
    try {
      const { data } = await supabase.functions.invoke('stripe-connect', {
        body: { action: 'get_bank_info', userId: currentUser.id },
      });
      if (data?.success && data.bankInfo) {
        setBankInfo(data.bankInfo);
        return data.bankInfo;
      }
    } catch {}
    return null;
  }, [currentUser.id]);

  const resendPayoutReceipt = useCallback(async (payoutId: string, email?: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('stripe-checkout', {
        body: { action: 'resend_payout_receipt', payoutId, userId: currentUser.id, email },
      });
      if (error || !data?.success) return { success: false, error: data?.error || 'Failed to send receipt' };
      return { success: true, sentTo: data.sentTo };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to send receipt' };
    }
  }, [currentUser.id]);

  const triggerAutoExpire = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke('auto-expire', {
        body: { triggered_by: 'manual' },
      });
      if (error) return { success: false, error: error.message };
      if (data?.success) {
        setAutoExpireLastRun(new Date().toISOString());
        if (data.expiredCount > 0) setTimeout(() => fetchNeedsSilent(), 1000);
        return { success: true, expiredCount: data.expiredCount, emailsSent: data.emailsSent };
      }
      return { success: false, error: 'Unknown error' };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }, []);

  const openStripeDashboard = useCallback(async () => {
    if (currentUser.id === 'guest') return { success: false, error: 'Please sign in first' };
    try {
      const { data, error } = await supabase.functions.invoke('stripe-connect', {
        body: { action: 'create_login_link', userId: currentUser.id },
      });
      if (error || !data?.success) return { success: false, error: data?.error || 'Could not create dashboard link' };
      if (Platform.OS === 'web' && data.loginUrl) window.open(data.loginUrl, '_blank');
      return { success: true, loginUrl: data.loginUrl };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }, [currentUser.id]);

  // Auto-expire cron: trigger every 5 minutes from client
  const autoExpireRef = useRef<any>(null);
  useEffect(() => {
    const runAutoExpire = async () => {
      try { await safeInvoke('auto-expire', { body: { triggered_by: 'client_cron' } }, 10000); } catch {}
    };
    runAutoExpire();
    autoExpireRef.current = setInterval(runAutoExpire, 5 * 60 * 1000);
    return () => clearInterval(autoExpireRef.current);
  }, []);

  // ---- AUTO-PAYOUT SYSTEM ----
  const [autoPayoutEnabled, setAutoPayoutEnabledState] = useState(false);
  const [refundablePayments, setRefundablePayments] = useState<any[]>([]);

  // Load auto-payout preference
  useEffect(() => {
    (async () => {
      try {
        const val = await storage.get('spotme_auto_payout');
        if (val === 'true') setAutoPayoutEnabledState(true);
      } catch {}
    })();
  }, []);

  const setAutoPayoutEnabled = useCallback((enabled: boolean) => {
    setAutoPayoutEnabledState(enabled);
    storage.set('spotme_auto_payout', String(enabled)).catch(() => {});
    // Also notify server
    if (currentUser.id !== 'guest') {
      supabase.functions.invoke('stripe-checkout', {
        body: { action: 'set_auto_payout', userId: currentUser.id, enabled },
      }).catch(() => {});
    }
  }, [currentUser.id]);

  // Process auto-payouts for all eligible needs
  const processAutoPayouts = useCallback(async () => {
    if (currentUser.id === 'guest') return { success: false, error: 'Please sign in first' };
    try {
      const { data, error } = await supabase.functions.invoke('stripe-checkout', {
        body: { action: 'process_auto_payouts', userId: currentUser.id },
      });
      if (error) return { success: false, error: error.message };
      if (data?.success) {
        // Update local needs state
        if (data.results && data.results.length > 0) {
          const paidNeedIds = data.results.filter((r: any) => r.success).map((r: any) => r.needId);
          setNeeds(prev => prev.map(n =>
            paidNeedIds.includes(n.id) ? { ...n, status: 'Payout Requested' as const } : n
          ));
          // Add notifications
          for (const result of data.results.filter((r: any) => r.success)) {
            setNotifications(prev => [{
              id: `not_autopay_${Date.now()}_${result.needId}`,
              type: 'payout' as const,
              title: 'Auto-Payout Processed',
              message: `Payout of $${result.amount} for "${result.needTitle}" has been automatically submitted.`,
              timestamp: new Date().toISOString(),
              read: false,
              needId: result.needId,
            }, ...prev]);
          }
          setTimeout(() => fetchNeedsSilent(), 2000);
        }
        return {
          success: true,
          processed: data.processed || 0,
          errors: data.errors || 0,
          results: data.results || [],
        };
      }
      return { success: false, error: data?.error || 'Auto-payout failed' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Auto-payout failed' };
    }
  }, [currentUser.id]);

  // Auto-payout check: runs every 2 minutes when enabled
  const autoPayoutRef = useRef<any>(null);
  useEffect(() => {
    if (!autoPayoutEnabled || !isLoggedIn || currentUser.id === 'guest') {
      if (autoPayoutRef.current) clearInterval(autoPayoutRef.current);
      return;
    }
    // Run immediately
    processAutoPayouts();
    // Then every 2 minutes
    autoPayoutRef.current = setInterval(processAutoPayouts, 2 * 60 * 1000);
    return () => clearInterval(autoPayoutRef.current);
  }, [autoPayoutEnabled, isLoggedIn, currentUser.id]);

  // ---- REFUND MANAGEMENT ----
  const processRefund = useCallback(async (
    paymentId: string, amount: number, reason: string, note?: string
  ): Promise<{ success: boolean; refundId?: string; error?: string }> => {
    if (currentUser.id === 'guest') return { success: false, error: 'Please sign in first' };
    try {
      const { data, error } = await supabase.functions.invoke('stripe-checkout', {
        body: {
          action: 'process_refund',
          userId: currentUser.id,
          paymentId,
          amount,
          reason,
          note,
        },
      });
      if (error) return { success: false, error: error.message };
      if (data?.success) {
        // Refresh needs to reflect refund
        setTimeout(() => fetchNeedsSilent(), 1500);
        setNotifications(prev => [{
          id: `not_refund_${Date.now()}`,
          type: 'payout' as const,
          title: 'Refund Processed',
          message: `Refund of $${amount.toFixed(2)} has been processed.`,
          timestamp: new Date().toISOString(),
          read: false,
        }, ...prev]);
        return { success: true, refundId: data.stripeRefundId || data.refundId };
      }
      return { success: false, error: data?.error || 'Refund failed' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Refund failed' };
    }
  }, [currentUser.id]);

  const fetchRefundablePayments = useCallback(async () => {
    if (currentUser.id === 'guest') return [];
    try {
      const { data } = await supabase.functions.invoke('stripe-checkout', {
        body: { action: 'fetch_refundable_payments', userId: currentUser.id },
      });
      if (data?.success) {
        setRefundablePayments(data.payments || []);
        return data.payments || [];
      }
    } catch {}
    return [];
  }, [currentUser.id]);

  // ---- EMAIL RECEIPT SYSTEM ----
  const [emailReceipts, setEmailReceipts] = useState<any[]>([]);

  const sendContributionReceiptInternal = useCallback(async (params: {
    paymentId?: string; paymentIntentId?: string; amount: number; tipAmount?: number;
    needTitle?: string; needId?: string; recipientName?: string;
  }, isResend = false) => {
    try {
      // Get user's email
      let email: string | null = null;
      try { email = await storage.get('spotme_email'); } catch {}
      if (!email && currentUser.id !== 'guest') {
        // Try to get from profile
        try {
          const { data: profileData } = await supabase.functions.invoke('process-contribution', {
            body: { action: 'login', email: '' },
          });
          email = profileData?.profile?.email || null;
        } catch {}
      }

      if (!email) {
        return { success: false, error: 'No email address found. Please update your profile with an email.' };
      }

      const safeAmount = Number(params.amount) || 0;
      const safeTip = Number(params.tipAmount) || 0;
      const totalCharged = safeAmount + safeTip;

      const { data, error } = await supabase.functions.invoke('send-notification', {
        body: {
          action: 'send_email_receipt',
          toEmail: email,
          contributorName: currentUser.name || 'SpotMe User',
          amount: safeAmount,
          tipAmount: safeTip,
          totalCharged,
          needTitle: params.needTitle || '',
          recipientName: params.recipientName || '',
          transactionRef: params.paymentIntentId || params.paymentId || '',
          date: new Date().toISOString(),
          needId: params.needId || '',
          paymentId: params.paymentId || null,
          paymentIntentId: params.paymentIntentId || null,
          receiptType: 'contribution',
          isResend,
        },
      });

      if (error) {
        console.error('[SpotMe] Receipt email error:', error);
        return { success: false, error: error.message || 'Failed to send receipt' };
      }

      return {
        success: true,
        emailSent: data?.emailSent || false,
        receiptNumber: data?.receiptNumber || '',
        error: data?.error || null,
      };
    } catch (err: any) {
      console.error('[SpotMe] Receipt email exception:', err);
      return { success: false, error: err.message || 'Failed to send receipt' };
    }
  }, [currentUser]);

  const sendContributionReceipt = useCallback(async (params: {
    paymentId?: string; paymentIntentId?: string; amount: number; tipAmount?: number;
    needTitle?: string; needId?: string; recipientName?: string;
  }) => {
    return sendContributionReceiptInternal(params, false);
  }, [sendContributionReceiptInternal]);

  const resendContributionReceipt = useCallback(async (params: {
    paymentId?: string; paymentIntentId?: string; amount: number; tipAmount?: number;
    needTitle?: string; needId?: string; recipientName?: string;
  }) => {
    return sendContributionReceiptInternal(params, true);
  }, [sendContributionReceiptInternal]);

  const fetchEmailReceiptHistory = useCallback(async () => {
    if (currentUser.id === 'guest') return [];
    try {
      const { data, error } = await supabase.functions.invoke('send-notification', {
        body: { action: 'fetch_receipt_history', userId: currentUser.id },
      });
      if (!error && data?.success) {
        setEmailReceipts(data.receipts || []);
        return data.receipts || [];
      }
    } catch {}
    return [];
  }, [currentUser.id]);

  return (
    <AppContext.Provider value={{
      needs, notifications, thankYouUpdates, currentUser, isLoggedIn, isLoading,
      pushEnabled, payoutStatus, failedPayments, payoutDashboard, receipts,
      trustScoreDetails, rateLimitError, cart, cartTotal, savedNeeds, activityFeed,
      searchQuery, selectedCategory, isOffline, pendingActions, isSyncing,
      syncOfflineActions, contribute, contributeWithPayment, spreadWithPayment,
      createNeed, editNeed, deleteNeed, requestPayout, reportNeed, blockUser,
      markNotificationRead, markAllNotificationsRead, setSearchQuery, setSelectedCategory,
      login, signup, logout, updateProfile, getFilteredNeeds, unreadNotificationCount,
      refreshNeeds, fetchActivity, subscribeToPush, unsubscribeFromPush, setupPayouts,
      checkPayoutStatus, completePayoutOnboarding, fetchFailedPayments, retryPayment,
      fetchPayoutDashboard, fetchReceipts, fetchTrustScore, verifyNeed, reportNeedTracked,
      createThankYou, togglePinUpdate, likeUpdate, addToCart, removeFromCart, updateCartItem,
      clearCart, isInCart, resetPassword, saveNeed, unsaveNeed, isSaved,
      checkAndExpireNeeds, isNeedExpired,
      fetchBankInfo, resendPayoutReceipt, triggerAutoExpire, openStripeDashboard,
      bankInfo, autoExpireLastRun,
      autoPayoutEnabled, setAutoPayoutEnabled, processAutoPayouts,
      processRefund, fetchRefundablePayments, refundablePayments,
      sendContributionReceipt, resendContributionReceipt, fetchEmailReceiptHistory, emailReceipts,
    }}>
      {children}
    </AppContext.Provider>
  );
}





export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');

  // ── AUTH STATE RECOVERY (synchronous read-through) ──────────
  // If the React state shows "guest" but persistent storage still
  // holds a real user, return the stored user immediately so that
  // no child component ever flashes the logged-out UI.  The
  // useEffect guard inside AppProvider will reconcile the actual
  // React state on the next tick, but this gives us an instant
  // read-through so the very first render is already correct.
  if (!context.isLoggedIn && context.currentUser.id === 'guest') {
    try {
      let raw: string | null = null;
      if (Platform.OS === 'web') {
        try { raw = localStorage.getItem('spotme_user'); } catch {}
      }
      if (!raw) {
        raw = memoryStore['spotme_user'] || null;
      }
      if (raw) {
        const user = JSON.parse(raw);
        if (user && user.id && user.id !== 'guest') {
          // Return a patched context so this render cycle sees the real user
          return { ...context, currentUser: user, isLoggedIn: true };
        }
      }
    } catch {}
  }

  return context;
}


function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) { outputArray[i] = rawData.charCodeAt(i); }
  return outputArray;
}
