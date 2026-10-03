/**
 * Client-Side Cashfree Web Checkout SDK Loader
 *
 * Dynamically loads the official Cashfree JS SDK v3
 * Never stores or transmits secrets.
 */

declare global {
  interface Window {
    Cashfree?: (config: { mode: 'sandbox' | 'production' }) => {
      checkout: (options: {
        paymentSessionId: string;
        redirectTarget?: '_self' | '_blank' | '_top';
      }) => Promise<void>;
    };
  }
}

export function loadCashfreeScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve(false);
    if (window.Cashfree) return resolve(true);

    const existing = document.querySelector('script[src*="cashfree"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(true));
      existing.addEventListener('error', () => resolve(false));
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://sdk.cashfree.com/js/v3/cashfree.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => {
      console.error('Failed to load Cashfree Checkout SDK');
      resolve(false);
    };
    document.body.appendChild(script);
  });
}

export interface InitiateCashfreeCheckoutParams {
  paymentSessionId: string;
  mode?: 'sandbox' | 'production';
}

export async function initiateCashfreeCheckout({
  paymentSessionId,
  mode = 'sandbox',
}: InitiateCashfreeCheckoutParams): Promise<void> {
  const isLoaded = await loadCashfreeScript();
  if (!isLoaded || !window.Cashfree) {
    throw new Error('Cashfree payment SDK could not be initialized.');
  }

  const cashfree = window.Cashfree({ mode });
  await cashfree.checkout({
    paymentSessionId,
    redirectTarget: '_self',
  });
}
