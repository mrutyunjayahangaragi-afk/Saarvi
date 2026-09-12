"use client";

import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Shield,
  UserCheck,
  Lock,
  Check,
  X,
  AlertTriangle,
  UserPlus,
  ArrowRight,
} from 'lucide-react';
import { adminService } from '@/lib/services/adminService';
import { ROLE_PERMISSIONS, AdminPermission, AdminRole } from '@/types/admin';
import { UserProfile, UserRole } from '@/types/auth';
import { useAuth } from '@/context/AuthContext';
import AdminConfirmModal from '@/components/admin/AdminConfirmModal';

export default function AdminAdminsPage() {
  const { user: currentUser, profile: currentProfile } = useAuth();
  const [admins, setAdmins] = useState<Array<Omit<UserProfile, 'avatarUrl'>>>([]);
  const [loading, setLoading] = useState(true);

  // Role Change Confirmation Modal
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [pendingRoleChange, setPendingRoleChange] = useState<{
    userId: string;
    userName: string;
    targetRole: UserRole;
  } | null>(null);

  const isSuperAdmin = currentProfile?.role === 'SUPER_ADMIN';

  useEffect(() => {
    loadAdmins();
  }, []);

  const loadAdmins = async () => {
    setLoading(true);
    try {
      const res = await adminService.listUsers({ role: undefined, limit: 100 });
      // Filter for administrators
      const adminUsers = res.users.filter((u) => u.role === 'ADMIN' || u.role === 'SUPER_ADMIN');
      setAdmins(adminUsers);
    } catch (err) {
      console.error('Failed to load admins:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChangeClick = (
    userId: string,
    userName: string,
    targetRole: UserRole
  ) => {
    if (!isSuperAdmin) {
      alert('Only SUPER_ADMIN can modify administrator roles.');
      return;
    }
    setPendingRoleChange({ userId, userName, targetRole });
    setConfirmModalOpen(true);
  };

  const executeRoleChange = async () => {
    if (!pendingRoleChange || !currentUser || !currentProfile) return;

    try {
      await adminService.updateUserRole(
        pendingRoleChange.userId,
        pendingRoleChange.targetRole,
        { id: currentUser.id, email: currentUser.email, role: currentProfile.role }
      );
      setConfirmModalOpen(false);
      setPendingRoleChange(null);
      await loadAdmins();
    } catch (err: any) {
      alert(err?.message || 'Failed to update role');
    }
  };

  const allPermissions: { key: AdminPermission; label: string }[] = [
    { key: 'users.read', label: 'View User Accounts' },
    { key: 'users.update', label: 'Suspend / Edit Users' },
    { key: 'tools.read', label: 'Inspect Tools & Limits' },
    { key: 'tools.update', label: 'Modify Tool Status & Limits' },
    { key: 'curriculum.read', label: 'View VTU Curriculum' },
    { key: 'curriculum.update', label: 'Verify / Activate Curriculum' },
    { key: 'settings.update', label: 'Update Platform Settings' },
    { key: 'analytics.read', label: 'View Operational Metrics' },
    { key: 'audit.read', label: 'Inspect Audit Logs' },
    { key: 'security.manage', label: 'Manage Roles & Security' },
  ];

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="border-b border-slate-200/80 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-purple-600" />
            <span>Administrators & Role-Based Access Control (RBAC)</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Role hierarchy and granular operational permission governance. Normal administrators cannot elevate their privileges.
          </p>
        </div>

        {!isSuperAdmin && (
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold">
            <Lock className="w-3.5 h-3.5" />
            <span>Read-Only View: SUPER_ADMIN required to edit roles</span>
          </div>
        )}
      </div>

      {/* Admin Users Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <h2 className="text-xs font-bold text-slate-800">Authorized Platform Administrators</h2>
          <span className="text-[11px] text-slate-500">{admins.length} accounts</span>
        </div>

        <div className="divide-y divide-slate-100">
          {admins.map((admin) => (
            <div
              key={admin.id}
              className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
            >
              <div className="space-y-1">
                <div className="font-bold text-slate-900 flex items-center gap-2">
                  <span>{admin.fullName}</span>
                  <span className={`px-2 py-0.2 rounded-md font-mono text-[10px] font-semibold ${
                    admin.role === 'SUPER_ADMIN'
                      ? 'bg-purple-50 text-purple-700 border border-purple-200'
                      : 'bg-blue-50 text-blue-700 border border-blue-200'
                  }`}>
                    {admin.role}
                  </span>
                  {admin.id === currentUser?.id && (
                    <span className="text-[10px] text-slate-400">(You)</span>
                  )}
                </div>
                <div className="text-[11px] text-slate-500 font-mono">{admin.email}</div>
              </div>

              {isSuperAdmin && admin.id !== currentUser?.id && (
                <div className="flex items-center gap-2 shrink-0">
                  {admin.role === 'ADMIN' ? (
                    <button
                      onClick={() => handleRoleChangeClick(admin.id, admin.fullName, 'SUPER_ADMIN')}
                      className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg font-semibold border border-purple-200 transition-colors"
                    >
                      Promote to Super Admin
                    </button>
                  ) : (
                    <button
                      onClick={() => handleRoleChangeClick(admin.id, admin.fullName, 'ADMIN')}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold transition-colors"
                    >
                      Demote to Admin
                    </button>
                  )}
                  <button
                    onClick={() => handleRoleChangeClick(admin.id, admin.fullName, 'USER')}
                    className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg font-semibold border border-red-200 transition-colors"
                  >
                    Revoke Admin Access
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Role Permission Matrix */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50">
          <h2 className="text-xs font-bold text-slate-800">RBAC Permission Matrix</h2>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Strict capability enforcement evaluated server-side and throughout service operations.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/60 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-2.5 px-4">Permission Key</th>
                <th className="py-2.5 px-3">Description</th>
                <th className="py-2.5 px-3 text-center">SUPER_ADMIN</th>
                <th className="py-2.5 px-3 text-center">ADMIN</th>
                <th className="py-2.5 px-3 text-center">USER</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {allPermissions.map((perm) => {
                const superHas = ROLE_PERMISSIONS.SUPER_ADMIN.includes(perm.key);
                const adminHas = ROLE_PERMISSIONS.ADMIN.includes(perm.key);
                const userHas = ROLE_PERMISSIONS.USER.includes(perm.key);

                return (
                  <tr key={perm.key} className="hover:bg-slate-50/60 transition-colors font-sans">
                    <td className="py-2.5 px-4 font-mono font-semibold text-slate-900 text-[11px]">
                      {perm.key}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 text-xs">
                      {perm.label}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {superHas ? (
                        <Check className="w-4 h-4 text-emerald-600 mx-auto" />
                      ) : (
                        <X className="w-4 h-4 text-slate-300 mx-auto" />
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {adminHas ? (
                        <Check className="w-4 h-4 text-emerald-600 mx-auto" />
                      ) : (
                        <X className="w-4 h-4 text-slate-300 mx-auto" />
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {userHas ? (
                        <Check className="w-4 h-4 text-emerald-600 mx-auto" />
                      ) : (
                        <X className="w-4 h-4 text-slate-300 mx-auto" />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmation Modal */}
      <AdminConfirmModal
        isOpen={confirmModalOpen}
        onClose={() => {
          setConfirmModalOpen(false);
          setPendingRoleChange(null);
        }}
        onConfirm={executeRoleChange}
        variant={pendingRoleChange?.targetRole === 'USER' ? 'danger' : 'warning'}
        title={`Change role for ${pendingRoleChange?.userName}?`}
        message={`Are you sure you want to change this administrator's role to ${pendingRoleChange?.targetRole}? This will adjust their platform permissions immediately.`}
        confirmText={`Assign Role: ${pendingRoleChange?.targetRole}`}
      />
    </div>
  );
}
