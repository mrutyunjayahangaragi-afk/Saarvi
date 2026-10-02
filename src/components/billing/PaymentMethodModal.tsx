'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Check,
  Copy,
  ExternalLink,
  QrCode,
  CreditCard,
  Smartphone,
  Clock,
  ShieldCheck,
  AlertCircle,
  Loader2,
  Sparkles,
  ArrowRight,
  RefreshCw,
  X,
  ChevronLeft,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { usePlan } from '@/hooks/usePlan';
import { PRO_PRICING, getPlanPrice } from '@/config/pricing';
import { BillingInterval } from '@/types/plan';
import { resolvePaymentQrImage } from '@/lib/billing/qr-resolver';
import {
  createUpiPaymentIntent,
  generatePaymentReference,
  isMobileDevice,
  UpiAppProvider,
} from '@/lib/billing/upi-intent';

// Dynamically load Razorpay checkout.js only when needed
function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve(false);
    if ((window as unknown as { Razorpay?: unknown }).Razorpay) return resolve(true);

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

interface PaymentConfigData {
  upiId: string;
  payeeName: string;
  amountMonthly: number;
  amountYearly: number;
  currency: string;
  qrCodeUrl?: string;
  reviewSlaHours: number;
  instructions?: string;
  supportEmail: string;
}

export type ModalStep = 'SELECT_METHOD' | 'RAZORPAY_FLOW' | 'UPI_FLOW' | 'UPI_SUCCESS' | 'RAZORPAY_SUCCESS';

interface PaymentMethodModalProps {
  isOpen: boolean;
  onClose: () => void;
  interval: BillingInterval;
  onSuccess?: () => void;
}

export function PaymentMethodModal({
  isOpen,
  onClose,
  interval,
  onSuccess,
}: PaymentMethodModalProps) {
  const { user } = useAuth();
  const { refreshPlan } = usePlan();
  const router = useRouter();

  const [step, setStep] = useState<ModalStep>('SELECT_METHOD');
  const [selectedMethod, setSelectedMethod] = useState<'razorpay' | 'upi'>('razorpay');

  // Config data for UPI
  const [config, setConfig] = useState<PaymentConfigData | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(false);

  // Razorpay states
  const [rzpLoading, setRzpLoading] = useState(false);
  const [rzpVerifying, setRzpVerifying] = useState(false);
  const [rzpError, setRzpError] = useState<string | null>(null);

  // UPI Form states
  const [utrNumber, setUtrNumber] = useState('');
  const [payerUpiId, setPayerUpiId] = useState('');
  const [isSubmittingUpi, setIsSubmittingUpi] = useState(false);
  const [upiError, setUpiError] = useState<string | null>(null);
  const [submittedUtr, setSubmittedUtr] = useState('');
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [qrImgError, setQrImgError] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [reference, setReference] = useState('SAARVI-PRO');

  const modalRef = useRef<HTMLDivElement>(null);

  const priceConfig = getPlanPrice(interval);
  // Authoritative amount in INR
  const authoritativeAmount = Math.round(priceConfig.amountCents / 100);

  useEffect(() => {
    if (isOpen) {
      setStep('SELECT_METHOD');
      setRzpError(null);
      setUpiError(null);
      setUtrNumber('');
      setPayerUpiId('');
      setReference(generatePaymentReference());
      setIsMobile(isMobileDevice());
      fetchPaymentConfig();
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, interval]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !rzpLoading && !rzpVerifying && !isSubmittingUpi) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, rzpLoading, rzpVerifying, isSubmittingUpi, onClose]);

  const fetchPaymentConfig = async () => {
    try {
      setLoadingConfig(true);
      const res = await fetch('/api/billing/payment-config');
      const data = await res.json();
      if (data.success && data.config) {
        setConfig(data.config);
      }
    } catch (err) {
      console.error('Failed to load payment config:', err);
    } finally {
      setLoadingConfig(false);
    }
  };

  const currentUpiId = config?.upiId || '9036745164-3@axl';
  const currentPayee = config?.payeeName || 'Saarvi Educational Services';
  const slaHours = config?.reviewSlaHours || 2;

  const handleCopyUpi = () => {
    navigator.clipboard.writeText(currentUpiId);
    setCopiedUpi(true);
    setTimeout(() => setCopiedUpi(false), 2500);
  };

  // Launch direct UPI app scheme
  const handleLaunchUpiApp = (provider: UpiAppProvider) => {
    try {
      const intent = createUpiPaymentIntent({
        provider,
        plan: interval,
        amount: authoritativeAmount,
        currency: 'INR',
        payeeUpiId: currentUpiId,
        payeeName: currentPayee,
        transactionReference: reference,
      });

      window.location.href = intent.intentUri;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to launch UPI application';
      alert(msg);
    }
  };

  // --------------------------------------------------------------------------
  // RAZORPAY CHECKOUT FLOW
  // --------------------------------------------------------------------------
  const handleStartRazorpay = async () => {
    if (!user) {
      router.push(`/login?next=${encodeURIComponent('/plans')}`);
      return;
    }

    setStep('RAZORPAY_FLOW');
    setRzpLoading(true);
    setRzpError(null);

    try {
      // 1. Create server-authoritative Razorpay Order
      const res = await fetch('/api/payments/razorpay/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: 'pro',
          interval,
          userId: user.id,
          userEmail: user.email,
          userName: user.fullName,
        }),
      });

      const orderData = await res.json();
      if (!res.ok || !orderData.success) {
        throw new Error(orderData.error?.message || orderData.error || 'Failed to initialize payment order');
      }

      const order = orderData.data || orderData.order;
      const keyId = order.keyId || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;

      // 2. Load Razorpay script
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        throw new Error('Unable to load Razorpay payment gateway script. Please verify your network connection.');
      }

      const RazorpayGlobal = (window as unknown as {
        Razorpay?: new (opts: Record<string, unknown>) => {
          open: () => void;
          on: (evt: string, fn: (err: any) => void) => void;
        };
      }).Razorpay;

      if (!RazorpayGlobal) {
        throw new Error('Razorpay SDK failed to initialize.');
      }

      setRzpLoading(false);

      // 3. Open Razorpay Standard Checkout
      const rzp = new RazorpayGlobal({
        key: keyId,
        order_id: order.orderId,
        amount: order.amount,
        currency: order.currency || 'INR',
        name: 'Saarvi',
        description: `Saarvi Pro (${interval === 'yearly' ? 'Yearly Access' : 'Monthly Access'})`,
        prefill: {
          name: user.fullName || '',
          email: user.email || '',
        },
        notes: {
          userId: user.id,
          plan: 'pro',
          interval,
        },
        theme: {
          color: '#2563EB',
        },
        handler: async function (response: {
          razorpay_payment_id: string;
          razorpay_order_id: string;
          razorpay_signature: string;
        }) {
          // 4. Server-Side Signature Verification & Entitlement Provisioning
          setRzpVerifying(true);
          try {
            const verifyRes = await fetch('/api/payments/razorpay/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                orderId: response.razorpay_order_id || order.orderId,
                paymentId: response.razorpay_payment_id,
                signature: response.razorpay_signature,
                userId: user.id,
              }),
            });

            const verifyData = await verifyRes.json();
            if (!verifyRes.ok || !verifyData.success) {
              throw new Error(verifyData.error?.message || verifyData.error || 'Payment verification was unsuccessful.');
            }

            // Entitlement verified server-side!
            setStep('RAZORPAY_SUCCESS');
            refreshPlan();
            onSuccess?.();
          } catch (vErr) {
            console.error('Verification error:', vErr);
            setRzpError(vErr instanceof Error ? vErr.message : 'Payment was received, but verification is still in progress.');
          } finally {
            setRzpVerifying(false);
          }
        },
        modal: {
          ondismiss: function () {
            if (step !== 'RAZORPAY_SUCCESS') {
              setStep('SELECT_METHOD');
            }
          },
        },
      });

      rzp.on('payment.failed', function (failRes: { error?: { description?: string } }) {
        setRzpError(failRes.error?.description || 'Payment was not completed. Please try again.');
        setRzpLoading(false);
      });

      rzp.open();
    } catch (err) {
      console.error('Razorpay order failure:', err);
      setRzpError(err instanceof Error ? err.message : 'Unable to start payment. Please try again.');
      setRzpLoading(false);
    }
  };

  // --------------------------------------------------------------------------
  // UPI SUBMISSION FLOW
  // --------------------------------------------------------------------------
  const handleSubmitUtr = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpiError(null);

    if (!user) {
      setUpiError('Please sign in before submitting payment verification.');
      return;
    }

    const cleanUtr = utrNumber.trim();
    if (!cleanUtr || cleanUtr.length < 6 || cleanUtr.length > 35) {
      setUpiError('Please enter a valid 6 to 35-character UTR / Transaction Reference number from your payment app.');
      return;
    }

    try {
      setIsSubmittingUpi(true);
      const res = await fetch('/api/billing/payment-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planDuration: interval.toUpperCase(),
          utrNumber: cleanUtr,
          payerUpiId: payerUpiId.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to submit payment verification.');
      }

      setSubmittedUtr(cleanUtr);
      setStep('UPI_SUCCESS');
      onSuccess?.();
    } catch (err: unknown) {
      setUpiError(err instanceof Error ? err.message : 'Check your connection and try again.');
    } finally {
      setIsSubmittingUpi(false);
    }
  };

  if (!isOpen) return null;

  // Resolve QR code URL
  const upiIntentUri = `upi://pay?pa=${encodeURIComponent(currentUpiId)}&pn=${encodeURIComponent(currentPayee)}&am=${authoritativeAmount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(reference)}`;
  const resolvedCustomQr = resolvePaymentQrImage(config?.qrCodeUrl);
  const qrDisplayUrl =
    resolvedCustomQr ||
    `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(upiIntentUri)}`;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="payment-modal-title"
    >
      <div
        ref={modalRef}
        className="bg-white dark:bg-[#111c38] rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-lg w-full overflow-hidden my-8 relative flex flex-col max-h-[92vh]"
      >
        {/* Modal Top Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 shrink-0">
          <div className="flex items-center gap-2">
            {step !== 'SELECT_METHOD' && step !== 'RAZORPAY_SUCCESS' && step !== 'UPI_SUCCESS' && (
              <button
                type="button"
                onClick={() => setStep('SELECT_METHOD')}
                className="p-1 -ml-1 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 rounded-lg transition cursor-pointer"
                title="Back to payment method selection"
                aria-label="Back"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            <span className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              Upgrade to Saarvi Pro
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={rzpLoading || rzpVerifying || isSubmittingUpi}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl hover:bg-slate-200/60 dark:hover:bg-slate-800 transition cursor-pointer disabled:opacity-40"
            title="Close modal"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body Container with Scroll */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* Selected Plan Summary Pill */}
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-blue-50/80 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/60 text-xs">
            <div>
              <span className="text-slate-500 dark:text-slate-400 font-medium">Selected Plan:</span>
              <div className="font-bold text-slate-900 dark:text-white text-sm">
                Saarvi Pro ({interval === 'yearly' ? 'Yearly' : 'Monthly'})
              </div>
            </div>
            <div className="text-right">
              <div className="font-extrabold text-blue-700 dark:text-blue-400 text-base">
                ₹{authoritativeAmount}
              </div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400">
                {interval === 'yearly' ? '365 days access' : '30 days access'}
              </span>
            </div>
          </div>

          {/* ================================================================ */}
          {/* STEP 1: PAYMENT METHOD SELECTOR                                 */}
          {/* ================================================================ */}
          {step === 'SELECT_METHOD' && (
            <div className="space-y-4">
              <div>
                <h3 id="payment-modal-title" className="text-lg font-black text-slate-900 dark:text-white">
                  Choose payment method
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Select your preferred way to complete the Pro activation.
                </p>
              </div>

              {/* Option A: Razorpay */}
              <div
                onClick={() => setSelectedMethod('razorpay')}
                className={`p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                  selectedMethod === 'razorpay'
                    ? 'border-blue-600 bg-blue-50/30 dark:bg-blue-950/30 shadow-xs'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-[#0b1329]'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                      <CreditCard className="w-5 h-5" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900 dark:text-white">Razorpay</span>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-[10px] font-extrabold">
                          Instant Activation
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        Fast and secure online payment via Cards, UPI, Netbanking, or Wallets.
                      </p>
                    </div>
                  </div>
                  <input
                    type="radio"
                    name="paymentMethod"
                    checked={selectedMethod === 'razorpay'}
                    onChange={() => setSelectedMethod('razorpay')}
                    className="w-4 h-4 text-blue-600 mt-1 cursor-pointer"
                  />
                </div>
              </div>

              {/* Option B: UPI / QR */}
              <div
                onClick={() => setSelectedMethod('upi')}
                className={`p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                  selectedMethod === 'upi'
                    ? 'border-blue-600 bg-blue-50/30 dark:bg-blue-950/30 shadow-xs'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-[#0b1329]'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-400 flex items-center justify-center shrink-0 mt-0.5">
                      <QrCode className="w-5 h-5" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900 dark:text-white">UPI / QR Code</span>
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-bold">
                          2-Hour SLA
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        Pay using PhonePe, Google Pay, Paytm, or scan QR code and submit UTR.
                      </p>
                    </div>
                  </div>
                  <input
                    type="radio"
                    name="paymentMethod"
                    checked={selectedMethod === 'upi'}
                    onChange={() => setSelectedMethod('upi')}
                    className="w-4 h-4 text-blue-600 mt-1 cursor-pointer"
                  />
                </div>
              </div>

              {/* Continue Button */}
              <div className="pt-2">
                {selectedMethod === 'razorpay' ? (
                  <button
                    type="button"
                    onClick={handleStartRazorpay}
                    className="w-full py-3.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm text-center transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Continue with Razorpay</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setStep('UPI_FLOW')}
                    className="w-full py-3.5 px-4 rounded-xl bg-slate-900 hover:bg-black dark:bg-blue-600 dark:hover:bg-blue-700 text-white font-bold text-xs sm:text-sm text-center transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Continue with UPI</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Security reassurance */}
              <div className="flex items-center justify-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 pt-1">
                <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
                <span>100% Encrypted &amp; Server-Authoritative Processing</span>
              </div>
            </div>
          )}

          {/* ================================================================ */}
          {/* STEP 2A: RAZORPAY IN-PROGRESS OR ERROR                           */}
          {/* ================================================================ */}
          {step === 'RAZORPAY_FLOW' && (
            <div className="text-center py-8 space-y-4">
              {rzpLoading && (
                <div className="space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto shadow-xs">
                    <Loader2 className="w-6 h-6 animate-spin" />
                  </div>
                  <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                    Creating payment order...
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
                    Initializing secure Razorpay standard checkout. Please wait.
                  </p>
                </div>
              )}

              {rzpVerifying && (
                <div className="space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto shadow-xs">
                    <Loader2 className="w-6 h-6 animate-spin" />
                  </div>
                  <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                    Verifying payment signature...
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
                    Validating cryptographic token and provisioning your Pro entitlement.
                  </p>
                </div>
              )}

              {rzpError && (
                <div className="space-y-4">
                  <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-2xl text-left flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                    <div className="text-xs text-rose-900 dark:text-rose-200">
                      <div className="font-bold">Payment Error</div>
                      <div>{rzpError}</div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setStep('SELECT_METHOD')}
                      className="flex-1 py-2.5 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs transition cursor-pointer"
                    >
                      Change Method
                    </button>
                    <button
                      type="button"
                      onClick={handleStartRazorpay}
                      className="flex-1 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Try Again</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ================================================================ */}
          {/* STEP 2B: UPI PAYMENT DETAILS & FORM                              */}
          {/* ================================================================ */}
          {step === 'UPI_FLOW' && (
            <div className="space-y-5">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Pay via UPI / QR Code
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Complete your transfer and submit the UTR for verification.
                </p>
              </div>

              {/* Payee Info & QR */}
              <div className="bg-slate-50 dark:bg-[#0b1329] rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-4">
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  {/* QR Image */}
                  <div className="bg-white p-2 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs shrink-0 flex items-center justify-center">
                    {qrImgError ? (
                      <div className="w-36 h-36 rounded-lg bg-slate-100 dark:bg-slate-800 flex flex-col items-center justify-center text-center p-2 text-slate-500 dark:text-slate-400 gap-1 text-[10px]">
                        <AlertCircle className="w-5 h-5 text-amber-500" />
                        <span>Use UPI ID below</span>
                      </div>
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={qrDisplayUrl}
                        alt="Saarvi UPI QR Code"
                        className="w-36 h-36 object-contain rounded-lg"
                        onError={() => setQrImgError(true)}
                      />
                    )}
                  </div>

                  {/* Payee Metadata */}
                  <div className="flex-1 w-full space-y-2 text-xs">
                    <div>
                      <span className="text-slate-400 dark:text-slate-500 text-[11px] block">Payee Name</span>
                      <span className="font-semibold text-slate-900 dark:text-white">{currentPayee}</span>
                    </div>

                    <div>
                      <span className="text-slate-400 dark:text-slate-500 text-[11px] block">UPI ID</span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="font-mono font-bold text-blue-700 dark:text-blue-400 bg-white dark:bg-slate-800 px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700 text-xs">
                          {currentUpiId}
                        </span>
                        <button
                          type="button"
                          onClick={handleCopyUpi}
                          className="p-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 transition cursor-pointer"
                          title="Copy UPI ID"
                        >
                          {copiedUpi ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="pt-1 border-t border-slate-200/80 dark:border-slate-800 flex items-baseline justify-between">
                      <span className="text-slate-500 dark:text-slate-400 font-medium">Exact Amount:</span>
                      <span className="font-black text-slate-900 dark:text-white text-sm">₹{authoritativeAmount}</span>
                    </div>
                  </div>
                </div>

                {/* Mobile Quick Launch App Buttons */}
                <div className="pt-2 border-t border-slate-200/80 dark:border-slate-800">
                  <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-2">
                    Open installed UPI App directly:
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <button
                      type="button"
                      onClick={() => handleLaunchUpiApp('PHONEPE')}
                      className="p-2 rounded-xl bg-white dark:bg-slate-800 hover:bg-purple-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-[11px] font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-2xs"
                    >
                      <span className="w-2 h-2 rounded-full bg-[#5f259f]" />
                      <span>PhonePe</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleLaunchUpiApp('GOOGLE_PAY')}
                      className="p-2 rounded-xl bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-[11px] font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-2xs"
                    >
                      <span className="w-2 h-2 rounded-full bg-[#1a73e8]" />
                      <span>GPay</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleLaunchUpiApp('PAYTM')}
                      className="p-2 rounded-xl bg-white dark:bg-slate-800 hover:bg-sky-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-[11px] font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-2xs"
                    >
                      <span className="w-2 h-2 rounded-full bg-[#002970]" />
                      <span>Paytm</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleLaunchUpiApp('OTHER_UPI')}
                      className="p-2 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-[11px] font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-2xs"
                    >
                      <Smartphone className="w-3 h-3 text-slate-500 dark:text-slate-400" />
                      <span>Other UPI</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Clear 5-Step Instructions */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-400 space-y-1">
                <span className="font-bold text-slate-800 dark:text-slate-200 block mb-1">Simple Verification Steps:</span>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Pay the exact amount (₹{authoritativeAmount}).</li>
                  <li>Complete payment in your UPI app.</li>
                  <li>Copy the 12-digit UTR / transaction reference.</li>
                  <li>Enter the UTR in the form below.</li>
                  <li>Submit for verification.</li>
                </ol>
              </div>

              {/* UTR Form */}
              <form onSubmit={handleSubmitUtr} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
                    UTR / Transaction Reference *
                  </label>
                  <input
                    type="text"
                    required
                    value={utrNumber}
                    onChange={(e) => setUtrNumber(e.target.value)}
                    placeholder="e.g. 423987123456"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-[#0b1329] focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Your UPI ID or Mobile Number <span className="text-slate-400 text-[10px] font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={payerUpiId}
                    onChange={(e) => setPayerUpiId(e.target.value)}
                    placeholder="e.g. 9876543210 or name@okhdfcbank"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-[#0b1329] focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* SLA Notice */}
                <div className="flex items-center gap-1.5 text-[11px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 p-2.5 rounded-xl border border-amber-200 dark:border-amber-900">
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    Manual UPI payments are reviewed by the Saarvi team within {slaHours} hours.
                  </span>
                </div>

                {upiError && (
                  <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200 text-xs rounded-xl flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{upiError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmittingUpi}
                  className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm text-center transition shadow-md flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
                >
                  {isSubmittingUpi ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Submitting for verification...</span>
                    </>
                  ) : (
                    <span>Submit Payment for Verification</span>
                  )}
                </button>
              </form>
            </div>
          )}

          {/* ================================================================ */}
          {/* STEP 3A: RAZORPAY PAYMENT SUCCESS                               */}
          {/* ================================================================ */}
          {step === 'RAZORPAY_SUCCESS' && (
            <div className="text-center py-6 space-y-4">
              <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-sm">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div className="space-y-1">
                <h3 className="text-xl font-black text-slate-900 dark:text-white">
                  Payment Successful!
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 max-w-sm mx-auto">
                  Your Saarvi Pro plan is active. All premium quotas, 50-file queues, and extended workspaces are unlocked.
                </p>
              </div>

              <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-xs font-semibold inline-flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Pro Status: Active</span>
              </div>

              <div className="pt-4 flex flex-col sm:flex-row gap-2.5">
                <Link
                  href="/dashboard/billing"
                  onClick={onClose}
                  className="flex-1 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold text-center transition shadow-xs"
                >
                  Manage Billing
                </Link>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-3 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold transition cursor-pointer"
                >
                  Close &amp; Continue
                </button>
              </div>
            </div>
          )}

          {/* ================================================================ */}
          {/* STEP 3B: UPI PAYMENT SUBMITTED / PENDING REVIEW                  */}
          {/* ================================================================ */}
          {step === 'UPI_SUCCESS' && (
            <div className="text-center py-6 space-y-4">
              <div className="w-14 h-14 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 flex items-center justify-center mx-auto shadow-sm">
                <Clock className="w-8 h-8 animate-pulse" />
              </div>

              <div className="space-y-1">
                <h3 className="text-xl font-black text-slate-900 dark:text-white">
                  Payment submitted
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 max-w-sm mx-auto">
                  Status: <strong className="text-amber-800 dark:text-amber-400">Pending review</strong>
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 pt-1">
                  You will be notified in your Saarvi Notification Center as soon as our verification team approves the UTR reference.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#0b1329] border border-slate-200 dark:border-slate-800 text-xs text-left space-y-1 font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-400 dark:text-slate-500">UTR:</span>
                  <span className="font-bold text-slate-800 dark:text-white">{submittedUtr}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 dark:text-slate-500">Plan:</span>
                  <span className="text-slate-800 dark:text-white font-semibold">Pro {interval.toUpperCase()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 dark:text-slate-500">Amount:</span>
                  <span className="text-slate-800 dark:text-white font-bold">₹{authoritativeAmount}</span>
                </div>
              </div>

              <div className="pt-4 flex flex-col sm:flex-row gap-2.5">
                <Link
                  href="/dashboard/billing"
                  onClick={onClose}
                  className="flex-1 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold text-center transition shadow-xs"
                >
                  View Billing
                </Link>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-3 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold transition cursor-pointer"
                >
                  Back to Plans
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
