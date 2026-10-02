'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  createUpiPaymentIntent,
  generatePaymentReference,
  isMobileDevice,
  UpiAppProvider,
} from '@/lib/billing/upi-intent';
import {
  Check,
  Copy,
  ExternalLink,
  QrCode,
  Smartphone,
  Clock,
  ShieldCheck,
  AlertCircle,
  Loader2,
  Sparkles,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import Link from 'next/link';
import { resolvePaymentQrImage } from '@/lib/billing/qr-resolver';

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

interface ExistingRequest {
  id: string;
  planDuration: 'MONTHLY' | 'YEARLY';
  amount: number;
  currency: string;
  utrNumber: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
  slaDeadline: string;
  reviewedAt?: string;
  reviewNotes?: string;
}

interface UpiPaymentSectionProps {
  defaultPlan?: 'monthly' | 'yearly';
}

export function UpiPaymentSection({
  defaultPlan = 'monthly',
}: UpiPaymentSectionProps) {
  const { user } = useAuth();

  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>(defaultPlan);
  const [config, setConfig] = useState<PaymentConfigData | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(true);

  // Form states
  const [utrNumber, setUtrNumber] = useState('');
  const [payerUpiId, setPayerUpiId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  // Active user payment request
  const [existingRequest, setExistingRequest] = useState<ExistingRequest | null>(null);
  const [loadingRequest, setLoadingRequest] = useState(false);

  // QR Code visibility & Copy state
  const [showQrCode, setShowQrCode] = useState(true);
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [qrImgError, setQrImgError] = useState(false);

  // Unique reference for the session
  const [reference, setReference] = useState('SAARVI-PRO');

  useEffect(() => {
    setIsMobile(isMobileDevice());
    setReference(generatePaymentReference());
    fetchPaymentConfig();
  }, []);

  useEffect(() => {
    if (user?.id) {
      fetchUserRequests();
    }
  }, [user?.id]);

  const fetchPaymentConfig = async () => {
    try {
      setLoadingConfig(true);
      const res = await fetch('/api/billing/payment-config');
      const data = await res.json();
      if (data.success && data.config) {
        setConfig(data.config);
      }
    } catch (err) {
      console.error('Failed to fetch payment config:', err);
    } finally {
      setLoadingConfig(false);
    }
  };

  const fetchUserRequests = async () => {
    try {
      setLoadingRequest(true);
      const res = await fetch('/api/billing/payment-request');
      const data = await res.json();
      if (data.success && Array.isArray(data.requests) && data.requests.length > 0) {
        // Find latest pending or active request
        const pending = data.requests.find((r: ExistingRequest) => r.status === 'PENDING');
        if (pending) {
          setExistingRequest(pending);
        } else {
          setExistingRequest(data.requests[0]);
        }
      }
    } catch (err) {
      console.error('Failed to fetch user payment requests:', err);
    } finally {
      setLoadingRequest(false);
    }
  };

  const currentAmount =
    selectedPlan === 'monthly'
      ? config?.amountMonthly ?? 99
      : config?.amountYearly ?? 899;

  const currentUpiId = config?.upiId || '9036745164-3@axl';
  const currentPayee = config?.payeeName || 'Saarvi Educational Services';

  const handleCopyUpi = () => {
    navigator.clipboard.writeText(currentUpiId);
    setCopiedUpi(true);
    setTimeout(() => setCopiedUpi(false), 2500);
  };

  const handleLaunchUpiApp = (provider: UpiAppProvider) => {
    try {
      const intent = createUpiPaymentIntent({
        provider,
        plan: selectedPlan,
        amount: currentAmount,
        currency: config?.currency || 'INR',
        payeeUpiId: currentUpiId,
        payeeName: currentPayee,
        transactionReference: reference,
      });

      // Try launching app scheme
      window.location.href = intent.intentUri;
    } catch (err: any) {
      alert(err.message || 'Unable to open UPI app');
    }
  };

  const handleSubmitUtr = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitSuccess(null);

    if (!user) {
      setSubmitError('Please log in or sign up before submitting payment verification.');
      return;
    }

    const cleanUtr = utrNumber.trim();
    if (!cleanUtr || cleanUtr.length < 6 || cleanUtr.length > 35) {
      setSubmitError('Please enter a valid 6 to 35-digit UTR / Reference number from your payment app.');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await fetch('/api/billing/payment-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planDuration: selectedPlan.toUpperCase(),
          utrNumber: cleanUtr,
          payerUpiId: payerUpiId.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to submit payment verification.');
      }

      setSubmitSuccess('Payment submitted successfully! Your request is currently in review.');
      setExistingRequest(data.request);
      setUtrNumber('');
      setPayerUpiId('');
    } catch (err: any) {
      setSubmitError(err.message || 'Network error occurred while submitting payment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Resolve official custom QR image URL if configured, otherwise fallback to dynamic QR
  const upiIntentUri = `upi://pay?pa=${encodeURIComponent(currentUpiId)}&pn=${encodeURIComponent(currentPayee)}&am=${currentAmount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(reference)}`;
  const resolvedCustomQr = resolvePaymentQrImage(config?.qrCodeUrl);
  const qrDisplayUrl =
    resolvedCustomQr ||
    `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(upiIntentUri)}`;

  return (
    <div className="bg-white dark:bg-[#111c38] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 sm:p-8 max-w-3xl mx-auto">
      {/* Header & Plan Toggle */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-xs font-semibold mb-3">
          <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          Direct UPI & QR Pro Activation
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
          Upgrade to Saarvi Pro
        </h2>
        <p className="text-slate-600 dark:text-slate-400 text-sm mt-1.5 max-w-md mx-auto">
          Fast, direct payment with zero hidden charges. Reviewed by our team within 2 hours.
        </p>

        {/* Plan Switcher */}
        <div className="inline-flex items-center bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl mt-6 border border-slate-200 dark:border-slate-700">
          <button
            type="button"
            onClick={() => setSelectedPlan('monthly')}
            className={`px-5 py-2 text-sm font-semibold rounded-lg transition-all ${
              selectedPlan === 'monthly'
                ? 'bg-white dark:bg-[#111c38] text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Monthly (₹{config?.amountMonthly ?? 99}/mo)
          </button>
          <button
            type="button"
            onClick={() => setSelectedPlan('yearly')}
            className={`px-5 py-2 text-sm font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
              selectedPlan === 'yearly'
                ? 'bg-white dark:bg-[#111c38] text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Yearly (₹{config?.amountYearly ?? 899}/yr)
            <span className="bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              Save ~25%
            </span>
          </button>
        </div>
      </div>

      {/* Existing Pending Request Notice (if user already submitted) */}
      {existingRequest && existingRequest.status === 'PENDING' && (
        <div className="mb-8 p-5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl">
          <div className="flex items-start gap-3">
            <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5 animate-pulse" />
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-amber-900 dark:text-amber-300">
                Payment Verification Under Review
              </h4>
              <p className="text-xs text-amber-800 dark:text-amber-300/90">
                We received your payment submission for{' '}
                <span className="font-semibold text-amber-950 dark:text-amber-200">
                  {existingRequest.planDuration} (₹{existingRequest.amount})
                </span>{' '}
                with UTR <span className="font-mono font-semibold">{existingRequest.utrNumber}</span>.
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-400">
                Our verification team is reviewing it with our{' '}
                <span className="font-semibold">2-hour review SLA guarantee</span>. Your Pro benefits
                will be automatically activated upon approval.
              </p>
              <div className="pt-2">
                <Link
                  href="/dashboard/billing"
                  className="inline-flex items-center text-xs font-semibold text-amber-900 dark:text-amber-300 hover:underline gap-1"
                >
                  View status in Billing Dashboard <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 1: Pay via UPI Apps or QR */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start pb-8 border-b border-slate-100 dark:border-slate-800">
        {/* Left Column: Direct App Launch */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-semibold text-sm">
            <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">
              1
            </span>
            <span>Pay with any UPI App</span>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400">
            Click below to launch your installed UPI app directly with pre-filled amount (₹
            {currentAmount}):
          </p>

          <div className="space-y-2.5">
            {/* PhonePe */}
            <button
              type="button"
              onClick={() => handleLaunchUpiApp('PHONEPE')}
              className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl transition text-left group"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#5f259f]/10 dark:bg-[#5f259f]/20 flex items-center justify-center text-[#5f259f] dark:text-purple-300 font-black text-sm">
                  Pe
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400">
                    PhonePe
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">Launch PhonePe App</div>
                </div>
              </div>
              <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400" />
            </button>

            {/* Google Pay */}
            <button
              type="button"
              onClick={() => handleLaunchUpiApp('GOOGLE_PAY')}
              className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl transition text-left group"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 flex items-center justify-center text-[#1a73e8] dark:text-blue-400 font-bold text-sm">
                  GPay
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400">
                    Google Pay
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">Launch Google Pay</div>
                </div>
              </div>
              <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400" />
            </button>

            {/* Paytm */}
            <button
              type="button"
              onClick={() => handleLaunchUpiApp('PAYTM')}
              className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl transition text-left group"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-sky-50 dark:bg-sky-950/60 flex items-center justify-center text-[#002970] dark:text-sky-300 font-black text-xs">
                  Paytm
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400">
                    Paytm UPI
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">Launch Paytm</div>
                </div>
              </div>
              <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400" />
            </button>

            {/* Universal / Other UPI */}
            <button
              type="button"
              onClick={() => handleLaunchUpiApp('OTHER_UPI')}
              className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl transition text-left group"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-300">
                  <Smartphone className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400">
                    Other UPI Apps
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">BHIM, Cred, Amazon Pay</div>
                </div>
              </div>
              <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400" />
            </button>
          </div>
        </div>

        {/* Right Column: QR Code & Payee Details */}
        <div className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col items-center text-center">
          <div className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <QrCode className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            Or Scan QR Code to Pay
          </div>

          <div className="bg-white p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm my-2 flex flex-col items-center justify-center min-h-[176px]">
            {qrImgError ? (
              <div className="w-44 h-44 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex flex-col items-center justify-center p-3 text-center text-slate-500 dark:text-slate-400 gap-1.5">
                <AlertCircle className="w-6 h-6 text-amber-500" />
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">QR payment is currently unavailable.</span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500">Please pay using UPI App buttons or copy UPI ID below.</span>
              </div>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qrDisplayUrl}
                alt="Saarvi UPI Payment QR Code"
                className="w-44 h-44 object-contain rounded-lg"
                loading="lazy"
                onError={() => setQrImgError(true)}
              />
            )}
          </div>

          <div className="mt-2 w-full text-left bg-white dark:bg-[#0b1329] p-3 rounded-lg border border-slate-200 dark:border-slate-700 text-xs space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400">Payee:</span>
              <span className="font-semibold text-slate-900 dark:text-white">{currentPayee}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400">UPI ID:</span>
              <div className="flex items-center gap-1">
                <span className="font-mono font-bold text-blue-700 dark:text-blue-400">{currentUpiId}</span>
                <button
                  type="button"
                  onClick={handleCopyUpi}
                  className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition"
                  title="Copy UPI ID"
                >
                  {copiedUpi ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800">
              <span className="text-slate-500 dark:text-slate-400">Exact Amount:</span>
              <span className="font-bold text-slate-900 dark:text-white">₹{currentAmount}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Step 2: Submit UTR / Reference */}
      <div className="pt-8">
        <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-semibold text-sm mb-4">
          <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">
            2
          </span>
          <span>Submit 12-Digit UTR / Reference Number</span>
        </div>

        <form onSubmit={handleSubmitUtr} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              UTR / Transaction Reference Number <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={utrNumber}
              onChange={(e) => setUtrNumber(e.target.value)}
              placeholder="e.g. 423987123456"
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-[#0d162e] focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Found in your UPI app receipt or transaction details (usually 12 digits).
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Your UPI ID or Mobile Number (Optional)
            </label>
            <input
              type="text"
              value={payerUpiId}
              onChange={(e) => setPayerUpiId(e.target.value)}
              placeholder="e.g. yourname@oksbi or 9876543210"
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-[#0d162e] focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {submitError && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

          {submitSuccess && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>{submitSuccess}</span>
            </div>
          )}

          <div className="pt-2">
            {!user ? (
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-center space-y-2">
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Please log in or create an account so we can link Pro benefits to your profile.
                </p>
                <div className="flex items-center justify-center gap-3">
                  <Link
                    href={`/login?redirect=${encodeURIComponent('/pricing')}`}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition"
                  >
                    Log In to Continue
                  </Link>
                  <Link
                    href={`/signup?redirect=${encodeURIComponent('/pricing')}`}
                    className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg text-xs font-semibold hover:bg-slate-300 dark:hover:bg-slate-600 transition"
                  >
                    Sign Up
                  </Link>
                </div>
              </div>
            ) : (
              <button
                type="submit"
                disabled={isSubmitting || (existingRequest?.status === 'PENDING')}
                className="w-full py-3 px-5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl shadow-sm transition flex items-center justify-center gap-2 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Submitting for Verification...
                  </>
                ) : existingRequest?.status === 'PENDING' ? (
                  <>
                    <Clock className="w-4 h-4" />
                    Request Currently Under Review
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    Submit Payment for 2-Hour Verification
                  </>
                )}
              </button>
            )}
          </div>
        </form>

        {/* SLA & Security Trust Footer */}
        <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
            <span>
              <strong className="text-slate-700 dark:text-slate-300">2-Hour Review SLA:</strong> Dedicated admin team reviews every submission.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>
              <strong className="text-slate-700 dark:text-slate-300">Official Pro Entitlements:</strong> Direct access with downloadable invoice.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
