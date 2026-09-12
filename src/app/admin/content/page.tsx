"use client";

import React, { useState, useEffect } from 'react';
import {
  FileText,
  HelpCircle,
  Plus,
  Edit2,
  Trash2,
  Save,
  CheckCircle2,
  Sparkles,
  Layers,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { adminService } from '@/lib/services/adminService';

interface FaqItem {
  id: string;
  question: string;
  answer: string;
  enabled: boolean;
}

const DEFAULT_FAQS: FaqItem[] = [
  {
    id: 'faq-1',
    question: 'Are my uploaded documents or photos stored on any server?',
    answer: 'No. All PDF operations, image conversions, and document processing execute 100% locally inside your web browser. Your private files never leave your computer.',
    enabled: true,
  },
  {
    id: 'faq-2',
    question: 'How does the VTU SGPA & CGPA calculation work?',
    answer: 'Saarvi strictly adheres to the official VTU 2022 Scheme regulations under CBCS and NEP 2020 guidelines, automatically adjusting for courses with or without semester-end exams.',
    enabled: true,
  },
  {
    id: 'faq-3',
    question: 'Do I need an account to convert files?',
    answer: 'No! All core document utilities and student calculators are available completely free for guests without requiring sign up or login.',
    enabled: true,
  },
];

export default function AdminContentPage() {
  const { user, profile } = useAuth();
  const [heroHeading, setHeroHeading] = useState('Smart, Private Document Utilities & Student Platform');
  const [heroSubtitle, setHeroSubtitle] = useState('High-performance browser-based PDF and image tools combined with VTU-aware academic calculators.');
  const [ctaText, setCtaText] = useState('Explore All 24 Tools');
  const [faqs, setFaqs] = useState<FaqItem[]>([]);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // FAQ Modal
  const [editingFaq, setEditingFaq] = useState<FaqItem | null>(null);
  const [faqQuestion, setFaqQuestion] = useState('');
  const [faqAnswer, setFaqAnswer] = useState('');

  useEffect(() => {
    try {
      const storedFaqs = localStorage.getItem('saarvi_admin_faqs_v1') || localStorage.getItem('docease_admin_faqs_v1');
      if (storedFaqs) setFaqs(JSON.parse(storedFaqs));
      else setFaqs(DEFAULT_FAQS);

      const storedCopy = localStorage.getItem('saarvi_admin_homepage_copy_v1') || localStorage.getItem('docease_admin_homepage_copy_v1');
      if (storedCopy) {
        const parsed = JSON.parse(storedCopy);
        if (parsed.heroHeading) setHeroHeading(parsed.heroHeading);
        if (parsed.heroSubtitle) setHeroSubtitle(parsed.heroSubtitle);
        if (parsed.ctaText) setCtaText(parsed.ctaText);
      }
    } catch {
      setFaqs(DEFAULT_FAQS);
    }
  }, []);

  const openFaqModal = (item?: FaqItem) => {
    if (item) {
      setEditingFaq(item);
      setFaqQuestion(item.question);
      setFaqAnswer(item.answer);
    } else {
      setEditingFaq({ id: `faq_${Date.now()}`, question: '', answer: '', enabled: true });
      setFaqQuestion('');
      setFaqAnswer('');
    }
  };

  const handleSaveFaq = (e: React.FormEvent) => {
    e.preventDefault();
    if (!faqQuestion.trim() || !faqAnswer.trim() || !editingFaq) return;

    // Sanitize text (prevent arbitrary script tags)
    const cleanQ = faqQuestion.replace(/<[^>]*>?/gm, '').trim();
    const cleanA = faqAnswer.replace(/<[^>]*>?/gm, '').trim();

    const exists = faqs.some((f) => f.id === editingFaq.id);
    let updated: FaqItem[];
    if (exists) {
      updated = faqs.map((f) => (f.id === editingFaq.id ? { ...f, question: cleanQ, answer: cleanA } : f));
    } else {
      updated = [...faqs, { id: editingFaq.id, question: cleanQ, answer: cleanA, enabled: true }];
    }

    setFaqs(updated);
    localStorage.setItem('saarvi_admin_faqs_v1', JSON.stringify(updated));
    setEditingFaq(null);
  };

  const handleDeleteFaq = (id: string) => {
    const updated = faqs.filter((f) => f.id !== id);
    setFaqs(updated);
    localStorage.setItem('saarvi_admin_faqs_v1', JSON.stringify(updated));
  };

  const handleToggleFaq = (id: string) => {
    const updated = faqs.map((f) => (f.id === id ? { ...f, enabled: !f.enabled } : f));
    setFaqs(updated);
    localStorage.setItem('saarvi_admin_faqs_v1', JSON.stringify(updated));
  };

  const handleSaveHomepageCopy = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      heroHeading: heroHeading.replace(/<[^>]*>?/gm, '').trim(),
      heroSubtitle: heroSubtitle.replace(/<[^>]*>?/gm, '').trim(),
      ctaText: ctaText.replace(/<[^>]*>?/gm, '').trim(),
    };
    localStorage.setItem('saarvi_admin_homepage_copy_v1', JSON.stringify(payload));
    if (user && profile) {
      adminService.updatePlatformSettings(
        {},
        { id: user.id, email: user.email, role: profile.role }
      );
    }
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="border-b border-slate-200/80 pb-4">
        <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-600" />
          <span>Content & FAQ Management</span>
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Safely manage public homepage copy, FAQ accordion items, and CTA labels without raw script injection.
        </p>
      </div>

      {savedSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>Homepage content updated successfully.</span>
        </div>
      )}

      {/* Homepage Copy Form */}
      <form onSubmit={handleSaveHomepageCopy} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
        <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-blue-600" />
          <span>Homepage Hero Section Copy</span>
        </h2>

        <div className="space-y-3 text-xs">
          <div className="space-y-1">
            <label className="block font-bold text-slate-700">Hero Main Heading</label>
            <input
              type="text"
              value={heroHeading}
              onChange={(e) => setHeroHeading(e.target.value)}
              required
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="space-y-1">
            <label className="block font-bold text-slate-700">Hero Subtitle</label>
            <textarea
              rows={2}
              value={heroSubtitle}
              onChange={(e) => setHeroSubtitle(e.target.value)}
              required
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="space-y-1">
            <label className="block font-bold text-slate-700">Primary CTA Button Label</label>
            <input
              type="text"
              value={ctaText}
              onChange={(e) => setCtaText(e.target.value)}
              required
              className="w-full sm:w-64 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save Homepage Copy</span>
          </button>
        </div>
      </form>

      {/* FAQ Management */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-blue-600" />
              <span>Frequently Asked Questions (FAQ)</span>
            </h2>
            <p className="text-[11px] text-slate-500">
              Displayed on public tools and informational pages.
            </p>
          </div>

          <button
            onClick={() => openFaqModal()}
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-semibold border border-blue-200 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add FAQ</span>
          </button>
        </div>

        <div className="divide-y divide-slate-100">
          {faqs.map((faq) => (
            <div key={faq.id} className="py-3 flex items-start justify-between gap-4 text-xs">
              <div className="space-y-1 min-w-0">
                <div className="font-bold text-slate-900 flex items-center gap-2">
                  <span>{faq.question}</span>
                  {!faq.enabled && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-500 font-semibold">
                      Disabled
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed max-w-2xl">
                  {faq.answer}
                </p>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => handleToggleFaq(faq.id)}
                  className="px-2 py-1 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg text-[11px] font-semibold border border-slate-200 transition-colors"
                >
                  {faq.enabled ? 'Deactivate' : 'Activate'}
                </button>
                <button
                  onClick={() => openFaqModal(faq)}
                  className="p-1 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-slate-100 transition-colors"
                  title="Edit"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleDeleteFaq(faq.id)}
                  className="p-1 text-slate-400 hover:text-red-600 rounded-lg hover:bg-slate-100 transition-colors"
                  title="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Edit FAQ Modal */}
      {editingFaq && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">
                {editingFaq.question ? 'Edit FAQ Item' : 'New FAQ Item'}
              </h3>
              <button
                onClick={() => setEditingFaq(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveFaq} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="block font-bold text-slate-700">Question</label>
                <input
                  type="text"
                  value={faqQuestion}
                  onChange={(e) => setFaqQuestion(e.target.value)}
                  required
                  placeholder="e.g. Is my document secure?"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-slate-700">Answer</label>
                <textarea
                  rows={4}
                  value={faqAnswer}
                  onChange={(e) => setFaqAnswer(e.target.value)}
                  required
                  placeholder="Detailed, clear answer without arbitrary HTML..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingFaq(null)}
                  className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold shadow-xs"
                >
                  Save FAQ Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
