"use client";

import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  Shield,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  MoreVertical,
  UserX,
  UserCheck,
  Trash2,
  Lock,
  Eye,
  Mail,
  Zap,
  Globe,
  Clock,
  X,
  ShieldCheck,
} from 'lucide-react';
import { adminService } from '@/lib/services/adminService';
import { UserProfile, UserRole, UserAccountStatus } from '@/types/auth';
import { useAuth } from '@/context/AuthContext';
import AdminConfirmModal from '@/components/admin/AdminConfirmModal';

interface DisplayUser extends Omit<UserProfile, 'avatarUrl'> {
  status: UserAccountStatus;
  authProvider?: 'EMAIL' | 'GOOGLE';
  plan?: 'FREE' | 'PRO';
  lastSignInAt?: string;
}

export default function AdminUsersPage() {
  const { user: currentUser, profile: currentProfile } = useAuth();
  const [users, setUsers] = useState<DisplayUser[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | UserAccountStatus>('all');
  const [planFilter, setPlanFilter] = useState<'all' | 'FREE' | 'PRO'>('all');
  const [page, setPage] = useState(1);
  const limit = 10;

  // Selected User for Detail View
  const [detailUser, setDetailUser] = useState<DisplayUser | null>(null);

  // Confirmation Modals State
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<{
    type: 'SUSPEND' | 'ACTIVATE' | 'DELETE';
    userId: string;
    userName: string;
  } | null>(null);

  useEffect(() => {
    loadUsers();
  }, [search, roleFilter, statusFilter, planFilter, page]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const res = await adminService.listUsers({
        search: search.trim() || undefined,
        role: roleFilter === 'all' ? undefined : roleFilter,
        status: statusFilter === 'all' ? undefined : statusFilter,
        plan: planFilter === 'all' ? undefined : planFilter,
        page,
        limit,
      });
      setUsers(res.users);
      setTotal(res.total);
    } catch (err) {
      console.error('Failed to list users:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleActionClick = (
    type: 'SUSPEND' | 'ACTIVATE' | 'DELETE',
    targetUser: { id: string; fullName: string }
  ) => {
    setPendingAction({
      type,
      userId: targetUser.id,
      userName: targetUser.fullName,
    });
    setConfirmModalOpen(true);
  };

  const executeConfirmedAction = async () => {
    if (!pendingAction || !currentUser || !currentProfile) return;

    try {
      if (pendingAction.type === 'SUSPEND') {
        await adminService.updateUserStatus(pendingAction.userId, 'SUSPENDED', {
          id: currentUser.id,
          email: currentUser.email,
          role: currentProfile.role,
        });
      } else if (pendingAction.type === 'ACTIVATE') {
        await adminService.updateUserStatus(pendingAction.userId, 'ACTIVE', {
          id: currentUser.id,
          email: currentUser.email,
          role: currentProfile.role,
        });
      } else if (pendingAction.type === 'DELETE') {
        await adminService.deleteUser(pendingAction.userId, {
          id: currentUser.id,
          email: currentUser.email,
          role: currentProfile.role,
        });
      }

      setConfirmModalOpen(false);
      setPendingAction(null);
      await loadUsers();
    } catch (err: any) {
      alert(`Action failed: ${err.message || 'Unknown error'}`);
    }
  };

  const getStatusBadge = (status: UserAccountStatus) => {
    switch (status) {
      case 'ACTIVE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-2.5 h-2.5" /> Active
          </span>
        );
      case 'SUSPENDED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <AlertTriangle className="w-2.5 h-2.5" /> Suspended
          </span>
        );
      case 'DISABLED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-700 border border-red-200">
            <XCircle className="w-2.5 h-2.5" /> Disabled
          </span>
        );
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            Pending
          </span>
        );
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="border-b border-slate-200/80 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            <span>User Account Management</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage account lifecycle, suspension, and plan entitlements. Strict privacy: user documents and notes remain client-side only.
          </p>
        </div>

        <div className="text-xs text-slate-500 bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-xs">
          Total Accounts: <span className="font-bold text-slate-800">{total}</span>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by name, email or ID..."
            className="w-full text-xs pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* Plan Filter */}
          <select
            value={planFilter}
            onChange={(e) => {
              setPlanFilter(e.target.value as any);
              setPage(1);
            }}
            className="text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Plans</option>
            <option value="FREE">Free Tier</option>
            <option value="PRO">Pro Tier</option>
          </select>

          {/* Role Filter */}
          <select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value as any);
              setPage(1);
            }}
            className="text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Roles</option>
            <option value="USER">User</option>
            <option value="ADMIN">Admin</option>
            <option value="SUPER_ADMIN">Super Admin</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as any);
              setPage(1);
            }}
            className="text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="DISABLED">Disabled</option>
            <option value="PENDING">Pending</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-3">Role</th>
                <th className="py-3 px-3">Plan</th>
                <th className="py-3 px-3">Auth</th>
                <th className="py-3 px-3">Account Status</th>
                <th className="py-3 px-3">Created</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    Loading user records...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    No users found matching query.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{u.fullName}</div>
                      <div className="text-[11px] text-slate-500 font-mono">{u.email}</div>
                    </td>

                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded-md font-mono text-[10px] font-semibold ${
                        u.role === 'SUPER_ADMIN'
                          ? 'bg-purple-50 text-purple-700 border border-purple-200'
                          : u.role === 'ADMIN'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'bg-slate-100 text-slate-700'
                      }`}>
                        {u.role}
                      </span>
                    </td>

                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        u.plan === 'PRO'
                          ? 'bg-amber-100 text-amber-800 border border-amber-300'
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {u.plan || 'FREE'}
                      </span>
                    </td>

                    <td className="py-3 px-3">
                      <span className="inline-flex items-center gap-1 text-[11px] text-slate-600 font-medium">
                        {u.authProvider === 'GOOGLE' ? (
                          <span className="text-blue-600 font-semibold">Google</span>
                        ) : (
                          <span>Email</span>
                        )}
                      </span>
                    </td>

                    <td className="py-3 px-3">
                      {getStatusBadge(u.status)}
                    </td>

                    <td className="py-3 px-3 text-slate-500 font-mono text-[11px]">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        {/* View Details */}
                        <button
                          onClick={() => setDetailUser(u)}
                          className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-medium transition flex items-center gap-1"
                          title="View Safe Profile Details"
                        >
                          <Eye className="w-3 h-3" /> View
                        </button>

                        {/* Suspend / Reactivate */}
                        {u.status === 'ACTIVE' ? (
                          <button
                            onClick={() => handleActionClick('SUSPEND', u)}
                            disabled={u.id === currentUser?.id}
                            className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-lg text-[11px] font-semibold border border-amber-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                          >
                            Suspend
                          </button>
                        ) : (
                          <button
                            onClick={() => handleActionClick('ACTIVATE', u)}
                            className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg text-[11px] font-semibold border border-emerald-200 transition-colors cursor-pointer"
                          >
                            Reactivate
                          </button>
                        )}

                        {currentProfile?.role === 'SUPER_ADMIN' && (
                          <button
                            onClick={() => handleActionClick('DELETE', u)}
                            disabled={u.id === currentUser?.id}
                            className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                            title="Delete Account"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-3 border-t border-slate-100 flex items-center justify-between bg-slate-50/50 text-xs">
            <span className="text-slate-500">
              Page {page} of {totalPages} ({total} accounts)
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-slate-700 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-slate-700 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Safe User Profile Modal */}
      {detailUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-base">
                  {detailUser.fullName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">{detailUser.fullName}</h3>
                  <p className="text-xs text-slate-500 font-mono">{detailUser.email}</p>
                </div>
              </div>
              <button
                onClick={() => setDetailUser(null)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Account Metadata Details */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[10px] uppercase font-bold text-slate-400">User ID</span>
                <p className="font-mono text-slate-800 font-medium truncate mt-0.5">{detailUser.id}</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[10px] uppercase font-bold text-slate-400">Account Status</span>
                <div className="mt-0.5">{getStatusBadge(detailUser.status)}</div>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[10px] uppercase font-bold text-slate-400">Subscription Plan</span>
                <p className="font-bold text-slate-800 mt-0.5">{detailUser.plan || 'FREE'}</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[10px] uppercase font-bold text-slate-400">Auth Provider</span>
                <p className="font-bold text-slate-800 mt-0.5">{detailUser.authProvider || 'EMAIL'}</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[10px] uppercase font-bold text-slate-400">Registered</span>
                <p className="font-medium text-slate-700 mt-0.5">{new Date(detailUser.createdAt).toLocaleString()}</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[10px] uppercase font-bold text-slate-400">Role</span>
                <p className="font-medium text-slate-700 mt-0.5">{detailUser.role}</p>
              </div>
            </div>

            {/* Strict Privacy Guarantee Box */}
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold text-emerald-950">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Zero Server Document Access Guarantee</span>
              </div>
              <p className="text-[11px] leading-relaxed text-emerald-800">
                Saarvi enforces strict client-side isolation. User conversion files, resume drafts, notes, timetable schedules, and academic calculations are stored purely in local browser storage (IndexedDB) and are inaccessible to platform administrators.
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setDetailUser(null)}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-slate-800 transition"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      <AdminConfirmModal
        isOpen={confirmModalOpen}
        onClose={() => {
          setConfirmModalOpen(false);
          setPendingAction(null);
        }}
        onConfirm={executeConfirmedAction}
        variant={pendingAction?.type === 'DELETE' ? 'danger' : 'warning'}
        title={`${pendingAction?.type} user "${pendingAction?.userName}"?`}
        message={
          pendingAction?.type === 'DELETE'
            ? 'This will permanently remove the user profile and associated account metadata. This action cannot be undone.'
            : pendingAction?.type === 'SUSPEND'
            ? 'The user will be blocked from signing in to Saarvi. Their local browser data will remain untouched on their device.'
            : 'The user account will be reactivated, restoring full workspace sign-in access.'
        }
        confirmText={
          pendingAction?.type === 'DELETE'
            ? 'Permanently Delete'
            : pendingAction?.type === 'SUSPEND'
            ? 'Suspend Account'
            : 'Reactivate Account'
        }
      />
    </div>
  );
}
