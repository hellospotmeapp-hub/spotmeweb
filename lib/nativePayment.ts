// Web uses the /payment-checkout page (Stripe.js); see nativePayment.native.ts for iOS/Android.
export async function payWithPaymentSheet(_clientSecret: string): Promise<{ paid: boolean; canceled?: boolean; error?: string }> {
  return { paid: false, error: 'Native payments are not available on web.' };
}
