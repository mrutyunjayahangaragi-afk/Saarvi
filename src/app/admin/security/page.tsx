"use client";

import React, { useState } from 'react';
import {
  ShieldCheck,
  Lock,
  Key,
  Shield,
  CheckCircle2,
  AlertTriangle,
  Server,
  Users,
  EyeOff,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { isSupabaseConfigured } from '@/lib/supabase/config';

export default function AdminSecurityPage() {
  const { user, profile } = useAuth();
  const [sessionDuration] = useState('7 Days (SameSite=Lax)');

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="border-b border-slate-200/80 pb-4">
        <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-purple-600" />
          <span>Security Center & Access Governance</span>
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Review authentication security posture, session token policies, and environment isolation. Secrets are never displayed.
        </p>
      </div>

      {/* Security Status Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Card 1: Auth & Role Security */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-50 text-purple-600 border border-purple-100">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xs font-bold text-slate-900">Role-Based Access Enforcement</h2>
              <div className="text-[11px] text-slate-500">SUPER_ADMIN vs ADMIN vs USER</div>
            </div>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            All administrative routes and API mutations check actor roles server-side. Normal administrators cannot escalate their privileges or delete user accounts.
          </p>
          <div className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg inline-block border border-emerald-200">
            Active: Strict RBAC Guard Enabled
          </div>
        </div>

        {/* Card 2: Environment Security */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
              <Server className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xs font-bold text-slate-900">Environment & Secret Hygiene</h2>
              <div className="text-[11px] text-slate-500">Client vs Server isolation</div>
            </div>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Service role keys and server database secrets are isolated from client bundles. Admin panels strictly omit secret keys and tokens from export and view layers.
          </p>
          <div className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg inline-block border border-emerald-200">
            Compliant: Zero Secret Exposure
          </div>
        </div>

        {/* Card 3: Session Security */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600 border border-amber-100">
              <Key className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xs font-bold text-slate-900">Session Cookie Policy</h2>
              <div className="text-[11px] text-slate-500">SameSite=Lax Cookie Management</div>
            </div>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Local sessions utilize sanitized cookies with SameSite=Lax and automatic expiration. Tokens are cleared synchronously on sign out.
          </p>
          <div className="text-[11px] font-mono text-slate-600 bg-slate-50 px-2.5 py-1 rounded-lg inline-block border border-slate-200">
            Policy: {sessionDuration}
          </div>
        </div>

        {/* Card 4: Local Workspace Isolation */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xs font-bold text-slate-900">Local Workspace Boundary</h2>
              <div className="text-[11px] text-slate-500">Air-gapped document processing</div>
            </div>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            In compliance with Section 2, administrators cannot view or download private user PDFs, notes, study tasks, marks, or resume content.
          </p>
          <div className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg inline-block border border-emerald-200">
            Audited: No Remote Document Storage
          </div>
        </div>
      </div>

      {/* Sensitive Action Guard Protocol */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
        <h2 className="text-sm font-bold text-slate-900">Sensitive Action Protection Safeguards</h2>
        <div className="divide-y divide-slate-100 text-xs">
          <div className="py-2.5 flex items-center justify-between">
            <span className="text-slate-700">Account Deletion & Suspension</span>
            <span className="font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200 text-[10px]">
              Requires Explicit Confirmation
            </span>
          </div>
          <div className="py-2.5 flex items-center justify-between">
            <span className="text-slate-700">Tool Deactivation & Maintenance Toggles</span>
            <span className="font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 text-[10px]">
              Impact Warning Dialog
            </span>
          </div>
          <div className="py-2.5 flex items-center justify-between">
            <span className="text-slate-700">Global Guest Access Deactivation</span>
            <span className="font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 text-[10px]">
              Section 7 Warning Modal
            </span>
          </div>
          <div className="py-2.5 flex items-center justify-between">
            <span className="text-slate-700">Curriculum Activation</span>
            <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 text-[10px]">
              Pre-Activation Automated Validator
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
