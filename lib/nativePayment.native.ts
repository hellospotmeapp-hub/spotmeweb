import { initStripe, initPaymentSheet, presentPaymentSheet } from '@stripe/stripe-react-native';
import { stripePublishableKey } from './config';
import Constants from 'expo-constants';

const scheme = String(Constants.expoConfig?.scheme || 'spotmeone');
let initialized = false;

// Collects payment for a PaymentIntent with Stripe's native PaymentSheet.
// The server still records the contribution once Stripe confirms it (webhook / verify_payment).
export async function payWithPaymentSheet(clientSecret: string): Promise<{ paid: boolean; canceled?: boolean; error?: string }> {
  if (!stripePublishableKey) return { paid: false, error: 'Payments are not configured in this build.' };
  if (!initialized) {
    await initStripe({ publishableKey: stripePublishableKey, urlScheme: scheme });
    initialized = true;
  }
  const init = await initPaymentSheet({
    merchantDisplayName: 'SpotMeOne',
    paymentIntentClientSecret: clientSecret,
    returnURL: `${scheme}://stripe-redirect`,
    allowsDelayedPaymentMethods: false,
  });
  if (init.error) return { paid: false, error: init.error.message };
  const result = await presentPaymentSheet();
  if (result.error) {
    if (result.error.code === 'Canceled') return { paid: false, canceled: true };
    return { paid: false, error: result.error.message };
  }
  return { paid: true };
}
