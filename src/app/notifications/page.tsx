"use client";

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { useAuth } from '@/context/AuthContext';
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
  const { user, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState('ALL');
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadNotifications = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      let url = '/api/notifications?limit=100';
      if (activeTab === 'UNREAD') {
        url += '&unread=true';
      } else if (activeTab !== 'ALL') {
        url += `&category=${encodeURIComponent(activeTab)}`;
      }

      const res = await fetch(url, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setLoading(false);
    }
  }, [user, activeTab]);

  useEffect(() => {
    if (!isLoading) {
      loadNotifications();
    }
  }, [isLoading, loadNotifications]);

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      // Optimistic update
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));

      await fetch(`/api/notifications/${notificationId}/read`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch (err) {
      console.error('Failed to mark read:', err);
    }
  };

  const handleCtaClick = async (notification: NotificationItem) => {
    try {
      await fetch(`/api/notifications/${notification.id}/click`, {
        method: 'POST',
        credentials: 'include',
      });
      // Also update read state
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notification.id ? { ...n, clicked: true, read: true } : n
        )
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (err) {
      console.error('Failed to track click:', err);
    }
  };

  const handleMarkAllAsRead = async () => {
    const unreadItems = notifications.filter((n) => !n.read);
    if (unreadItems.length === 0) return;

    // Optimistically mark all read
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);

    for (const item of unreadItems) {
      fetch(`/api/notifications/${item.id}/read`, {
        method: 'POST',
        credentials: 'include',
      }).catch(() => {});
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
      <Navbar />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8">
        {/* Header */}
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
              disabled={unreadCount === 0}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all cursor-pointer ${
                unreadCount > 0
                  ? 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200 shadow-2xs'
                  : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
              }`}
            >
              <Check className="w-3.5 h-3.5" />
              <span>Mark all as read</span>
            </button>
            <button
              type="button"
              onClick={loadNotifications}
              className="p-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 shadow-2xs cursor-pointer"
              title="Refresh notifications"
              aria-label="Refresh notifications"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Categories Tab Bar */}
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

        {/* Notifications Feed */}
        <div className="space-y-3 mt-2">
          {loading && notifications.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-400 bg-white rounded-2xl border border-slate-200">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
              <span>Loading your notifications...</span>
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 shadow-xs">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                <Inbox className="w-6 h-6" />
              </div>
              <h2 className="text-sm font-bold text-slate-800">No notifications here</h2>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                You&apos;re completely up to date! New platform releases and notices will appear here.
              </p>
            </div>
          ) : (
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
                        <Image
                          src={item.logo_url}
                          alt="Saarvi"
                          width={24}
                          height={24}
                          className="object-contain"
                          unoptimized
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
                          <Image
                            src={item.image_url}
                            alt={item.title}
                            width={500}
                            height={250}
                            className="w-full h-auto object-cover"
                            unoptimized
                          />
                        </div>
                      )}

                      {/* CTA Button */}
                      {item.cta_url && item.cta_text && (
                        <div className="mt-3.5 flex items-center gap-3">
                          <Link
                            href={item.cta_url}
                            onClick={() => handleCtaClick(item)}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs hover:shadow transition-all"
                          >
                            <span>{item.cta_text}</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </Link>

                          {!item.read && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMarkAsRead(item.id);
                              }}
                              className="text-[11px] font-semibold text-slate-500 hover:text-slate-700"
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
