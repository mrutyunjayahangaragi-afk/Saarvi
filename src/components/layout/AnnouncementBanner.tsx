"use client";

import React, { useState, useEffect } from 'react';
import { AlertTriangle, Bell, Radio, X, Sparkles } from 'lucide-react';
import { adminService } from '@/lib/services/adminService';
import { AnnouncementRecord } from '@/types/admin';
import { usePlatform } from '@/context/PlatformContext';

export default function AnnouncementBanner() {
  const { isMaintenance, maintenanceMessage } = usePlatform();
  const [announcement, setAnnouncement] = useState<AnnouncementRecord | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    async function loadAnnouncements() {
      try {
        const announcements = await adminService.getActivePublicAnnouncements();

        if (announcements.length > 0) {
          // Select highest priority announcement
          const sorted = [...announcements].sort((a, b) => {
            const weights = { URGENT: 4, HIGH: 3, NORMAL: 2, LOW: 1 };
            return (weights[b.priority] || 0) - (weights[a.priority] || 0);
          });
          setAnnouncement(sorted[0]);
        }
      } catch (err) {
        // Safe fail-back: no error thrown to users
      }
    }

    loadAnnouncements();

    const handleUpdate = () => {
      loadAnnouncements();
    };

    window.addEventListener('saarvi_platform_change', handleUpdate);
    return () => {
      window.removeEventListener('saarvi_platform_change', handleUpdate);
    };
  }, []);

  if (dismissed) return null;

  // 1. Maintenance Mode has top precedence (reactively driven by usePlatform)
  if (isMaintenance) {
    return (
      <div
        className="bg-amber-500 text-white px-4 py-2.5 text-xs font-semibold shadow-xs flex items-center justify-between gap-3 z-50 sticky top-0"
        role="alert"
      >
        <div className="flex items-center gap-2 max-w-5xl mx-auto">
          <Radio className="w-4 h-4 animate-pulse shrink-0" />
          <span>{maintenanceMessage}</span>
        </div>
      </div>
    );
  }

  // 2. Platform Announcement
  if (!announcement) return null;

  const priorityStyles = {
    URGENT: 'bg-red-600 text-white',
    HIGH: 'bg-amber-600 text-white',
    NORMAL: 'bg-blue-600 text-white',
    LOW: 'bg-slate-800 text-white',
  };

  return (
    <div
      className={`px-4 py-2 text-xs font-semibold shadow-xs flex items-center justify-between gap-3 z-40 transition-all ${
        priorityStyles[announcement.priority] || 'bg-blue-600 text-white'
      }`}
      role="region"
      aria-label="Platform Announcement"
    >
      <div className="flex items-center gap-2.5 max-w-5xl mx-auto min-w-0">
        <Bell className="w-3.5 h-3.5 shrink-0" />
        <span className="font-bold shrink-0">{announcement.title}:</span>
        <span className="truncate opacity-95 font-normal">{announcement.content}</span>
      </div>

      {announcement.isDismissible && (
        <button
          onClick={() => setDismissed(true)}
          className="p-1 hover:bg-black/15 rounded-lg transition-colors shrink-0"
          aria-label="Dismiss announcement"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
