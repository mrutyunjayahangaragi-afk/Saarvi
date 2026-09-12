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
} from 'lucide-react';
import { adminService } from '@/lib/services/adminService';
import { UserProfile, UserRole, UserAccountStatus } from '@/types/auth';
import { useAuth } from '@/context/AuthContext';
import AdminConfirmModal from '@/components/admin/AdminConfirmModal';

export default function AdminUsersPage() {
  const { user: currentUser, profile: currentProfile } = useAuth();
  const [users, setUsers] = useState<Array<Omit<UserProfile, 'avatarUrl'> & { status: UserAccountStatus }>>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | UserAccountStatus>('all');
  const [page, setPage] = useState(1);
  const limit = 10;

  // Confirmation Modals State
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<{
    type: 'SUSPEND' | 'ACTIVATE' | 'DELETE';
    userId: string;
    userName: string;
  } | null>(null);

  useEffect(() => {
    loadUsers();
  }, [search, roleFilter, statusFilter, page]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const res = await adminService.listUsers({
        search: search.trim() || undefined,
        role: roleFilter === 'all' ? undefined : roleFilter,
        status: statusFilter === 'all' ? undefined : statusFilter,
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
      alert(err?.message || 'Operation failed');
    }
  };

  const getStatusBadge = (status: UserAccountStatus) => {
    switch (status) {
      case 'ACTIVE':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">ACTIVE</span>;
      case 'SUSPENDED':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">SUSPENDED</span>;
      case 'DISABLED':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">DISABLED</span>;
      case 'PENDING':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">PENDING</span>;
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
            Manage account lifecycle, account suspension, and roles. Strict privacy: user documents and notes remain on device.
          </p>
        </div>

        <div className="text-xs text-slate-500 bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-xs">
          Total Accounts: <span className="font-bold text-slate-800">{total}</span>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
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

        <div className="flex items-center gap-2 w-full sm:w-auto">
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
                <th className="py-3 px-3">Account Status</th>
                <th className="py-3 px-3">Created</th>
                <th className="py-3 px-4 text-right">Administrative Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500">
                    Loading user records...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500">
                    No users found matching query.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{u.fullName}</div>
                      <div className="text-[11px] text-slate-500 font-mono">{u.email}</div>
                      <div className="text-[10px] text-slate-400 font-mono">ID: {u.id}</div>
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
                      {getStatusBadge(u.status)}
                    </td>

                    <td className="py-3 px-3 text-slate-500 font-mono text-[11px]">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
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
