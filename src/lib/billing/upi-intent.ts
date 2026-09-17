/**
 * Saarvi Pro Direct UPI Intent & Deep-Link Utility
 * Generates standards-compliant, URL-encoded UPI URIs for direct payment apps
 * (PhonePe, Google Pay, Paytm) with universal fallback to generic UPI intent.
 */

export type UpiAppProvider = "PHONEPE" | "GOOGLE_PAY" | "PAYTM" | "QR_MANUAL" | "OTHER_UPI";

export const DEFAULT_SAARVI_UPI_VPA = process.env.UPI_VPA || "9036745164-3@axl";

export interface CreateUpiIntentOptions {
  provider: UpiAppProvider;
  plan: "monthly" | "yearly";
  amount: number;
  currency?: string; // Default: 'INR'
  payeeUpiId?: string; // Default: DEFAULT_SAARVI_UPI_VPA
  payeeName?: string; // Default: 'Saarvi'
  transactionReference: string;
}

export interface UpiIntentResult {
  provider: UpiAppProvider;
  intentUri: string;
  universalUri: string;
  payeeUpiId: string;
  amount: number;
  currency: string;
  transactionReference: string;
  formattedAmount: string;
}

/**
 * Validates whether a given string adheres to standard UPI Virtual Payment Address (VPA) syntax.
 * Example: saarvi@okhdfcbank, name@upi, user.name123@icici
 */
export function isValidUpiId(upiId: string): boolean {
  if (!upiId || typeof upiId !== "string") return false;
  const clean = upiId.trim();
  // Standard VPA regex: username@bankhandle (length between 3 and 100 characters)
  const upiRegex = /^[a-zA-Z0-9.\-_]{2,64}@[a-zA-Z0-9]{2,32}$/;
  return upiRegex.test(clean);
}

/**
 * Generates an authoritative, unique transaction reference string.
 * Example: SAARVI-UPI-K9A1B2C3
 */
export function generatePaymentReference(): string {
  const timestampPart = Date.now().toString(36).toUpperCase();
  const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `SAARVI-UPI-${timestampPart}${randomPart}`;
}

/**
 * Generates the app-specific deep link and standard universal UPI URI.
 */
export function createUpiPaymentIntent(options: CreateUpiIntentOptions): UpiIntentResult {
  const {
    provider,
    amount,
    currency = "INR",
    payeeUpiId = DEFAULT_SAARVI_UPI_VPA,
    payeeName = "Saarvi",
    transactionReference,
  } = options;

  if (amount <= 0) {
    throw new Error("Payment amount must be greater than zero.");
  }

  const effectivePayeeUpiId = payeeUpiId.trim();
  if (!isValidUpiId(effectivePayeeUpiId)) {
    throw new Error(`Invalid payee UPI ID format: "${payeeUpiId}".`);
  }

  // Common URL-encoded query parameters according to NPCI UPI specifications
  const params = new URLSearchParams({
    pa: effectivePayeeUpiId,
    pn: payeeName.trim(),
    am: amount.toFixed(2),
    cu: (options.currency || "INR").toUpperCase(),
    tn: transactionReference.trim(),
  });

  const queryString = params.toString();
  const universalUri = `upi://pay?${queryString}`;

  let intentUri = universalUri;

  switch (provider) {
    case "PHONEPE":
      // PhonePe custom scheme on Android/iOS; falls back to upi://pay on failure
      intentUri = `phonepe://pay?${queryString}`;
      break;
    case "GOOGLE_PAY":
      // Google Pay UPI deep link; falls back to upi://pay
      intentUri = `gpay://upi/pay?${queryString}`;
      break;
    case "PAYTM":
      // Paytm custom URI handler; falls back to upi://pay
      intentUri = `paytmmp://pay?${queryString}`;
      break;
    case "QR_MANUAL":
    case "OTHER_UPI":
    default:
      intentUri = universalUri;
      break;
  }

  return {
    provider,
    intentUri,
    universalUri,
    payeeUpiId: payeeUpiId.trim(),
    amount,
    currency,
    transactionReference,
    formattedAmount: `₹${amount}`,
  };
}

/**
 * Client-side detection of mobile touch environments capable of handling native app intents.
 */
export function isMobileDevice(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false;
  }
  return /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}
