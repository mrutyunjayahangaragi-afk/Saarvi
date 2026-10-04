/**
 * Client-Side Razorpay Checkout SDK Loader & Modal Controller
 *
 * Exposes supported payment methods provided by Razorpay:
 * - UPI (PhonePe, Google Pay, Paytm, BHIM, etc.)
 * - Debit Cards & Credit Cards (Visa, Mastercard, RuPay)
 * - Net Banking (All major Indian banks)
 * - Supported Wallets (Paytm, Mobikwik, etc.)
 *
 * NOTE: PhonePe appears seamlessly through Razorpay's native UPI flow.
 * No fake buttons or manual VPA forms are created.
 */

declare global {
  interface Window {
    Razorpay?: any;
  }
}

const RAZORPAY_SCRIPT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';

export function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve(false);
      return;
    }

    if (typeof window.Razorpay === 'function') {
      resolve(true);
      return;
    }

    const existingScript = document.querySelector(`script[src="${RAZORPAY_SCRIPT_SRC}"]`);
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(true));
      existingScript.addEventListener('error', () => resolve(false));
      return;
    }

    const script = document.createElement('script');
    script.src = RAZORPAY_SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => {
      console.error('[Razorpay SDK Load Error]: Failed to load checkout script.');
      resolve(false);
    };

    document.head.appendChild(script);
  });
}

export interface RazorpayCheckoutOptions {
  orderId: string;
  amount: number; // in paise (e.g. 9900 = ₹99)
  currency?: string;
  keyId: string;
  name?: string;
  description?: string;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  themeColor?: string;
  onSuccess: (response: {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
  }) => void | Promise<void>;
  onDismiss?: () => void;
  onError?: (error: any) => void;
}

export async function initiateRazorpayCheckout(
  options: RazorpayCheckoutOptions
): Promise<void> {
  const isLoaded = await loadRazorpayScript();
  if (!isLoaded || typeof window.Razorpay !== 'function') {
    throw new Error('Unable to initialize secure Razorpay checkout. Please check your internet connection.');
  }

  return new Promise((resolve, reject) => {
    try {
      const rzpConfig = {
        key: options.keyId,
        amount: options.amount,
        currency: options.currency || 'INR',
        name: options.name || 'Saarvi',
        description: options.description || 'Saarvi Pro (30 Days)',
        order_id: options.orderId,
        prefill: {
          name: options.prefill?.name || '',
          email: options.prefill?.email || '',
          contact: options.prefill?.contact || '',
        },
        theme: {
          color: options.themeColor || '#2563eb', // Saarvi Blue
        },
        modal: {
          ondismiss: () => {
            if (options.onDismiss) options.onDismiss();
            resolve();
          },
          confirm_close: true,
          animation: true,
        },
        handler: async (response: {
          razorpay_payment_id: string;
          razorpay_order_id: string;
          razorpay_signature: string;
        }) => {
          try {
            await options.onSuccess(response);
            resolve();
          } catch (handlerErr) {
            if (options.onError) options.onError(handlerErr);
            reject(handlerErr);
          }
        },
      };

      const rzpInstance = new window.Razorpay(rzpConfig);

      rzpInstance.on('payment.failed', function (resp: any) {
        console.warn('[Razorpay Payment Failed Notice]:', resp?.error);
        if (options.onError) {
          options.onError(resp?.error?.description || 'Payment was declined or cancelled.');
        }
      });

      rzpInstance.open();
    } catch (err) {
      console.error('[Razorpay Launch Error]:', err);
      if (options.onError) options.onError(err);
      reject(err);
    }
  });
}
