import React, { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';
import { Platform } from 'react-native';
import { supabase } from './supabase';
import { Need, Notification, User, Contribution, Receipt, TrustScoreDetails, ThankYouUpdate, MOCK_NEEDS, MOCK_NOTIFICATIONS, MOCK_THANK_YOU_UPDATES, CURRENT_USER } from './data';



// Simple persistent storage for web/native
const storage = {
  async get(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      try { return localStorage.getItem(key); } catch { return null; }
    }
    return null;
  },
  async set(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      try { localStorage.setItem(key, value); } catch {}
    }
  },
  async remove(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      try { localStorage.removeItem(key); } catch {}
    }
  },
};

interface PaymentResult {
  success: boolean;
  paymentId?: string;
  checkoutUrl?: string;
  clientSecret?: string;
  mode?: 'stripe' | 'stripe_connect' | 'direct';
  destinationCharge?: boolean;
  applicationFee?: number;
  recipientReceives?: number;
  error?: string;
}

interface PayoutStatus {
  hasAccount: boolean;
  onboardingComplete: boolean;
  payoutsEnabled: boolean;
  accountId?: string;
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
  // Actions
  contribute: (needId: string, amount: number, note?: string) => void;
  contributeWithPayment: (needId: string, amount: number, note?: string, isAnonymous?: boolean) => Promise<PaymentResult>;
  spreadWithPayment: (allocations: any[], totalAmount: number, spreadMode: string, isAnonymous?: boolean) => Promise<PaymentResult>;
  createNeed: (need: Omit<Need, 'id' | 'userId' | 'userName' | 'userAvatar' | 'userCity' | 'status' | 'contributorCount' | 'contributions' | 'createdAt' | 'raisedAmount'>) => void;
  requestPayout: (needId: string) => void;
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


const AppContext = createContext<AppState | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [needs, setNeeds] = useState<Need[]>(MOCK_NEEDS);
  const [notifications, setNotifications] = useState<Notification[]>(MOCK_NOTIFICATIONS);
  const [thankYouUpdates, setThankYouUpdates] = useState<ThankYouUpdate[]>(MOCK_THANK_YOU_UPDATES);

  const [currentUser, setCurrentUser] = useState<User>(GUEST_USER);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
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
  const pollRef = useRef<any>(null);
  const dbReady = useRef(false);


  // Load user from storage on mount
  useEffect(() => {
    (async () => {
      try {
        const saved = await storage.get('spotme_user');
        if (saved) {
          const user = JSON.parse(saved);
          setCurrentUser(user);
          setIsLoggedIn(true);
        }
        if (Platform.OS === 'web' && 'Notification' in window) {
          setPushEnabled(Notification.permission === 'granted');
        }
      } catch {}
      await fetchNeeds();
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
      if (dbReady.current) {
        fetchNeedsSilent();
        if (isLoggedIn && currentUser.id !== 'guest') {
          fetchNotificationsSilent();
        }
      }
    }, 15000);
    return () => clearInterval(pollRef.current);
  }, [isLoggedIn, currentUser.id]);

  const fetchNeeds = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('process-contribution', {
        body: { action: 'fetch_needs' },
      });
      if (data?.success && data.needs?.length > 0) {
        setNeeds(data.needs);
        dbReady.current = true;
      }
    } catch (err) {
      console.log('Using local data (DB fetch failed)');
    }
  };

  const fetchNeedsSilent = async () => {
    try {
      const { data } = await supabase.functions.invoke('process-contribution', {
        body: { action: 'fetch_needs' },
      });
      if (data?.success && data.needs?.length > 0) {
        setNeeds(data.needs);
      }
    } catch {}
  };

  const fetchNotificationsSilent = async () => {
    try {
      const { data } = await supabase.functions.invoke('send-notification', {
        body: { action: 'fetch_notifications', userId: currentUser.id },
      });
      if (data?.success && data.notifications) {
        setNotifications(data.notifications);
      }
    } catch {}
  };

  const refreshNeeds = useCallback(async () => {
    await fetchNeeds();
  }, []);

  // ---- STRIPE CONNECT PAYMENT: Single Contribution ----
  const contributeWithPayment = useCallback(async (
    needId: string, amount: number, note?: string, isAnonymous?: boolean
  ): Promise<PaymentResult> => {
    try {
      const need = needs.find(n => n.id === needId);
      const returnUrl = Platform.OS === 'web' ? window.location.origin : 'https://spotme.app';

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
          returnUrl,
          type: 'contribution',
        },
      });

      if (error) throw new Error(error.message);

      if (data?.success) {
        // Stripe Connect mode - got clientSecret for PaymentIntent
        if (data.clientSecret && data.mode === 'stripe') {
          if (Platform.OS === 'web') {
            const checkoutParams = new URLSearchParams({
              client_secret: data.clientSecret,
              payment_id: data.paymentId || '',
              amount: String(amount),
              need_title: need?.title || '',
              destination_charge: String(!!data.destinationCharge),
              application_fee: String(data.applicationFee || 0),
              recipient_receives: String(data.recipientReceives || 0),
            });
            window.location.href = `/payment-checkout?${checkoutParams.toString()}`;
          }
          return {
            success: true,
            paymentId: data.paymentId,
            clientSecret: data.clientSecret,
            mode: 'stripe_connect',
            destinationCharge: data.destinationCharge,
            applicationFee: data.applicationFee,
            recipientReceives: data.recipientReceives,
          };
        }

        // Legacy Stripe Checkout redirect
        if (data.checkoutUrl && data.mode === 'stripe') {
          if (Platform.OS === 'web') {
            window.location.href = data.checkoutUrl;
          }
          return { success: true, paymentId: data.paymentId, checkoutUrl: data.checkoutUrl, mode: 'stripe' };
        }

        // Direct processing (Stripe not available)
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
        return { success: true, paymentId: data.paymentId, mode: 'direct' };
      }

      throw new Error(data?.error || 'Payment failed');
    } catch (err: any) {
      return { success: false, error: err.message || 'Payment failed' };
    }
  }, [currentUser, needs]);

  // ---- STRIPE CONNECT PAYMENT: Spread the Love ----
  const spreadWithPayment = useCallback(async (
    allocations: any[], totalAmount: number, spreadMode: string, isAnonymous?: boolean
  ): Promise<PaymentResult> => {
    try {
      const returnUrl = Platform.OS === 'web' ? window.location.origin : 'https://spotme.app';

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
          spreadAllocations: allocations,
        },
      });

      if (error) throw new Error(error.message);

      if (data?.success) {
        // Stripe Connect mode
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

        // Legacy redirect
        if (data.checkoutUrl && data.mode === 'stripe') {
          if (Platform.OS === 'web') {
            window.location.href = data.checkoutUrl;
          }
          return { success: true, paymentId: data.paymentId, checkoutUrl: data.checkoutUrl, mode: 'stripe' };
        }

        // Direct processing
        for (const alloc of allocations) {
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
  }, [currentUser]);

  // ---- PAYOUT SETUP (Stripe Connect Onboarding) ----
  const setupPayouts = useCallback(async (): Promise<{ success: boolean; onboardingUrl?: string; error?: string }> => {
    try {
      if (currentUser.id === 'guest') {
        return { success: false, error: 'Please sign in first' };
      }

      // Step 1: Create connected account if needed
      const { data: accountData, error: accountErr } = await supabase.functions.invoke('stripe-connect', {
        body: {
          action: 'create_account',
          userId: currentUser.id,
          email: `${currentUser.id}@spotme.app`,
          name: currentUser.name,
        },
      });

      if (accountErr || !accountData?.success) {
        throw new Error(accountData?.error || 'Failed to create payout account');
      }

      // If already onboarded, just return success
      if (accountData.onboardingComplete) {
        setPayoutStatus({
          hasAccount: true,
          onboardingComplete: true,
          payoutsEnabled: true,
          accountId: accountData.accountId,
        });
        return { success: true };
      }

      // Step 2: Create onboarding link
      const returnUrl = Platform.OS === 'web' ? window.location.origin : 'https://spotme.app';
      const { data: linkData, error: linkErr } = await supabase.functions.invoke('stripe-connect', {
        body: {
          action: 'create_onboarding_link',
          userId: currentUser.id,
          returnUrl: returnUrl + '/settings',
          refreshUrl: returnUrl + '/settings',
        },
      });

      if (linkErr || !linkData?.success) {
        // If onboarding link fails, just mark as complete (simplified flow)
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
    setNeeds(prev => prev.map(need => {
      if (need.id === needId) {
        const newRaised = Math.min(need.raisedAmount + amount, need.goalAmount);
        const newContribution: Contribution = {
          id: `c_${Date.now()}`,
          userId: currentUser.id,
          userName: currentUser.name,
          userAvatar: currentUser.avatar,
          amount,
          note,
          timestamp: new Date().toISOString(),
        };
        const isGoalMet = newRaised >= need.goalAmount;
        return {
          ...need,
          raisedAmount: newRaised,
          contributorCount: need.contributorCount + 1,
          contributions: [newContribution, ...need.contributions],
          status: isGoalMet ? 'Goal Met' as const : need.status,
        };
      }
      return need;
    }));

    const need = needs.find(n => n.id === needId);
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
      setTimeout(() => fetchNeedsSilent(), 1000);
    } catch (err) {
      console.log('Contribution saved locally, DB sync pending');
    }
  }, [currentUser, needs]);

  const createNeed = useCallback(async (needData: Omit<Need, 'id' | 'userId' | 'userName' | 'userAvatar' | 'userCity' | 'status' | 'contributorCount' | 'contributions' | 'createdAt' | 'raisedAmount'>) => {
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
      createdAt: new Date().toISOString(),
    };
    setNeeds(prev => [localNeed, ...prev]);

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
        },
      });
      if (data?.success && data.need) {
        setNeeds(prev => prev.map(n => n.id === localNeed.id ? data.need : n));
      }

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
      console.log('Need saved locally, DB sync pending');
    }
  }, [currentUser]);

  const requestPayout = useCallback(async (needId: string) => {
    setNeeds(prev => prev.map(need =>
      need.id === needId && need.status === 'Goal Met'
        ? { ...need, status: 'Payout Requested' as const }
        : need
    ));
    const newNotif: Notification = {
      id: `not_${Date.now()}`,
      type: 'payout',
      title: 'Payout Requested',
      message: 'Your payout request has been submitted. Processing takes 2-3 business days.',
      timestamp: new Date().toISOString(),
      read: false,
      needId,
    };
    setNotifications(prev => [newNotif, ...prev]);

    try {
      await supabase.functions.invoke('process-contribution', {
        body: { action: 'request_payout', needId },
      });
    } catch {}
  }, []);

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

  const signup = useCallback(async (name: string, email: string, password: string, bio?: string, city?: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { data, error } = await supabase.functions.invoke('process-contribution', {
        body: {
          action: 'create_profile',
          name,
          email,
          bio: bio || '',
          city: city || '',
        },
      });

      if (error || !data?.success) {
        return { success: false, error: data?.error || 'Signup failed' };
      }

      const user: User = {
        id: data.profile.id,
        name: data.profile.name,
        avatar: data.profile.avatar,
        bio: data.profile.bio,
        city: data.profile.city,
        joinedDate: data.profile.joinedDate,
        totalRaised: data.profile.totalRaised,
        totalGiven: data.profile.totalGiven,
        verified: data.profile.verified,
      };

      await storage.set('spotme_user', JSON.stringify(user));
      await storage.set('spotme_email', email);
      await storage.set('spotme_pass', password);

      setCurrentUser(user);
      setIsLoggedIn(true);

      setNotifications(prev => [{
        id: `not_${Date.now()}`,
        type: 'welcome' as const,
        title: 'Welcome to SpotMe!',
        message: `Hey ${name}! Thanks for joining. Start by browsing Needs or creating your own.`,
        timestamp: new Date().toISOString(),
        read: false,
      }, ...prev]);

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Signup failed' };
    }
  }, []);

  const login = useCallback(async (name: string, email: string, password?: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const storedEmail = await storage.get('spotme_email');
      const storedPass = await storage.get('spotme_pass');
      const storedUser = await storage.get('spotme_user');

      if (storedEmail === email && storedUser) {
        if (password && storedPass && storedPass !== password) {
          return { success: false, error: 'Incorrect password' };
        }
        const user = JSON.parse(storedUser);
        setCurrentUser(user);
        setIsLoggedIn(true);
        return { success: true };
      }

      const result = await signup(name || 'SpotMe User', email, password || 'default123');
      return result;
    } catch (err: any) {
      return { success: false, error: err.message || 'Login failed' };
    }
  }, [signup]);

  const logout = useCallback(async () => {
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
    await storage.remove('spotme_user');
    await storage.remove('spotme_email');
    await storage.remove('spotme_pass');
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
          body: {
            action: 'update_profile',
            profileId: currentUser.id,
            updates,
          },
        });
      } catch {}
    }
  }, [currentUser.id]);

  // ---- PUSH NOTIFICATION SUBSCRIPTION ----
  const subscribeToPush = useCallback(async (): Promise<boolean> => {
    if (Platform.OS !== 'web') return false;
    
    try {
      if (!('Notification' in window) || !('serviceWorker' in navigator)) {
        return false;
      }

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
              body: {
                action: 'subscribe',
                userId: currentUser.id,
                subscription: { endpoint: `local-${currentUser.id}`, keys: { p256dh: '', auth: '' } },
              },
            });
          }
          return true;
        }
      }

      const subJson = subscription.toJSON();
      await supabase.functions.invoke('send-notification', {
        body: {
          action: 'subscribe',
          userId: currentUser.id !== 'guest' ? currentUser.id : null,
          subscription: {
            endpoint: subJson.endpoint,
            keys: subJson.keys,
          },
        },
      });

      setPushEnabled(true);
      return true;
    } catch (err) {
      console.log('Push subscription failed:', err);
      return false;
    }
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
    } catch (err) {
      console.log('Push unsubscribe failed:', err);
    }
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
        n.userName.toLowerCase().includes(q) ||
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
      if (data?.success) {
        setFailedPayments(data.failedPayments || []);
      }
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
          window.location.href = `/payment-checkout?${checkoutParams.toString()}`;
        }
        return { success: true, paymentId: data.paymentId, clientSecret: data.clientSecret, mode: 'stripe_connect' };
      }

      // Direct mode
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
      if (data?.success) {
        setPayoutDashboard(data.dashboard);
      }
    } catch {}
  }, [currentUser.id]);

  // ---- RECEIPTS ----
  const fetchReceipts = useCallback(async () => {
    if (currentUser.id === 'guest') return;
    try {
      const { data } = await supabase.functions.invoke('process-contribution', {
        body: { action: 'fetch_receipts', userId: currentUser.id },
      });
      if (data?.success) {
        setReceipts(data.receipts || []);
      }
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

  // ---- VERIFY NEED (admin) ----
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

  // ---- REPORT NEED (tracked) ----
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

  // ---- THANK YOU UPDATES ----
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
    setThankYouUpdates(prev => prev.map(u =>
      u.id === updateId ? { ...u, pinned: !u.pinned } : u
    ));
  }, []);

  const likeUpdate = useCallback((updateId: string) => {
    setThankYouUpdates(prev => prev.map(u =>
      u.id === updateId ? { ...u, likes: u.likes + 1 } : u
    ));
  }, []);

  const unreadNotificationCount = notifications.filter(n => !n.read).length;


  return (
    <AppContext.Provider value={{
      needs,
      notifications,
      thankYouUpdates,
      currentUser,
      isLoggedIn,
      isLoading,
      pushEnabled,
      payoutStatus,
      failedPayments,
      payoutDashboard,
      receipts,
      trustScoreDetails,
      rateLimitError,
      searchQuery,
      selectedCategory,
      contribute,
      contributeWithPayment,
      spreadWithPayment,
      createNeed,
      requestPayout,
      reportNeed,
      blockUser,
      markNotificationRead,
      markAllNotificationsRead,
      setSearchQuery,
      setSelectedCategory,
      login,
      signup,
      logout,
      updateProfile,
      getFilteredNeeds,
      unreadNotificationCount,
      refreshNeeds,
      subscribeToPush,
      unsubscribeFromPush,
      setupPayouts,
      checkPayoutStatus,
      completePayoutOnboarding,
      fetchFailedPayments,
      retryPayment,
      fetchPayoutDashboard,
      fetchReceipts,
      fetchTrustScore,
      verifyNeed,
      reportNeedTracked,
      createThankYou,
      togglePinUpdate,
      likeUpdate,
    }}>
      {children}
    </AppContext.Provider>
  );
}





export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
}

// Helper to convert VAPID key
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
