"use client";

import React, { useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { useAuth } from '@/context/AuthContext';
import { useDataFetch } from '@/hooks/useDataFetch';
import { SaarviLoadingLogo } from '@/components/brand/SaarviLoadingLogo';
import {
  Bell,
  CheckCircle2,
  Calendar,
  ExternalLink,
  ChevronRight,
  Inbox,
  Filter,
  Sparkles,
  ShieldAlert,
  Briefcase,
  GraduationCap,
  Megaphone,
  Tag,
  Check,
  RefreshCw,
  AlertCircle,
  LogIn,
} from 'lucide-react';

interface NotificationItem {
  id: string;
  recipientRecordId: string;
  title: string;
  subtitle?: string;
  body: string;
  category: string;
  type: string;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
  logo_url?: string;
  image_url?: string;
  cta_text?: string;
  cta_url?: string;
  created_at: string;
  sent_at?: string;
  read: boolean;
  read_at?: string;
  clicked: boolean;
}

interface NotificationsApiResponse {
  success: boolean;
  unreadCount: number;
  total: number;
  notifications: NotificationItem[];
}

const CATEGORY_TABS = [
  { key: 'ALL', label: 'All' },
  { key: 'UNREAD', label: 'Unread' },
  { key: 'ANNOUNCEMENT', label: 'Announcements' },
  { key: 'OFFER', label: 'Offers' },
  { key: 'INTERVIEW', label: 'Interviews' },
  { key: 'CAREER', label: 'Career' },
  { key: 'ACADEMIC', label: 'Academic' },
  { key: 'SYSTEM', label: 'System' },
];

export default function NotificationCenterPage() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [activeTab, setActiveTab] = useState('ALL');

  // Build the request endpoint with current filter
  const endpoint = useMemo(() => {
    let url = '/api/notifications?limit=100';
    if (activeTab === 'UNREAD') {
      url += '&unread=true';
    } else if (activeTab !== 'ALL') {
      url += `&category=${encodeURIComponent(activeTab)}`;
    }
    return url;
  }, [activeTab]);

  // Centralized async fetcher with SWR, deduplication, and timeout
  const fetcher = useCallback(async (signal: AbortSignal): Promise<NotificationsApiResponse> => {
    const res = await fetch(endpoint, {
      credentials: 'include',
      signal,
    });

    if (!res.ok) {
      if (res.status === 401) {
        return { success: false, unreadCount: 0, total: 0, notifications: [] };
      }
      throw new Error(`Failed to load notifications (status: ${res.status})`);
    }

    const json = await res.json();
    return {
      success: true,
      unreadCount: json.unreadCount || 0,
      total: json.total || 0,
      notifications: json.notifications || [],
    };
  }, [endpoint]);

  const {
    data,
    state,
    isLoading,
    isEmpty,
    isError,
    error,
    retry,
    mutate,
  } = useDataFetch<NotificationsApiResponse>(endpoint, fetcher, {
    enabled: !isAuthLoading && Boolean(user),
    userId: user?.id,
    scope: 'notifications',
    ttlMs: 30_000,
    timeoutMs: 8_000,
    isEmpty: (res) => !res || !res.notifications || res.notifications.length === 0,
  });

  const notifications = data?.notifications || [];
  const unreadCount = data?.unreadCount || 0;

  // Optimistic Read Action
  const handleMarkAsRead = async (notificationId: string) => {
    mutate((prev) => {
      if (!prev) return prev as unknown as NotificationsApiResponse;
      const updated = prev.notifications.map((n) =>
        n.id === notificationId ? { ...n, read: true } : n
      );
      return {
        ...prev,
        unreadCount: Math.max(0, prev.unreadCount - 1),
        notifications: updated,
      };
    });

    try {
      await fetch(`/api/notifications/${notificationId}/read`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch (err) {
      console.warn('Failed to mark notification read:', err);
    }
  };

  // Optimistic CTA Click Action
  const handleCtaClick = async (notification: NotificationItem) => {
    mutate((prev) => {
      if (!prev) return prev as unknown as NotificationsApiResponse;
      const updated = prev.notifications.map((n) =>
        n.id === notification.id ? { ...n, clicked: true, read: true } : n
      );
      return {
        ...prev,
        unreadCount: Math.max(0, prev.unreadCount - 1),
        notifications: updated,
      };
    });

    try {
      await fetch(`/api/notifications/${notification.id}/click`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch (err) {
      console.warn('Failed to track notification click:', err);
    }
  };

  // Optimistic Mark All Read Action
  const handleMarkAllAsRead = async () => {
    if (notifications.length === 0 || unreadCount === 0) return;

    mutate((prev) => {
      if (!prev) return prev as unknown as NotificationsApiResponse;
      const updated = prev.notifications.map((n) => ({ ...n, read: true }));
      return {
        ...prev,
        unreadCount: 0,
        notifications: updated,
      };
    });

    try {
      await fetch('/api/notifications/read-all', {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // Per-item fallback
      for (const item of notifications.filter((n) => !n.read)) {
        fetch(`/api/notifications/${item.id}/read`, {
          method: 'POST',
          credentials: 'include',
        }).catch(() => {});
      }
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category.toUpperCase()) {
      case 'ANNOUNCEMENT':
        return <Megaphone className="w-4 h-4 text-purple-600" />;
      case 'OFFER':
      case 'PROMOTION':
        return <Tag className="w-4 h-4 text-emerald-600" />;
      case 'INTERVIEW':
        return <Sparkles className="w-4 h-4 text-blue-600" />;
      case 'CAREER':
      case 'SCHOLARSHIP':
        return <Briefcase className="w-4 h-4 text-indigo-600" />;
      case 'ACADEMIC':
        return <GraduationCap className="w-4 h-4 text-amber-600" />;
      case 'SYSTEM':
      case 'MAINTENANCE':
        return <ShieldAlert className="w-4 h-4 text-red-600" />;
      default:
        return <Bell className="w-4 h-4 text-slate-500" />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* 1. IMMEDIATE UI SHELL: Navbar renders immediately */}
      <Navbar />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8">
        {/* 2. IMMEDIATE UI SHELL: Header renders immediately */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-blue-600/10 border border-blue-600/20 flex items-center justify-center text-blue-600">
                <Bell className="w-5 h-5" />
              </div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Saarvi Notification Center
              </h1>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Platform updates, personalized announcements, academic notices, and interview releases.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleMarkAllAsRead}
              disabled={unreadCount === 0 || !user}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all cursor-pointer ${
                unreadCount > 0 && user
                  ? 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200 shadow-2xs'
                  : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
              }`}
            >
              <Check className="w-3.5 h-3.5" />
              <span>Mark all as read</span>
            </button>
            <button
              type="button"
              onClick={() => retry()}
              disabled={isLoading || !user}
              className="p-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 shadow-2xs cursor-pointer disabled:opacity-50"
              title="Refresh notifications"
              aria-label="Refresh notifications"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
            </button>
          </div>
        </div>

        {/* 3. IMMEDIATE UI SHELL: Category Tabs render immediately */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-4 scrollbar-none">
          {CATEGORY_TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span>{tab.label}</span>
                {tab.key === 'UNREAD' && unreadCount > 0 && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      isActive ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-700'
                    }`}
                  >
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* 4. SECTION-LEVEL CONTENT AREA */}
        <div className="space-y-3 mt-2 min-h-[300px]">
          {/* Guest / Unauthenticated State */}
          {!isAuthLoading && !user ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
                <LogIn className="w-6 h-6" />
              </div>
              <div className="space-y-1 max-w-sm mx-auto">
                <h2 className="text-sm font-bold text-slate-900">Sign in to view your notifications</h2>
                <p className="text-xs text-slate-500">
                  Access your personalized platform updates, academic notices, and interview releases.
                </p>
              </div>
              <Link
                href="/login?next=/notifications"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors"
              >
                <span>Sign in to Saarvi</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          ) : isLoading && notifications.length === 0 ? (
            /* Official Saarvi S-Logo Section-Level Loading State */
            <div className="p-16 text-center bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col items-center justify-center">
              <SaarviLoadingLogo
                size="md"
                state="loading"
                message="Loading your notifications..."
              />
            </div>
          ) : isError ? (
            /* Error State with Isolated Retry */
            <div className="p-12 text-center bg-white rounded-2xl border border-red-200 shadow-xs space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="space-y-1 max-w-sm mx-auto">
                <h2 className="text-sm font-bold text-slate-900">We couldn&apos;t load your notifications</h2>
                <p className="text-xs text-slate-500">
                  {error?.message || 'A network error occurred while fetching notifications.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => retry()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry notifications</span>
              </button>
            </div>
          ) : isEmpty || notifications.length === 0 ? (
            /* Empty State */
            <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 shadow-xs">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                <Inbox className="w-6 h-6" />
              </div>
              <h2 className="text-sm font-bold text-slate-800">You&apos;re all caught up</h2>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                New platform announcements, academic notices, and interview updates will appear here automatically.
              </p>
            </div>
          ) : (
            /* Notification Cards */
            notifications.map((item) => {
              const formattedDate = new Date(item.created_at).toLocaleDateString('en-US', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              });
              const formattedTime = new Date(item.created_at).toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <div
                  key={item.id}
                  onClick={() => !item.read && handleMarkAsRead(item.id)}
                  className={`relative p-5 rounded-2xl border transition-all bg-white ${
                    item.read
                      ? 'border-slate-200/80 shadow-2xs hover:border-slate-300'
                      : 'border-blue-200/90 bg-blue-50/20 shadow-xs ring-1 ring-blue-500/10'
                  }`}
                >
                  {/* Unread indicator */}
                  {!item.read && (
                    <div
                      className="absolute top-4 right-4 w-2 h-2 rounded-full bg-blue-600 ring-4 ring-blue-100"
                      title="Unread"
                    />
                  )}

                  <div className="flex items-start gap-4">
                    {/* Saarvi Brand Logo / Category Icon */}
                    <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200/90 flex items-center justify-center shrink-0 shadow-2xs overflow-hidden">
                      {item.logo_url ? (
                        <img
                          src={
                            item.logo_url.includes('brand/saarvi') || item.logo_url.includes('saarvi-mark')
                              ? '/brand/saarvi-mark.png'
                              : item.logo_url
                          }
                          alt="Saarvi"
                          width={24}
                          height={24}
                          className="object-contain"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                            const parent = (e.target as HTMLElement).parentElement;
                            if (parent) {
                              parent.innerHTML = '<span class="text-blue-600 font-bold text-xs">S</span>';
                            }
                          }}
                        />
                      ) : (
                        getCategoryIcon(item.category)
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* Meta header */}
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                          Saarvi
                        </span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded font-mono font-semibold bg-slate-100 text-slate-600">
                          {item.category}
                        </span>
                        {item.priority === 'CRITICAL' && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded font-bold bg-red-100 text-red-700">
                            CRITICAL
                          </span>
                        )}
                        <span className="text-[11px] text-slate-400">&bull;</span>
                        <span className="text-[11px] text-slate-400">
                          {formattedDate} at {formattedTime}
                        </span>
                      </div>

                      {/* Title */}
                      <h3 className="text-sm font-bold text-slate-900 leading-snug">
                        {item.title}
                      </h3>

                      {/* Subtitle */}
                      {item.subtitle && (
                        <p className="text-xs font-semibold text-slate-600 mt-0.5">
                          {item.subtitle}
                        </p>
                      )}

                      {/* Body */}
                      <p className="text-xs text-slate-600 leading-relaxed mt-2 whitespace-pre-line">
                        {item.body}
                      </p>

                      {/* Optional Image */}
                      {item.image_url && (
                        <div className="mt-3 rounded-xl overflow-hidden border border-slate-200 max-w-md">
                          <img
                            src={
                              item.image_url.includes('brand/saarvi')
                                ? '/brand/saarvi-mark.png'
                                : item.image_url
                            }
                            alt={item.title}
                            className="w-full h-auto object-cover max-h-72"
                            onError={(e) => {
                              const parent = (e.target as HTMLElement).parentElement;
                              if (parent) parent.style.display = 'none';
                            }}
                          />
                        </div>
                      )}

                      {/* CTA Button */}
                      {item.cta_url && item.cta_text && (
                        <div className="mt-3.5 flex items-center gap-3">
                          {item.cta_url.startsWith('http://') || item.cta_url.startsWith('https://') ? (
                            <a
                              href={item.cta_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={() => handleCtaClick(item)}
                              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs hover:shadow transition-all"
                            >
                              <span>{item.cta_text}</span>
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          ) : (
                            <Link
                              href={item.cta_url.startsWith('/') ? item.cta_url : `/${item.cta_url}`}
                              onClick={() => handleCtaClick(item)}
                              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs hover:shadow transition-all"
                            >
                              <span>{item.cta_text}</span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </Link>
                          )}

                          {!item.read && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMarkAsRead(item.id);
                              }}
                              className="text-[11px] font-semibold text-slate-500 hover:text-slate-700 cursor-pointer"
                            >
                              Mark as read
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
