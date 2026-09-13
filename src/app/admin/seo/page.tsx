"use client";

import React, { useState, useEffect } from 'react';
import {
  Search,
  Save,
  CheckCircle2,
  Globe,
  Shield,
  FileCode,
  Share2,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { adminService } from '@/lib/services/adminService';

export default function AdminSeoPage() {
  const { user, profile } = useAuth();
  const [siteTitle, setSiteTitle] = useState('Saarvi — Study. Work. Grow.');
  const [siteDescription, setSiteDescription] = useState('High-performance browser-based PDF and image conversion tools with VTU CBCS/NEP academic calculators and resume builders.');
  const [canonicalBase, setCanonicalBase] = useState('https://saarvi.in');
  const [ogTitle, setOgTitle] = useState('Saarvi — Study. Work. Grow.');
  const [ogDescription, setOgDescription] = useState('Fast client-side document utilities, SGPA/CGPA calculators, and career organizers.');
  const [robotsIndexable, setRobotsIndexable] = useState(true);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('saarvi_admin_seo_v1') || localStorage.getItem('docease_admin_seo_v1');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.siteTitle) setSiteTitle(parsed.siteTitle);
        if (parsed.siteDescription) setSiteDescription(parsed.siteDescription);
        if (parsed.canonicalBase) setCanonicalBase(parsed.canonicalBase);
        if (parsed.ogTitle) setOgTitle(parsed.ogTitle);
        if (parsed.ogDescription) setOgDescription(parsed.ogDescription);
        if (parsed.robotsIndexable !== undefined) setRobotsIndexable(parsed.robotsIndexable);
      }
    } catch {}
  }, []);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      siteTitle: siteTitle.trim(),
      siteDescription: siteDescription.trim(),
      canonicalBase: canonicalBase.trim(),
      ogTitle: ogTitle.trim(),
      ogDescription: ogDescription.trim(),
      robotsIndexable,
    };
    localStorage.setItem('saarvi_admin_seo_v1', JSON.stringify(payload));
    if (user && profile) {
      adminService.updatePlatformSettings({}, { id: user.id, email: user.email, role: profile.role });
    }
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="border-b border-slate-200/80 pb-4">
        <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <Search className="w-5 h-5 text-blue-600" />
          <span>SEO & Metadata Management</span>
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Configure search engine title tags, meta descriptions, Open Graph social cards, and indexing policies.
        </p>
      </div>

      {savedSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>SEO configuration updated successfully.</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Core Meta Tags */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Globe className="w-4 h-4 text-blue-600" />
            <span>Search Engine Identity</span>
          </h2>

          <div className="space-y-3 text-xs">
            <div className="space-y-1">
              <label className="block font-bold text-slate-700">Global Title Tag</label>
              <input
                type="text"
                value={siteTitle}
                onChange={(e) => setSiteTitle(e.target.value)}
                required
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-1">
              <label className="block font-bold text-slate-700">Default Meta Description</label>
              <textarea
                rows={2}
                value={siteDescription}
                onChange={(e) => setSiteDescription(e.target.value)}
                required
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-1">
              <label className="block font-bold text-slate-700">Canonical Base URL</label>
              <input
                type="url"
                value={canonicalBase}
                onChange={(e) => setCanonicalBase(e.target.value)}
                required
                className="w-full sm:w-80 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Social / Open Graph */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Share2 className="w-4 h-4 text-purple-600" />
            <span>Social Share Cards (Open Graph / Twitter)</span>
          </h2>

          <div className="space-y-3 text-xs">
            <div className="space-y-1">
              <label className="block font-bold text-slate-700">OG Title</label>
              <input
                type="text"
                value={ogTitle}
                onChange={(e) => setOgTitle(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-1">
              <label className="block font-bold text-slate-700">OG Description</label>
              <textarea
                rows={2}
                value={ogDescription}
                onChange={(e) => setOgDescription(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Search Index Control & Admin Boundary (Section 63) */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-600" />
            <span>Robots & Indexing Rules</span>
          </h2>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-bold text-slate-800">Public Page Indexing</div>
                <div className="text-[11px] text-slate-500">Allow search engine spiders to crawl and index public tools and information pages.</div>
              </div>
              <input
                type="checkbox"
                checked={robotsIndexable}
                onChange={(e) => setRobotsIndexable(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
              />
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
              <div className="font-semibold text-slate-700">Private Boundary Protection (Section 63):</div>
              <div className="text-[11px] text-slate-500">
                All administrative routes (<code className="font-mono text-purple-700">/admin/*</code>) and user workspace routes (<code className="font-mono text-purple-700">/dashboard/*</code>) are automatically protected with <code className="font-mono text-red-600">noindex, nofollow</code> in <code className="font-mono">robots.ts</code>.
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save SEO Settings</span>
          </button>
        </div>
      </form>
    </div>
  );
}
