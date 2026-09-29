"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useFeedback } from '@/context/FeedbackContext';
import { useAuth } from '@/context/AuthContext';
import { CANONICAL_TOOL_REGISTRY } from '@/lib/tools/tool-registry';
import {
  X,
  Star,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  Bug,
  Lightbulb,
  Zap,
  Palette,
  HelpCircle,
  Shield,
} from 'lucide-react';

const CATEGORIES = [
  { id: 'BUG', label: 'Bug Report', icon: Bug, color: 'text-rose-500 bg-rose-50 border-rose-200' },
  { id: 'FEATURE', label: 'Feature Request', icon: Lightbulb, color: 'text-amber-500 bg-amber-50 border-amber-200' },
  { id: 'PERFORMANCE', label: 'Performance', icon: Zap, color: 'text-blue-500 bg-blue-50 border-blue-200' },
  { id: 'UX', label: 'Design & UX', icon: Palette, color: 'text-purple-500 bg-purple-50 border-purple-200' },
  { id: 'OTHER', label: 'Other Feedback', icon: HelpCircle, color: 'text-slate-500 bg-slate-50 border-slate-200' },
] as const;

const RATING_LABELS: Record<number, string> = {
  1: 'Needs Improvement',
  2: 'Fair Experience',
  3: 'Good Quality',
  4: 'Great Performance',
  5: 'Exceptional & Loved It',
};

export default function FeedbackModal() {
  const { isOpen, closeFeedback, options } = useFeedback();
  const { user } = useAuth();

  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [category, setCategory] = useState<'BUG' | 'FEATURE' | 'PERFORMANCE' | 'UX' | 'OTHER'>('FEATURE');
  const [toolSlug, setToolSlug] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const successCloseBtnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      previousActiveElementRef.current = (document.activeElement as HTMLElement) || null;
      document.body.style.overflow = 'hidden';

      setIsSuccess(false);
      setError(null);
      setMessage('');
      setRating(5);
      if (options.category) {
        setCategory(options.category);
      } else {
        setCategory('FEATURE');
      }
      if (options.toolSlug) {
        setToolSlug(options.toolSlug);
      } else {
        setToolSlug('');
      }
      if (user?.email) {
        setEmail(user.email);
      } else {
        setEmail('');
      }

      setTimeout(() => {
        closeBtnRef.current?.focus();
      }, 50);
    } else {
      document.body.style.overflow = '';
      if (previousActiveElementRef.current) {
        previousActiveElementRef.current.focus();
      }
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, options, user]);

  useEffect(() => {
    if (isSuccess) {
      setTimeout(() => {
        successCloseBtnRef.current?.focus();
      }, 100);
    }
  }, [isSuccess]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmed = message.trim();
    if (trimmed.length < 10) {
      setError('Please provide at least 10 characters describing your feedback.');
      const msgInput = document.getElementById('feedback-message');
      msgInput?.focus();
      return;
    }
    if (trimmed.length > 2000) {
      setError('Feedback message is too long (maximum 2000 characters).');
      return;
    }

    setLoading(true);
    try {
      const pageUrl = typeof window !== 'undefined' ? window.location.href : undefined;
      const viewport =
        typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : undefined;

      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating,
          category,
          message: trimmed,
          toolSlug: toolSlug || undefined,
          pageUrl,
          viewport,
          email: email.trim() || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to submit feedback');
      }

      setIsSuccess(true);
      setTimeout(() => {
        closeFeedback();
      }, 2500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="feedback-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div
        className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 id="feedback-title" className="text-base font-bold text-slate-900">
                Share Your Feedback
              </h2>
              <p className="text-xs text-slate-500">Help us make Saarvi faster, sharper, and better.</p>
            </div>
          </div>
          <button
            ref={closeBtnRef}
            onClick={closeFeedback}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
            aria-label="Close feedback modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Success State */}
        {isSuccess ? (
          <div
            id="feedback-status"
            data-saarvi-target="feedback-success"
            tabIndex={-1}
            className="p-8 text-center space-y-4 my-auto saarvi-destination-target outline-hidden"
          >
            <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto animate-in zoom-in-50 duration-300">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h3 tabIndex={-1} className="text-lg font-bold text-slate-900 outline-hidden">
                Thank You!
              </h3>
              <p className="text-xs text-slate-600 max-w-sm mx-auto">
                Your feedback has been recorded and delivered directly to the Saarvi engineering team.
              </p>
            </div>
            <button
              ref={successCloseBtnRef}
              onClick={closeFeedback}
              className="px-5 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition cursor-pointer"
            >
              Close
            </button>
          </div>
        ) : (
          /* Form State */
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
            {error && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Star Rating */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700 block">
                How would you rate your experience?
              </label>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => {
                  const active = (hoverRating || rating) >= star;
                  return (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      className="p-1 rounded-lg transition-transform hover:scale-110 focus:outline-hidden"
                      aria-label={`${star} Stars`}
                    >
                      <Star
                        className={`w-7 h-7 transition-colors ${
                          active
                            ? 'text-amber-400 fill-amber-400'
                            : 'text-slate-300 hover:text-amber-200'
                        }`}
                      />
                    </button>
                  );
                })}
                <span className="text-xs font-medium text-slate-600 ml-2">
                  {RATING_LABELS[hoverRating || rating]}
                </span>
              </div>
            </div>

            {/* Category Selector */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700 block">Category</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {CATEGORIES.map((cat) => {
                  const Icon = cat.icon;
                  const isSelected = category === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setCategory(cat.id as any)}
                      className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-medium text-left transition-all ${
                        isSelected
                          ? 'border-blue-600 bg-blue-50/70 text-blue-900 ring-2 ring-blue-600/20 shadow-xs'
                          : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-white'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="truncate">{cat.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Tool Selection (Optional) */}
            <div className="space-y-1.5">
              <label htmlFor="feedback-tool" className="text-xs font-semibold text-slate-700 block">
                Related Tool (Optional)
              </label>
              <select
                id="feedback-tool"
                value={toolSlug}
                onChange={(e) => setToolSlug(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800"
              >
                <option value="">General Platform Feedback</option>
                {CANONICAL_TOOL_REGISTRY.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.name} ({t.category.toUpperCase()})
                  </option>
                ))}
              </select>
            </div>

            {/* Message Area */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="feedback-message" className="text-xs font-semibold text-slate-700">
                  Your Message
                </label>
                <span className="text-[11px] text-slate-400">
                  {message.length} / 2000
                </span>
              </div>
              <textarea
                id="feedback-message"
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="What went well? What could we improve or fix?"
                className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800 placeholder-slate-400 resize-none"
              />
            </div>

            {/* Email Contact (Optional) */}
            <div className="space-y-1.5">
              <label htmlFor="feedback-email" className="text-xs font-semibold text-slate-700 block">
                Contact Email (Optional - if you'd like a follow up)
              </label>
              <input
                id="feedback-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800 placeholder-slate-400"
              />
            </div>

            {/* Privacy Guarantee Note */}
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-[11px] text-slate-500">
              <Shield className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>
                Zero file retention: We never inspect, upload, or collect your document contents, marks, or personal files.
              </span>
            </div>

            {/* Submit & Cancel Buttons */}
            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={closeFeedback}
                disabled={loading}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || message.trim().length < 10}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white text-xs font-semibold shadow-xs transition-colors disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Submitting...</span>
                  </>
                ) : (
                  <span>Send Feedback</span>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
