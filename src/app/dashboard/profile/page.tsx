"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { User, Mail, Calendar, Trash2, Key, CheckCircle2, AlertTriangle, Loader2, Camera } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import AvatarUploadModal from "@/components/profile/AvatarUploadModal";

export default function ProfilePage() {
  const router = useRouter();
  const { user, profile, updateProfile, updatePassword, deleteAccount } = useAuth();

  // Name edit state
  const [fullName, setFullName] = useState(profile?.fullName || user?.fullName || "");
  const [isUpdatingName, setIsUpdatingName] = useState(false);
  const [nameSuccess, setNameSuccess] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  // Password update state
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isUpdatingPass, setIsUpdatingPass] = useState(false);
  const [passSuccess, setPassSuccess] = useState(false);
  const [passError, setPassError] = useState<string | null>(null);

  // Avatar state
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(
    profile?.avatarUrl || (user as any)?.user_metadata?.avatar_url || null
  );

  // Account deletion modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault();
    setNameError(null);
    setNameSuccess(false);

    if (!fullName.trim()) {
      setNameError("Name cannot be empty.");
      return;
    }

    setIsUpdatingName(true);
    try {
      await updateProfile({ fullName: fullName.trim() });
      setNameSuccess(true);
      setTimeout(() => setNameSuccess(false), 2500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update profile name.";
      setNameError(msg);
    } finally {
      setIsUpdatingName(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassError(null);
    setPassSuccess(false);

    if (newPassword.length < 6) {
      setPassError("New password must be at least 6 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPassError("Passwords do not match.");
      return;
    }

    setIsUpdatingPass(true);
    try {
      await updatePassword(newPassword);
      setPassSuccess(true);
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setPassSuccess(false), 2500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update password.";
      setPassError(msg);
    } finally {
      setIsUpdatingPass(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== "DELETE") return;

    setIsDeleting(true);
    try {
      await deleteAccount();
      router.push("/");
    } catch {
      alert("Failed to delete account. Please try again.");
      setIsDeleting(false);
    }
  };

  const createdDate = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString(undefined, {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "Recently";

  return (
    <div className="space-y-8 max-w-3xl">
      
      {/* Header */}
      <div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
          <User className="w-7 h-7 text-blue-600 dark:text-blue-400" />
          <span>Profile & Account</span>
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
          Manage your personal details, credentials, and account lifecycle
        </p>
      </div>

      {/* 1. PROFILE DETAILS CARD */}
      <div className="p-6 sm:p-8 bg-white dark:bg-[#111c38] border border-slate-200/90 dark:border-slate-800 rounded-3xl shadow-xs space-y-6">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
          Personal Information
        </h3>

        {nameSuccess && (
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Profile name updated successfully.</span>
          </div>
        )}

        {nameError && (
          <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
            {nameError}
          </div>
        )}

        {/* Avatar Presentation & Upload Trigger */}
        <div className="flex items-center gap-4 pb-2 border-b border-slate-100 dark:border-slate-800">
          <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white text-xl font-bold overflow-hidden shadow-xs shrink-0 select-none">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="Profile Avatar"
                className="w-full h-full object-cover"
              />
            ) : (
              <span>
                {(fullName || "S")
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2)}
              </span>
            )}
          </div>
          <div>
            <h4 className="text-sm font-semibold text-slate-800 dark:text-white">Profile Photo</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">WebP, PNG, or JPG up to 5MB</p>
            <button
              type="button"
              onClick={() => setShowAvatarModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 active:bg-slate-300 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
            >
              <Camera className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
              <span>Change Photo</span>
            </button>
          </div>
        </div>

        <form onSubmit={handleUpdateName} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Full Name
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white dark:focus:bg-slate-900"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider">
                Email Address
              </label>
              <div className="px-4 py-2.5 bg-slate-100/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-600 dark:text-slate-300 flex items-center gap-2 select-none">
                <Mail className="w-4 h-4 text-slate-400" />
                <span className="truncate">{user?.email}</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider">
                Account Created
              </label>
              <div className="px-4 py-2.5 bg-slate-100/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-600 dark:text-slate-300 flex items-center gap-2 select-none">
                <Calendar className="w-4 h-4 text-slate-400" />
                <span>{createdDate}</span>
              </div>
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={isUpdatingName}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-70 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              {isUpdatingName ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>

      {/* 2. SECURITY & PASSWORD CARD */}
      <div className="p-6 sm:p-8 bg-white dark:bg-[#111c38] border border-slate-200/90 dark:border-slate-800 rounded-3xl shadow-xs space-y-6">
        <div className="flex items-center gap-2">
          <Key className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
            Change Password
          </h3>
        </div>

        {passSuccess && (
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Password changed successfully.</span>
          </div>
        )}

        {passError && (
          <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
            {passError}
          </div>
        )}

        <form onSubmit={handleUpdatePassword} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                New Password
              </label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white dark:focus:bg-slate-900"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Confirm New Password
              </label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat new password"
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white dark:focus:bg-slate-900"
              />
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={isUpdatingPass}
              className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 dark:bg-blue-600 dark:hover:bg-blue-700 active:bg-black disabled:opacity-70 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              {isUpdatingPass ? "Updating..." : "Update Password"}
            </button>
          </div>
        </form>
      </div>

      {/* 3. DANGER ZONE: ACCOUNT DELETION */}
      <div className="p-6 sm:p-8 bg-red-50/50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/60 rounded-3xl space-y-4">
        <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
          <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
          <h3 className="text-sm font-bold uppercase tracking-wider">
            Danger Zone
          </h3>
        </div>

        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed max-w-xl">
          Permanently delete your account and all associated workspace data. This includes your profile, conversion history metadata, saved resumes, and preferences.
        </p>

        <div className="pt-2">
          <button
            type="button"
            onClick={() => setShowDeleteModal(true)}
            className="px-4 py-2.5 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors flex items-center gap-2 cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            <span>Delete Account</span>
          </button>
        </div>
      </div>

      {/* DESTRUCTIVE CONFIRMATION MODAL */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#111c38] border border-red-200 dark:border-red-900/60 rounded-3xl max-w-md w-full p-6 sm:p-8 space-y-5 shadow-2xl animate-in fade-in duration-150">
            <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
              <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-900 dark:text-white">Delete your account?</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">This action cannot be undone</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              All personal data, conversion history metadata, and saved resume drafts will be immediately and permanently deleted.
            </p>

            <div className="space-y-2">
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                Type <span className="font-mono text-red-600 dark:text-red-400 font-extrabold">DELETE</span> to confirm:
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="DELETE"
                className="w-full px-3.5 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-red-600 focus:bg-white dark:focus:bg-slate-900"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteConfirmText("");
                }}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteConfirmText !== "DELETE" || isDeleting}
                onClick={handleDeleteAccount}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <span>Permanently Delete</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AVATAR UPLOAD MODAL */}
      <AvatarUploadModal
        isOpen={showAvatarModal}
        onClose={() => setShowAvatarModal(false)}
        currentAvatarUrl={avatarUrl}
        userFullName={fullName || user?.fullName}
        onAvatarUpdated={(newUrl) => {
          setAvatarUrl(newUrl);
          updateProfile({ avatarUrl: newUrl || undefined } as any).catch(() => {});
        }}
      />

    </div>
  );
}
