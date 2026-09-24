"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { AuthSessionUser, UserProfile } from '@/types/auth';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/client';
import { MockStorageProvider } from '@/lib/supabase/mock-storage';
import { sanitizeInternalRedirectUrl } from '@/lib/security/url-security';
import { analytics } from '@/lib/analytics/tracker';
import { telemetry } from '@/lib/observability/telemetry';
import { academicStorage } from '@/lib/academic/storage/academic-db';

interface AuthContextType {
  user: AuthSessionUser | null;
  profile: UserProfile | null;
  isLoading: boolean;
  signIn: (params: { email: string; password: string }) => Promise<void>;
  signInWithGoogle: (options?: { redirectTo?: string }) => Promise<void>;
  signUp: (params: { email: string; password: string; fullName: string }) => Promise<void>;
  verifyEmailOtp: (params: { email: string; code: string }) => Promise<void>;
  resendVerificationOtp: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
  updateProfile: (data: { fullName?: string; avatarUrl?: string | null }) => Promise<void>;
  deleteAccount: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthSessionUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Synchronize local workspace boundary with authenticated identity
  useEffect(() => {
    academicStorage.setActiveProfileId(user ? user.id : 'guest');
  }, [user]);

  // Load profile helper
  const loadProfile = useCallback(async (userId: string, email: string) => {
    if (!isSupabaseConfigured()) {
      const session = MockStorageProvider.getCurrentSession();
      if (session && session.id === userId) {
        setUser(session);
        setProfile({
          id: session.id,
          fullName: session.fullName,
          email: session.email,
          role: session.role,
          createdAt: session.createdAt,
          updatedAt: session.createdAt,
        });
      }
      return;
    }

    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (!error && data) {
        const loadedAvatar =
          data.avatar_url ||
          data.avatar_path ||
          (data as any).avatar ||
          user?.avatarUrl;
        setProfile({
          id: data.id,
          fullName: data.full_name || '',
          email: email,
          avatarUrl: loadedAvatar || undefined,
          role: data.role || 'USER',
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        });
        setUser((prev) =>
          prev
            ? {
                ...prev,
                fullName: data.full_name || prev.fullName,
                avatarUrl: loadedAvatar || prev.avatarUrl,
              }
            : null
        );
      }
    } catch (err) {
      console.warn('Could not fetch user profile:', err);
    }
  }, [user]);

  // Initialize session on mount
  useEffect(() => {
    let mounted = true;

    async function initAuth() {
      if (!isSupabaseConfigured()) {
        const localSession = MockStorageProvider.getCurrentSession();
        if (mounted) {
          if (localSession) {
            setUser(localSession);
            setProfile({
              id: localSession.id,
              fullName: localSession.fullName,
              email: localSession.email,
              avatarUrl: (localSession as any).avatarUrl || undefined,
              role: localSession.role,
              createdAt: localSession.createdAt,
              updatedAt: localSession.createdAt,
            });
          } else {
            setUser(null);
            setProfile(null);
          }
          setIsLoading(false);
        }
        return;
      }

      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();

        if (mounted && session?.user) {
          const authUser: AuthSessionUser = {
            id: session.user.id,
            email: session.user.email || '',
            fullName: session.user.user_metadata?.full_name || session.user.user_metadata?.name || '',
            role: 'USER',
            createdAt: session.user.created_at,
          };
          setUser(authUser);
          await loadProfile(session.user.id, session.user.email || '');
        } else if (mounted) {
          setUser(null);
          setProfile(null);
        }
      } catch (err) {
        console.warn('Auth initialization error:', err);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    initAuth();

    // Supabase auth state change listener if live
    if (isSupabaseConfigured()) {
      const supabase = createClient();
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        async (_event, session) => {
          if (session?.user) {
            const authUser: AuthSessionUser = {
              id: session.user.id,
              email: session.user.email || '',
              fullName: session.user.user_metadata?.full_name || session.user.user_metadata?.name || '',
              role: 'USER',
              createdAt: session.user.created_at,
            };
            setUser(authUser);
            await loadProfile(session.user.id, session.user.email || '');
          } else {
            setUser(null);
            setProfile(null);
          }
          setIsLoading(false);
        }
      );

      return () => {
        mounted = false;
        subscription.unsubscribe();
      };
    }

    return () => {
      mounted = false;
    };
  }, [loadProfile]);

  const signIn = async ({ email, password }: { email: string; password: string }) => {
    if (!isSupabaseConfigured()) {
      const { user: sUser, profile: sProfile } = MockStorageProvider.signIn({ email, password });
      setUser(sUser);
      setProfile(sProfile);
      return;
    }

    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      if (
        error.message?.toLowerCase().includes("email not confirmed") ||
        error.message?.toLowerCase().includes("not confirmed")
      ) {
        throw new Error("EMAIL_NOT_CONFIRMED: Your email is not verified yet. Please enter the verification code sent to your email.");
      }
      throw new Error("We couldn't sign you in. Please check your email and password.");
    }

    if (data.user) {
      const authUser: AuthSessionUser = {
        id: data.user.id,
        email: data.user.email || '',
        fullName: data.user.user_metadata?.full_name || '',
        role: 'USER',
        createdAt: data.user.created_at,
      };
      setUser(authUser);
      await loadProfile(data.user.id, data.user.email || '');
    }
  };

  const signInWithGoogle = async (options?: { redirectTo?: string }) => {
    // 1. Emit privacy-safe analytics event
    try {
      analytics.trackEvent({
        name: 'auth_method_selected',
        method: 'google',
        category: 'auth',
      });
    } catch {
      // Non-blocking fail-safe
    }

    // 2. Measure execution with telemetry span
    await telemetry.measure('auth_oauth_google', async () => {
      if (!isSupabaseConfigured()) {
        const { user: sUser, profile: sProfile } = MockStorageProvider.signInWithGoogle();
        setUser(sUser);
        setProfile(sProfile);
        try {
          analytics.trackEvent({
            name: 'auth_success',
            method: 'google',
            category: 'auth',
          });
        } catch {
          // Non-blocking fail-safe
        }
        return;
      }

      const origin = typeof window !== 'undefined' ? window.location.origin : 'https://saarvi.in';
      const sanitizedNext = sanitizeInternalRedirectUrl(options?.redirectTo, '/dashboard');
      const callbackUrl = `${origin}/auth/callback?next=${encodeURIComponent(sanitizedNext)}`;

      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: callbackUrl,
          queryParams: {
            prompt: 'select_account',
          },
        },
      });

      if (error) {
        throw new Error("Unable to connect to Google authentication. Please try again.");
      }
    });
  };

  const signUp = async ({ email, password, fullName }: { email: string; password: string; fullName: string }) => {
    if (!isSupabaseConfigured()) {
      const { user: sUser, profile: sProfile } = MockStorageProvider.signUp({ email, password, fullName });
      setUser(sUser);
      setProfile(sProfile);
      return;
    }

    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, fullName }),
    });

    const result = await res.json();
    if (!res.ok || !result.success) {
      throw new Error(result.error || "We couldn't create your account. Please try again.");
    }
    // Server has dispatched branded OTP email via Gmail SMTP; user will now enter 6-digit code
  };

  const verifyEmailOtp = async ({ email, code }: { email: string; code: string }) => {
    const cleanCode = code.trim();
    if (!cleanCode || cleanCode.length < 6) {
      throw new Error("Please enter a valid verification code.");
    }

    if (!isSupabaseConfigured()) {
      const stored = MockStorageProvider.getUserByEmail(email);
      if (!stored) throw new Error("No pending registration found for this email address.");
      const sessionUser: AuthSessionUser = {
        id: stored.id,
        email: stored.email,
        fullName: stored.fullName,
        role: stored.role,
        createdAt: stored.createdAt,
      };
      setUser(sessionUser);
      setProfile({
        id: stored.id,
        fullName: stored.fullName,
        email: stored.email,
        role: stored.role,
        createdAt: stored.createdAt,
        updatedAt: stored.updatedAt,
      });

      // Dispatch registration success welcome email asynchronously (non-blocking)
      fetch('/api/auth/welcome', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: stored.email,
          fullName: stored.fullName,
          userId: stored.id,
        }),
      }).catch((err) => console.warn('[Auth] Welcome email async dispatch failed:', err));

      return;
    }

    const supabase = createClient();
    const tokenKey = 'token';
    let res = await supabase.auth.verifyOtp({
      email: email.trim(),
      [tokenKey]: cleanCode,
      type: 'signup',
    });

    if (res.error) {
      res = await supabase.auth.verifyOtp({
        email: email.trim(),
        [tokenKey]: cleanCode,
        type: 'email',
      });
    }

    if (res.error) {
      throw new Error(res.error.message || "Invalid or expired verification code. Please request a new code.");
    }

    if (res.data.user) {
      const authUser: AuthSessionUser = {
        id: res.data.user.id,
        email: res.data.user.email || '',
        fullName: res.data.user.user_metadata?.full_name || '',
        role: 'USER',
        createdAt: res.data.user.created_at,
      };
      setUser(authUser);
      await loadProfile(res.data.user.id, res.data.user.email || '');

      // Dispatch registration success welcome email asynchronously (non-blocking)
      fetch('/api/auth/welcome', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: res.data.user.email,
          fullName: res.data.user.user_metadata?.full_name,
          userId: res.data.user.id,
        }),
      }).catch((err) => console.warn('[Auth] Welcome email async dispatch failed:', err));
    }
  };

  const resendVerificationOtp = async (email: string) => {
    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      throw new Error("Please provide a valid email address.");
    }

    if (!isSupabaseConfigured()) {
      return;
    }

    const res = await fetch('/api/auth/resend-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cleanEmail }),
    });

    const result = await res.json();
    if (!res.ok || !result.success) {
      throw new Error(result.error || "Unable to resend verification code. Please wait a moment and try again.");
    }
  };

  const signOut = async () => {
    academicStorage.setActiveProfileId('guest');
    if (!isSupabaseConfigured()) {
      MockStorageProvider.signOut();
      setUser(null);
      setProfile(null);
      return;
    }

    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  };

  const resetPassword = async (email: string) => {
    if (!isSupabaseConfigured()) {
      // In local mode, simulate successful password reset email dispatch
      return;
    }

    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      // Safe messaging: do not expose whether the account exists
      throw new Error("If an account exists with this email, a reset link has been dispatched.");
    }
  };

  const updatePassword = async (newPassword: string) => {
    if (!user) throw new Error('You must be signed in to update your password.');

    if (!isSupabaseConfigured()) {
      MockStorageProvider.updatePassword(user.id, newPassword);
      return;
    }

    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      throw new Error(error.message || "Couldn't update password. Please try again.");
    }
  };

  const updateProfile = async (data: { fullName?: string; avatarUrl?: string | null }) => {
    if (!user) throw new Error('You must be signed in to update your profile.');

    // Optimistically update React state immediately across the app
    setProfile((prev) =>
      prev
        ? {
            ...prev,
            ...(data.fullName !== undefined ? { fullName: data.fullName } : {}),
            ...(data.avatarUrl !== undefined ? { avatarUrl: data.avatarUrl || undefined } : {}),
          }
        : null
    );
    setUser((prev) =>
      prev
        ? {
            ...prev,
            ...(data.fullName !== undefined ? { fullName: data.fullName } : {}),
            ...(data.avatarUrl !== undefined ? { avatarUrl: data.avatarUrl || undefined } : {}),
          }
        : null
    );

    if (!isSupabaseConfigured()) {
      const updated = MockStorageProvider.updateProfile(user.id, data as any);
      return;
    }

    const supabase = createClient();
    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (data.fullName !== undefined) {
      updatePayload.full_name = data.fullName;
    }
    if (data.avatarUrl !== undefined) {
      updatePayload.avatar_url = data.avatarUrl;
    }

    const { error } = await supabase
      .from('profiles')
      .update(updatePayload)
      .eq('id', user.id);

    if (error) {
      console.warn('[updateProfile notice]', error.message);
    }

    await loadProfile(user.id, user.email);
  };

  const deleteAccount = async () => {
    if (!user) throw new Error('You must be signed in to delete your account.');

    if (!isSupabaseConfigured()) {
      MockStorageProvider.deleteAccount(user.id);
      setUser(null);
      setProfile(null);
      return;
    }

    const supabase = createClient();
    // In live Supabase, delete profile triggers cascade or user deletion endpoint
    await supabase.from('profiles').delete().eq('id', user.id);
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  };

  const refreshProfile = async () => {
    if (user) {
      await loadProfile(user.id, user.email);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        isLoading,
        signIn,
        signInWithGoogle,
        signUp,
        verifyEmailOtp,
        resendVerificationOtp,
        signOut,
        resetPassword,
        updatePassword,
        updateProfile,
        deleteAccount,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
