"use client";

import React, { useState, useEffect } from 'react';
import {
  Bell,
  Plus,
  Edit2,
  Trash2,
  Calendar,
  AlertTriangle,
  Sparkles,
  CheckCircle2,
  Clock,
  Send,
} from 'lucide-react';
import { adminService } from '@/lib/services/adminService';
import { AnnouncementRecord, AnnouncementType, AnnouncementStatus, AnnouncementPriority } from '@/types/admin';
import { useAuth } from '@/context/AuthContext';
import AdminConfirmModal from '@/components/admin/AdminConfirmModal';

export default function AdminAnnouncementsPage() {
  const { user, profile } = useAuth();
  const [announcements, setAnnouncements] = useState<AnnouncementRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Editor Modal State
  const [editingItem, setEditingItem] = useState<AnnouncementRecord | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [type, setType] = useState<AnnouncementType>('STUDENT');
  const [status, setStatus] = useState<AnnouncementStatus>('PUBLISHED');
  const [priority, setPriority] = useState<AnnouncementPriority>('NORMAL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [saving, setSaving] = useState(false);

  // Delete Confirmation Modal
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    loadAnnouncements();
  }, []);

  const loadAnnouncements = async () => {
    setLoading(true);
    try {
      const data = await adminService.getAnnouncements();
      setAnnouncements(data);
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = (item?: AnnouncementRecord) => {
    if (item) {
      setEditingItem(item);
      setTitle(item.title);
      setContent(item.content);
      setType(item.type);
      setStatus(item.status);
      setPriority(item.priority);
      setStartDate(item.startDate ? item.startDate.substring(0, 10) : '');
      setEndDate(item.endDate ? item.endDate.substring(0, 10) : '');
    } else {
      setEditingItem({
        id: '',
        title: '',
        content: '',
        type: 'STUDENT',
        status: 'PUBLISHED',
        priority: 'NORMAL',
        targetAudience: 'ALL',
        isDismissible: true,
        publishedBy: user?.email || 'admin@saarvi.app',
        createdAt: '',
        updatedAt: '',
      });
      setTitle('');
      setContent('');
      setType('STUDENT');
      setStatus('PUBLISHED');
      setPriority('NORMAL');
      setStartDate('');
      setEndDate('');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem || !user || !profile) return;

    setSaving(true);
    try {
      const record: AnnouncementRecord = {
        ...editingItem,
        id: editingItem.id || `ann_${Date.now()}`,
        title: title.trim(),
        content: content.trim(),
        type,
        status,
        priority,
        startDate: startDate ? new Date(startDate).toISOString() : undefined,
        endDate: endDate ? new Date(endDate).toISOString() : undefined,
        publishedBy: user.email,
        createdAt: editingItem.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await adminService.saveAnnouncement(record, {
        id: user.id,
        email: user.email,
        role: profile.role,
      });

      setEditingItem(null);
      await loadAnnouncements();
    } catch (err: any) {
      alert(err?.message || 'Failed to save announcement');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingId || !user || !profile) return;
    try {
      await adminService.deleteAnnouncement(deletingId, {
        id: user.id,
        email: user.email,
        role: profile.role,
      });
      setDeleteModalOpen(false);
      setDeletingId(null);
      await loadAnnouncements();
    } catch (err: any) {
      alert(err?.message || 'Failed to delete');
    }
  };

  const getPriorityBadge = (p: AnnouncementPriority) => {
    switch (p) {
      case 'URGENT':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">URGENT</span>;
      case 'HIGH':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">HIGH</span>;
      case 'NORMAL':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">NORMAL</span>;
      case 'LOW':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">LOW</span>;
    }
  };

  const getStatusBadge = (s: AnnouncementStatus) => {
    switch (s) {
      case 'PUBLISHED':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">PUBLISHED</span>;
      case 'DRAFT':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">DRAFT</span>;
      case 'SCHEDULED':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">SCHEDULED</span>;
      case 'EXPIRED':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-400 border border-slate-200">EXPIRED</span>;
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="border-b border-slate-200/80 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Bell className="w-5 h-5 text-amber-600" />
            <span>Platform Announcements & Alerts</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Broadcast service updates, maintenance schedules, and student notices through clean top alerts.
          </p>
        </div>

        <button
          onClick={() => openCreateModal()}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Announcement</span>
        </button>
      </div>

      {/* Announcements List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="divide-y divide-slate-100">
          {announcements.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              No platform announcements published yet.
            </div>
          ) : (
            announcements.map((item) => (
              <div
                key={item.id}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs hover:bg-slate-50/50 transition-colors"
              >
                <div className="space-y-1.5 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-slate-900 text-sm">{item.title}</span>
                    <span className="text-[10px] font-semibold px-2 py-0.2 rounded-md font-mono bg-slate-100 text-slate-700">
                      {item.type}
                    </span>
                    {getPriorityBadge(item.priority)}
                    {getStatusBadge(item.status)}
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed max-w-3xl">
                    {item.content}
                  </p>

                  <div className="flex items-center gap-4 text-[11px] text-slate-400 font-mono">
                    <span>By: {item.publishedBy}</span>
                    {item.startDate && <span>Starts: {new Date(item.startDate).toLocaleDateString()}</span>}
                    {item.endDate && <span>Ends: {new Date(item.endDate).toLocaleDateString()}</span>}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                  <button
                    onClick={() => openCreateModal(item)}
                    className="p-1.5 text-slate-500 hover:text-blue-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                    title="Edit"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      setDeletingId(item.id);
                      setDeleteModalOpen(true);
                    }}
                    className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Editor Modal */}
      {editingItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">
                {editingItem.id ? 'Edit Announcement' : 'Publish New Announcement'}
              </h3>
              <button
                onClick={() => setEditingItem(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="block font-bold text-slate-700">Headline</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  placeholder="e.g. Scheduled System Upgrade"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-slate-700">Notice Body</label>
                <textarea
                  rows={3}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  required
                  placeholder="Clear, concise message for public visitors..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block font-bold text-slate-700">Category</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as AnnouncementType)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="STUDENT">Student Notice</option>
                    <option value="FEATURE">New Feature</option>
                    <option value="MAINTENANCE">Maintenance</option>
                    <option value="UPDATE">Platform Update</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-slate-700">Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as AnnouncementStatus)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="PUBLISHED">Published (Active)</option>
                    <option value="DRAFT">Draft</option>
                    <option value="SCHEDULED">Scheduled</option>
                    <option value="EXPIRED">Expired</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-slate-700">Priority</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as AnnouncementPriority)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="NORMAL">Normal</option>
                    <option value="LOW">Low</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-slate-700">End Date (Optional)</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold shadow-xs"
                >
                  {saving ? 'Publishing...' : 'Save Announcement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <AdminConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setDeletingId(null);
        }}
        onConfirm={handleDelete}
        variant="danger"
        title="Delete Announcement?"
        message="This notice will be permanently removed and no longer displayed on public pages."
        confirmText="Delete Announcement"
      />
    </div>
  );
}
