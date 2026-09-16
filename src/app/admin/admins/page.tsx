"use client";

import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  UserCheck,
  Lock,
  Check,
  X,
  AlertTriangle,
  UserPlus,
  ArrowRight,
  Search,
  History,
  Shield,
} from 'lucide-react';
import { adminService } from '@/lib/services/adminService';
import { ROLE_PERMISSIONS, AdminPermission } from '@/types/admin';
import { UserProfile, UserRole } from '@/types/auth';
import { useAuth } from '@/context/AuthContext';
import AdminConfirmModal from '@/components/admin/AdminConfirmModal';

interface RoleAuditEntry {
  id: string;
  actor_user_id: string;
  target_user_id: string;
  old_role: string;
  new_role: string;
  action: string;
  reason?: string;
  timestamp: string;
}

export default function AdminAdminsPage() {
  const { user: currentUser, profile: currentProfile } = useAuth();
  const [admins, setAdmins] = useState<Array<Omit<UserProfile, 'avatarUrl'>>>([]);
  const [allUsers, setAllUsers] = useState<Array<Omit<UserProfile, 'avatarUrl'>>>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleAudits, setRoleAudits] = useState<RoleAuditEntry[]>([]);

  // Role Change Confirmation Modal
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [pendingRoleChange, setPendingRoleChange] = useState<{
    userId: string;
    userName: string;
    currentRole: UserRole;
    targetRole: UserRole;
    actionLabel: string;
  } | null>(null);

  const isSuperAdmin = currentProfile?.role === 'SUPER_ADMIN';

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminService.listUsers({ limit: 100 });
      setAllUsers(res.users);
      // Filter for administrators and super administrators
      const adminUsers = res.users.filter((u) => u.role === 'ADMIN' || u.role === 'SUPER_ADMIN');
      setAdmins(adminUsers);

      // Load role audit logs if available
      try {
        const auditRes = await fetch('/api/admin/audit-logs?action=ROLE', { credentials: 'include' });
        if (auditRes.ok) {
          const auditData = await auditRes.json();
          if (Array.isArray(auditData.logs)) {
            setRoleAudits(auditData.logs);
          }
        }
      } catch {}
    } catch (err) {
      console.error('Failed to load admins:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const activeSuperAdminCount = admins.filter(
    (a) => a.role === 'SUPER_ADMIN' && a.status === 'ACTIVE'
  ).length;

  const handleRoleChangeClick = (
    userId: string,
    userName: string,
    currentRole: UserRole,
    targetRole: UserRole,
    actionLabel: string
  ) => {
    if (!isSuperAdmin) {
      alert('Forbidden: Only SUPER_ADMIN can modify administrator roles.');
      return;
    }

    if (currentRole === 'SUPER_ADMIN' && targetRole !== 'SUPER_ADMIN' && activeSuperAdminCount <= 1) {
      alert('At least one active SuperAdmin is required.');
      return;
    }

    setPendingRoleChange({ userId, userName, currentRole, targetRole, actionLabel });
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
      await loadData();
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

  // Users eligible for promotion to Admin
  const nonAdminCandidates = allUsers.filter(
    (u) =>
      u.role === 'USER' &&
      (u.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email.toLowerCase().includes(searchQuery.toLowerCase()))
  );

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
            Strict role hierarchy: <strong className="text-purple-700">SUPER_ADMIN</strong> &rarr; <strong className="text-blue-700">ADMIN</strong> &rarr; <strong className="text-slate-700">USER</strong>. Normal administrators cannot elevate their privileges.
          </p>
        </div>

        {!isSuperAdmin && (
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold">
            <Lock className="w-3.5 h-3.5" />
            <span>Read-Only View: SUPER_ADMIN required to manage administrators</span>
          </div>
        )}
      </div>

      {/* Active SuperAdmin Protection Banner */}
      <div className="bg-purple-50/60 border border-purple-200/80 rounded-2xl p-4 flex items-start gap-3 text-xs text-purple-900">
        <Shield className="w-5 h-5 text-purple-600 shrink-0 mt-0.5" />
        <div>
          <h2 className="font-bold text-sm text-purple-950">SuperAdmin Invariant Enforced</h2>
          <p className="mt-0.5 text-purple-800 leading-relaxed">
            The platform server-authoritatively protects the administrative root. At least one active <span className="font-mono font-bold">SUPER_ADMIN</span> must exist at all times. Attempts to demote, suspend, or delete the last SuperAdmin are strictly blocked.
          </p>
        </div>
      </div>

      {/* Admin Users Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <h2 className="text-xs font-bold text-slate-800">Authorized Platform Administrators</h2>
          <span className="text-[11px] text-slate-500 font-semibold">{admins.length} accounts</span>
        </div>

        <div className="divide-y divide-slate-100">
          {admins.map((admin) => {
            const isTargetLastSuperAdmin = admin.role === 'SUPER_ADMIN' && activeSuperAdminCount <= 1;

            return (
              <div
                key={admin.id}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs hover:bg-slate-50/50 transition-colors"
              >
                <div className="space-y-1">
                  <div className="font-bold text-slate-900 flex items-center gap-2">
                    <span>{admin.fullName}</span>
                    <span
                      className={`px-2 py-0.5 rounded-md font-mono text-[10px] font-bold tracking-wider ${
                        admin.role === 'SUPER_ADMIN'
                          ? 'bg-purple-100 text-purple-800 border border-purple-300'
                          : 'bg-blue-100 text-blue-800 border border-blue-300'
                      }`}
                    >
                      {admin.role}
                    </span>
                    {admin.id === currentUser?.id && (
                      <span className="text-[10px] text-slate-400 font-medium">(You)</span>
                    )}
                    {isTargetLastSuperAdmin && (
                      <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-semibold border border-amber-300">
                        Sole Active SuperAdmin
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono">{admin.email}</div>
                </div>

                {/* Privileged Management Controls (Only visible to SUPER_ADMIN) */}
                {isSuperAdmin && admin.id !== currentUser?.id && (
                  <div className="flex items-center gap-2 shrink-0">
                    {admin.role === 'SUPER_ADMIN' ? (
                      <button
                        type="button"
                        disabled={isTargetLastSuperAdmin}
                        onClick={() =>
                          handleRoleChangeClick(
                            admin.id,
                            admin.fullName,
                            'SUPER_ADMIN',
                            'ADMIN',
                            'Revoke SuperAdmin / Demote to Admin'
                          )
                        }
                        title={
                          isTargetLastSuperAdmin
                            ? 'At least one active SuperAdmin is required.'
                            : 'Revoke SuperAdmin / Demote to Admin'
                        }
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                          isTargetLastSuperAdmin
                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                            : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 shadow-2xs'
                        }`}
                      >
                        Revoke SuperAdmin / Demote to Admin
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            handleRoleChangeClick(
                              admin.id,
                              admin.fullName,
                              'ADMIN',
                              'USER',
                              'Revoke Admin Access'
                            )
                          }
                          className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg text-xs font-semibold border border-red-200 transition-colors shadow-2xs"
                        >
                          Revoke Admin Access
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleRoleChangeClick(
                              admin.id,
                              admin.fullName,
                              'ADMIN',
                              'USER',
                              'Demote to User'
                            )
                          }
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors"
                        >
                          Demote to User
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* SuperAdmin Action: Authorize / Promote User to Admin */}
      {isSuperAdmin && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <UserPlus className="w-4 h-4 text-purple-600" />
              <span>Authorize New Platform Administrator</span>
            </h2>
            <span className="text-[11px] text-slate-400">SuperAdmin Action</span>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search registered user by name or email to promote to ADMIN..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
            />
          </div>

          {searchQuery.trim().length > 0 && (
            <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 border border-slate-100 rounded-xl">
              {nonAdminCandidates.length === 0 ? (
                <div className="p-3 text-center text-xs text-slate-400">
                  No registered users match &ldquo;{searchQuery}&rdquo;
                </div>
              ) : (
                nonAdminCandidates.slice(0, 5).map((candidate) => (
                  <div
                    key={candidate.id}
                    className="p-2.5 flex items-center justify-between text-xs hover:bg-slate-50"
                  >
                    <div>
                      <div className="font-bold text-slate-800 flex items-center gap-2">
                        <span>{candidate.fullName}</span>
                        <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 text-[10px] font-mono">
                          USER
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono">{candidate.email}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        handleRoleChangeClick(
                          candidate.id,
                          candidate.fullName,
                          'USER',
                          'ADMIN',
                          'Promote to Admin'
                        )
                      }
                      className="px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold text-xs transition-colors shadow-2xs"
                    >
                      Promote to Admin
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

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
                <th className="py-2.5 px-3 text-center">
                  <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-800 font-mono text-[9px] font-bold">
                    SUPER_ADMIN
                  </span>
                </th>
                <th className="py-2.5 px-3 text-center">
                  <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-mono text-[9px] font-bold">
                    ADMIN
                  </span>
                </th>
                <th className="py-2.5 px-3 text-center">
                  <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[9px] font-bold">
                    USER
                  </span>
                </th>
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
        title={`${pendingRoleChange?.actionLabel} for ${pendingRoleChange?.userName}?`}
        message={`Are you sure you want to execute "${pendingRoleChange?.actionLabel}"? This will modify the user's role from ${pendingRoleChange?.currentRole} to ${pendingRoleChange?.targetRole} and adjust platform authorization immediately.`}
        confirmText={pendingRoleChange?.actionLabel || 'Confirm Role Change'}
      />
    </div>
  );
}
