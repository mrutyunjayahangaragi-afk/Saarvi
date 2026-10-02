"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { Bell, Mail, MessageSquare, ShieldCheck, UserPlus, LogIn, Info } from "lucide-react";
import { ReminderTiming } from "@/types/notifications";

interface ReminderConfigFieldsProps {
  emailReminder: boolean;
  setEmailReminder: (val: boolean) => void;
  whatsappReminder: boolean;
  setWhatsappReminder: (val: boolean) => void;
  reminderTiming: ReminderTiming;
  setReminderTiming: (val: ReminderTiming) => void;
  customMinutes?: number;
  setCustomMinutes?: (val: number) => void;
  phoneOverride?: string;
  setPhoneOverride?: (val: string) => void;
}

export default function ReminderConfigFields({
  emailReminder,
  setEmailReminder,
  whatsappReminder,
  setWhatsappReminder,
  reminderTiming,
  setReminderTiming,
  customMinutes,
  setCustomMinutes,
  phoneOverride,
  setPhoneOverride,
}: ReminderConfigFieldsProps) {
  const { user } = useAuth();
  const isGuest = !user || !user.email;

  return (
    <div className="mt-4 pt-4 border-t border-slate-200/80 dark:border-slate-800 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Smart Planning Reminders
          </span>
        </div>
        <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
          Email is Free
        </span>
      </div>

      {isGuest ? (
        /* Guest Registration Requirement Notice */
        <div className="rounded-xl border border-blue-100 dark:border-blue-900/50 bg-gradient-to-br from-blue-50/70 to-indigo-50/40 dark:from-blue-950/40 dark:to-indigo-950/30 p-3.5 text-xs text-slate-700 dark:text-slate-300 space-y-2.5">
          <div className="flex items-start gap-2.5">
            <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-slate-900 dark:text-white">Your plan is saved locally.</p>
              <p className="text-slate-600 dark:text-slate-300 mt-0.5 text-[11.5px] leading-relaxed">
                Create a free Saarvi account to receive email reminders. WhatsApp reminders are optional.
                Local planning is always free and never blocked.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <Link
              href="/signup"
              target="_blank"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors shadow-xs"
            >
              <UserPlus className="w-3.5 h-3.5" />
              Create free account
            </Link>
            <Link
              href="/login"
              target="_blank"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-[#162244] border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              <LogIn className="w-3.5 h-3.5" />
              Sign in
            </Link>
          </div>
        </div>
      ) : (
        /* Authenticated User Notification Options */
        <div className="space-y-3 bg-slate-50/80 dark:bg-[#0b1329]/60 rounded-xl p-3 border border-slate-200/60 dark:border-slate-800">
          {/* Email Option (Free & Default) */}
          <div className="flex items-start justify-between gap-2">
            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={emailReminder}
                onChange={(e) => setEmailReminder(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <div>
                <div className="flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-blue-600" />
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">Email Reminder</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-1.5 py-0.2 rounded border border-blue-100 dark:border-blue-800">
                    Free
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Delivered to your registered email: <span className="font-medium text-slate-700 dark:text-slate-300">{user.email}</span>
                </p>
              </div>
            </label>
          </div>

          {/* WhatsApp Option (Optional & Independent) */}
          <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800">
            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={whatsappReminder}
                onChange={(e) => setWhatsappReminder(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <div className="flex-1">
                <div className="flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">WhatsApp Reminder</span>
                  <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 bg-slate-200/60 dark:bg-slate-800 px-1.5 py-0.2 rounded">
                    Optional
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Optional channel. Email works completely independently even if WhatsApp is disabled.
                </p>
              </div>
            </label>

            {whatsappReminder && (
              <div className="mt-2.5 pl-6">
                <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
                  WhatsApp Phone Number (with country code):
                </label>
                <input
                  type="tel"
                  value={phoneOverride || ""}
                  onChange={(e) => setPhoneOverride?.(e.target.value)}
                  placeholder="e.g. +91 9876543210"
                  className="w-full text-xs px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#162244] text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                  Requires valid number with country code. Official WhatsApp Cloud API provider.
                </p>
              </div>
            )}
          </div>

          {/* Timing Dropdown */}
          {(emailReminder || whatsappReminder) && (
            <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800 flex items-center justify-between gap-4">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
                Remind me:
              </label>
              <select
                value={reminderTiming}
                onChange={(e) => setReminderTiming(e.target.value as ReminderTiming)}
                className="text-xs px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#162244] text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="same_day">Same day (Default)</option>
                <option value="1_day_before">1 day before</option>
                <option value="2_hours_before">2 hours before</option>
                <option value="1_hour_before">1 hour before</option>
                <option value="custom">Custom minutes</option>
              </select>
            </div>
          )}

          {reminderTiming === "custom" && (emailReminder || whatsappReminder) && setCustomMinutes && (
            <div className="flex items-center justify-between gap-4 pl-2">
              <label className="text-[11px] text-slate-600 dark:text-slate-400">Minutes before:</label>
              <input
                type="number"
                min={5}
                max={10080}
                value={customMinutes || 30}
                onChange={(e) => setCustomMinutes(Math.max(5, parseInt(e.target.value, 10) || 30))}
                className="w-24 text-xs px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#162244] text-slate-800 dark:text-slate-100 focus:outline-none"
              />
            </div>
          )}
        </div>
      )}

      {/* Privacy Guarantee Footer */}
      <div className="flex items-center gap-1.5 text-[10.5px] text-slate-500 dark:text-slate-400 pt-0.5">
        <ShieldCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
        <span>Privacy: Reminders transmit only title, date, and time. Notes & marks remain strictly local.</span>
      </div>
    </div>
  );
}
