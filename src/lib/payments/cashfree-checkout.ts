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
        redirectTarget?: '_self' | '_blank' | '_top' | '_modal';
      }) => Promise<{ error?: { message?: string }; redirect?: boolean } | void>;
    };
  }
}

const CASHFREE_SCRIPT_SRC = 'https://sdk.cashfree.com/js/v3/cashfree.js';

export function loadCashfreeScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve(false);

    // 1. If already initialized on window, return true immediately
    if (typeof window.Cashfree === 'function') {
      return resolve(true);
    }

    const checkWindowCashfree = (maxWaitMs = 3000): Promise<boolean> => {
      const start = Date.now();
      return new Promise((res) => {
        const interval = setInterval(() => {
          if (typeof window.Cashfree === 'function') {
            clearInterval(interval);
            res(true);
          } else if (Date.now() - start > maxWaitMs) {
            clearInterval(interval);
            res(false);
          }
        }, 50);
      });
    };

    // 2. Check if a script element already exists
    const existing = document.querySelector<HTMLScriptElement>(`script[src*="cashfree"]`);
    if (existing) {
      checkWindowCashfree(2000).then((isReady) => {
        if (isReady) {
          resolve(true);
        } else {
          try {
            existing.remove();
          } catch {
            // Ignore
          }
          injectFreshScript();
        }
      });
      return;
    }

    injectFreshScript();

    function injectFreshScript() {
      const script = document.createElement('script');
      script.src = CASHFREE_SCRIPT_SRC;
      script.async = true;

      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        console.error('[Cashfree SDK] Script load timed out.');
        resolve(false);
      }, 10000);

      script.onload = async () => {
        if (timedOut) return;
        clearTimeout(timer);
        const isReady = await checkWindowCashfree(3000);
        resolve(isReady);
      };

      script.onerror = (e) => {
        if (timedOut) return;
        clearTimeout(timer);
        console.error('[Cashfree SDK] Failed to load script from CDN (check CSP/network):', e);
        try {
          script.remove();
        } catch {}
        resolve(false);
      };

      document.head.appendChild(script);
    }
  });
}

export interface InitiateCashfreeCheckoutParams {
  paymentSessionId: string;
  mode?: 'sandbox' | 'production';
  redirectTarget?: '_self' | '_blank' | '_top' | '_modal';
}

export async function initiateCashfreeCheckout({
  paymentSessionId,
  mode = 'sandbox',
  redirectTarget = '_self',
}: InitiateCashfreeCheckoutParams): Promise<void> {
  const isLoaded = await loadCashfreeScript();
  if (!isLoaded || typeof window.Cashfree !== 'function') {
    throw new Error(
      'Cashfree payment SDK could not be initialized. Please check your internet connection or disable ad-blockers and try again.'
    );
  }

  const cleanMode = (mode || 'sandbox').toLowerCase() === 'production' ? 'production' : 'sandbox';
  const cashfree = window.Cashfree({ mode: cleanMode });

  if (!cashfree || typeof cashfree.checkout !== 'function') {
    throw new Error('Cashfree checkout interface is not available.');
  }

  const checkoutResult = await cashfree.checkout({
    paymentSessionId,
    redirectTarget,
  });

  if (checkoutResult && typeof checkoutResult === 'object' && 'error' in checkoutResult && checkoutResult.error) {
    throw new Error(checkoutResult.error.message || 'Payment initiation failed.');
  }
}
