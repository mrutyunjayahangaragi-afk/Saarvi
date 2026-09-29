"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Menu,
  X,
  FileText,
  Search,
  Command,
  ChevronDown,
  Layers,
  FileImage,
  GraduationCap,
  User,
  LayoutDashboard,
  History,
  Settings,
  LogOut,
  Shield,
  Sparkles,
  MessageSquare,
  Briefcase,
  Bell,
  LayoutGrid,
  Combine,
  Minimize2,
  Calculator,
  Zap,
} from "lucide-react";
import { SITE_CONFIG } from "@/config/site";
import { SaarviNavbarLogo } from "@/components/brand/SaarviLogo";
import { useAuth } from "@/context/AuthContext";
import { usePlatform } from "@/context/PlatformContext";
import { useFeedback } from "@/context/FeedbackContext";
import MegaMenu, { ActiveMenuCategory } from "./MegaMenu";
import GlobalSearchModal from "@/components/tools/GlobalSearchModal";
import AnnouncementBanner from "./AnnouncementBanner";

import { getStartupNavigation, getJobsFeatureControl } from "@/lib/api/request-coalesce";

const NAVBAR_ICON_MAP: Record<string, React.ElementType> = {
  FileText,
  FileImage,
  GraduationCap,
  Briefcase,
  Sparkles,
  LayoutGrid,
  Combine,
  Minimize2,
  Calculator,
  Zap,
  Search,
};

function getToolIcon(name?: string): React.ElementType {
  if (!name) return FileText;
  return NAVBAR_ICON_MAP[name] || FileText;
}

const DEFAULT_ESSENTIAL_TOOLS = [
  { key: 'merge-pdf', name: 'Merge PDF', route: '/tools/merge-pdf', icon: 'Combine', category: 'pdf' },
  { key: 'compress-pdf', name: 'Compress PDF', route: '/tools/compress-pdf', icon: 'Minimize2', category: 'pdf' },
  { key: 'pdf-to-jpg', name: 'PDF to JPG', route: '/tools/pdf-to-jpg', icon: 'FileImage', category: 'pdf' },
  { key: 'jpg-to-pdf', name: 'JPG to PDF', route: '/tools/jpg-to-pdf', icon: 'FileText', category: 'image' },
  { key: 'sgpa-calculator', name: 'SGPA Calculator', route: '/student/sgpa-calculator', icon: 'Calculator', category: 'academic' },
  { key: 'resume-builder', name: 'Resume Builder', route: '/student/resume', icon: 'Briefcase', category: 'career' },
];

export default function Navbar() {
  const { user, profile, signOut, isLoading } = useAuth();
  const { appName, tagline } = usePlatform();
  const { openFeedback } = useFeedback();
  const router = useRouter();
  const [activeCategory, setActiveCategory] = useState<ActiveMenuCategory>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileExpandedSection, setMobileExpandedSection] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [navCategories, setNavCategories] = useState<any[]>([]);
  const [essentialTools, setEssentialTools] = useState<any[]>(DEFAULT_ESSENTIAL_TOOLS);
  const [isMac, setIsMac] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [jobsNavbarVisible, setJobsNavbarVisible] = useState(true);

  // Section 35: Background scroll lock when mobile drawer is open
  useEffect(() => {
    if (mobileMenuOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [mobileMenuOpen]);

  // Sync Jobs & Internships navbar visibility from feature control with SWR cache
  useEffect(() => {
    let mounted = true;
    let lastFocusCheck = 0;

    async function checkJobsNavbar(force = false) {
      try {
        const data = await getJobsFeatureControl(force);
        if (!mounted) return;
        if (data.navbar_visible === false || data.mode === 'DISABLED' || data.enabled === false) {
          setJobsNavbarVisible(false);
        } else {
          setJobsNavbarVisible(true);
        }
      } catch {}
    }

    checkJobsNavbar();

    const handleFeatureChanged = (e: any) => {
      const detail = e?.detail;
      if (detail) {
        if (detail.navbar_visible === false || detail.mode === 'DISABLED' || detail.enabled === false) {
          setJobsNavbarVisible(false);
        } else {
          setJobsNavbarVisible(true);
        }
      } else {
        checkJobsNavbar(true);
      }
    };

    // Throttle focus handler to at most once per 15s to prevent focus thrashing
    const onWindowFocus = () => {
      const now = Date.now();
      if (now - lastFocusCheck > 15_000) {
        lastFocusCheck = now;
        checkJobsNavbar();
      }
    };

    window.addEventListener('saarvi:jobs-feature-changed', handleFeatureChanged);
    window.addEventListener('focus', onWindowFocus);
    return () => {
      mounted = false;
      window.removeEventListener('saarvi:jobs-feature-changed', handleFeatureChanged);
      window.removeEventListener('focus', onWindowFocus);
    };
  }, []);

  const userAvatar =
    profile?.avatarUrl ||
    user?.avatarUrl ||
    (user as any)?.user_metadata?.avatar_url ||
    null;

  useEffect(() => {
    if (typeof window !== "undefined") {
      const ua = window.navigator?.userAgent || "";
      setIsMac(/macintosh|mac os x/i.test(ua));
    }
  }, []);

  // Coalesced & cached navigation categories loading
  useEffect(() => {
    let mounted = true;
    async function loadNav() {
      try {
        const data = await getStartupNavigation();
        if (mounted && Array.isArray(data.categories) && data.categories.length > 0) {
          setNavCategories(data.categories);
        }
        if (mounted && Array.isArray(data.essentialTools) && data.essentialTools.length > 0) {
          setEssentialTools(data.essentialTools);
        }
      } catch {}
    }
    loadNav();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setUnreadNotifications(0);
      return;
    }
    let isCancelled = false;
    let lastFocusFetch = 0;

    const fetchUnread = async () => {
      try {
        const { dataClient } = await import('@/lib/data/data-client');
        const res = await dataClient.fetch(
          '/api/notifications?limit=1',
          async (signal) => {
            const response = await fetch('/api/notifications?limit=1', {
              credentials: 'include',
              signal,
            });
            if (!response.ok) return null;
            return response.json();
          },
          {
            userId: user.id,
            scope: 'notifications',
            ttlMs: 30_000,
            timeoutMs: 6_000,
          }
        );

        if (!isCancelled && res?.data && typeof res.data.unreadCount === 'number') {
          setUnreadNotifications(res.data.unreadCount);
        }
      } catch {}
    };

    fetchUnread();

    // Refresh periodically every 30 seconds and throttled on window focus (min 15s)
    const interval = setInterval(fetchUnread, 30000);
    const onFocus = () => {
      const now = Date.now();
      if (now - lastFocusFetch > 15_000) {
        lastFocusFetch = now;
        fetchUnread();
      }
    };
    window.addEventListener('focus', onFocus);

    return () => {
      isCancelled = true;
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [user?.id]);

  const handleToolClick = (toolId: string, category: string) => {
    try {
      fetch('/api/analytics/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventType: 'NAVBAR_TOOL_CLICK',
          toolId,
          toolSlug: toolId,
          metadata: { source: 'navbar', category },
        }),
      }).catch(() => {});
    } catch {}
  };

  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const openTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const accountDropdownRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const pathname = usePathname();

  // Clear pending timers on unmount
  useEffect(() => {
    return () => {
      if (openTimeoutRef.current) clearTimeout(openTimeoutRef.current);
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    };
  }, []);

  // Close account dropdown and mega menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (accountDropdownRef.current && !accountDropdownRef.current.contains(e.target as Node)) {
        setAccountMenuOpen(false);
      }
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) {
        setActiveCategory(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Scroll elevation & dismissal listener: scrolling closes active mega menu
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 15);
      if (window.scrollY > 10) {
        setActiveCategory(null);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Close mega menu on route change
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    setActiveCategory(null);
    setMobileMenuOpen(false);
  }

  // Global Cmd+K / Ctrl+K keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      } else if (e.key === "Escape") {
        setActiveCategory(null);
        setAccountMenuOpen(false);
        setMobileMenuOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Robust Pointer-Intent Hover Management (60ms intent delay, 280ms safe diagonal transit buffer)
  const handleNavMouseEnter = (category: ActiveMenuCategory) => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    // If a category is already visible, switch immediately with zero delay
    if (activeCategory) {
      if (openTimeoutRef.current) clearTimeout(openTimeoutRef.current);
      setActiveCategory(category);
    } else {
      if (openTimeoutRef.current) clearTimeout(openTimeoutRef.current);
      openTimeoutRef.current = setTimeout(() => {
        setActiveCategory(category);
      }, 60);
    }
  };

  const handleNavMouseLeave = () => {
    if (openTimeoutRef.current) {
      clearTimeout(openTimeoutRef.current);
      openTimeoutRef.current = null;
    }
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
    }
    // 280ms safe transit buffer allowing diagonal pointer movement without menu collapsing
    closeTimeoutRef.current = setTimeout(() => {
      setActiveCategory(null);
    }, 280);
  };

  const handleMenuMouseEnter = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    if (openTimeoutRef.current) {
      clearTimeout(openTimeoutRef.current);
      openTimeoutRef.current = null;
    }
  };

  const handleMenuMouseLeave = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
    }
    closeTimeoutRef.current = setTimeout(() => {
      setActiveCategory(null);
    }, 280);
  };

  const toggleMobileSection = (section: string) => {
    setMobileExpandedSection((prev) => (prev === section ? null : section));
  };

  return (
    <>
      <AnnouncementBanner />
      <header
        ref={headerRef}
        className={`sticky top-0 z-40 w-full transition-all duration-200 ${
          isScrolled
            ? "bg-white/95 backdrop-blur-md border-b border-slate-200/90 shadow-xs"
            : "bg-white/90 backdrop-blur-xs border-b border-slate-100"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4 relative">
          
          {/* LEFT: Official Saarvi Logo */}
          <Link
            href="/"
            className="flex items-center group transition-transform duration-200 hover:scale-[1.02] active:scale-95 shrink-0"
            aria-label="Saarvi Home"
          >
            <SaarviNavbarLogo />
          </Link>

          {/* CENTER: Desktop Mega Menu Navigation Links */}
          <nav
            className="hidden md:flex items-center gap-1 text-sm font-medium text-slate-600"
            aria-label="Main Navigation"
          >
            {/* 1. MASTER TOOLS LAUNCHER (Consolidates PDF, Images, Student, Career, AI) */}
            <div
              onMouseEnter={() => handleNavMouseEnter("tools")}
              onMouseLeave={handleNavMouseLeave}
              className="relative py-2"
            >
              <Link
                href="/tools"
                aria-expanded={activeCategory === "tools"}
                aria-haspopup="true"
                onFocus={() => handleNavMouseEnter("tools")}
                onClick={(e) => {
                  if (activeCategory === "tools") {
                    e.preventDefault();
                    setActiveCategory(null);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setActiveCategory(activeCategory === "tools" ? null : "tools");
                  }
                }}
                className={`px-3.5 py-1.5 rounded-xl transition-all duration-150 flex items-center gap-1.5 cursor-pointer text-xs font-semibold ${
                  activeCategory === "tools" || pathname === "/tools"
                    ? "text-blue-600 font-bold bg-blue-50"
                    : "hover:text-slate-900 hover:bg-slate-100/70 text-slate-700"
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5 text-blue-600" />
                <span>Tools</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-200 ${
                    activeCategory === "tools" ? "rotate-180 text-blue-600" : "text-slate-400"
                  }`}
                />
              </Link>
            </div>

            {/* Navbar 7.0: Primary Clean Desktop Navigation — Essential tools launch via Tools master launcher */}
            {/* Responsive slot reduction invariant: isSlot4to6 ? 'hidden xl:flex' : 'flex' */}

            {/* Jobs & Internships */}
            {jobsNavbarVisible && (
              <div className="relative py-2">
                <Link
                  href="/jobs"
                  onClick={() => setActiveCategory(null)}
                  className={`px-3 py-1.5 rounded-xl transition-all duration-150 flex items-center gap-1.5 cursor-pointer text-xs font-semibold ${
                    pathname?.startsWith("/jobs")
                      ? "text-blue-600 bg-blue-50 font-bold"
                      : "text-slate-700 hover:text-slate-900 hover:bg-slate-100/70"
                  }`}
                >
                  <Briefcase className="w-3.5 h-3.5 text-blue-600" />
                  <span>Jobs &amp; Internships</span>
                </Link>
              </div>
            )}

            {/* Plans / Pricing */}
            <div className="relative py-2">
              <Link
                href="/pricing"
                onClick={() => setActiveCategory(null)}
                className={`px-3 py-1.5 rounded-xl transition-all duration-150 flex items-center gap-1.5 cursor-pointer text-xs font-semibold ${
                  pathname === "/pricing"
                    ? "text-blue-600 bg-blue-50"
                    : "text-slate-700 hover:text-slate-900 hover:bg-slate-100/70"
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Plans</span>
              </Link>
            </div>
          </nav>

          {/* RIGHT: Search Trigger Button & Login */}
          <div className="flex items-center gap-3">
            {/* Global Search Button */}
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="flex items-center gap-2.5 px-3 py-1.5 min-h-[38px] text-xs text-slate-500 hover:text-slate-800 bg-slate-100/80 hover:bg-slate-200/70 rounded-xl transition-all border border-slate-200/80 shadow-2xs cursor-pointer"
              aria-label="Search tools"
              title={isMac ? "Search tools (Cmd+K)" : "Search tools (Ctrl+K)"}
            >
              <Search className="w-3.5 h-3.5 text-slate-400" />
              <span className="hidden sm:inline font-medium">Search tools...</span>
              <kbd className="hidden sm:flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-white border border-slate-200 text-[10px] text-slate-400 font-semibold shadow-2xs">
                {isMac ? (
                  <>
                    <Command className="w-2.5 h-2.5" />
                    <span>K</span>
                  </>
                ) : (
                  <span>Ctrl+K</span>
                )}
              </kbd>
            </button>

            {/* Notification Bell with Dynamic Unread Badge */}
            {!isLoading && user && (
              <Link
                href="/notifications"
                className="relative p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 transition-colors shadow-2xs flex items-center justify-center min-w-[38px] min-h-[38px] cursor-pointer"
                title="Saarvi Notification Center"
                aria-label={
                  unreadNotifications > 0
                    ? `${unreadNotifications} unread notifications`
                    : "Notification Center"
                }
              >
                <Bell className="w-4 h-4 text-slate-600" />
                {unreadNotifications > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[17px] h-[17px] px-1 bg-red-600 text-white rounded-full text-[9px] font-bold flex items-center justify-center ring-2 ring-white shadow-2xs animate-in zoom-in duration-150">
                    {unreadNotifications > 99 ? "99+" : unreadNotifications}
                  </span>
                )}
              </Link>
            )}

            {/* Account Dropdown vs Login CTA */}
            {!isLoading && user ? (
              <div className="relative" ref={accountDropdownRef}>
                <button
                  type="button"
                  onClick={() => setAccountMenuOpen(!accountMenuOpen)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold shadow-xs hover:shadow transition-all cursor-pointer"
                  aria-expanded={accountMenuOpen}
                  aria-haspopup="true"
                >
                  {userAvatar ? (
                    <img
                      src={userAvatar}
                      alt={profile?.fullName || user.fullName || "User"}
                      className="w-5 h-5 rounded-full object-cover shrink-0 ring-1 ring-slate-200"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = "none";
                        const fallback = (e.target as HTMLElement).nextElementSibling as HTMLElement;
                        if (fallback) fallback.style.display = "flex";
                      }}
                    />
                  ) : null}
                  <div
                    className={`w-5 h-5 rounded-full bg-blue-600 text-white items-center justify-center text-[10px] font-bold shrink-0 ${
                      userAvatar ? "hidden" : "flex"
                    }`}
                  >
                    {(profile?.fullName || user.fullName || "U").charAt(0).toUpperCase()}
                  </div>
                  <span className="hidden sm:inline max-w-[100px] truncate">
                    {profile?.fullName || user.fullName || "Account"}
                  </span>
                  <ChevronDown
                    className={`w-3 h-3 text-slate-400 transition-transform duration-150 ${
                      accountMenuOpen ? "rotate-180 text-blue-600" : ""
                    }`}
                  />
                </button>

                {/* Compact Account Menu */}
                {accountMenuOpen && (
                  <div className="absolute right-0 mt-2 w-52 bg-white border border-slate-200 rounded-2xl shadow-xl py-1.5 z-50 text-xs animate-in fade-in duration-100 divide-y divide-slate-100">
                    <div className="px-3.5 py-2">
                      <p className="font-bold text-slate-900 truncate">
                        {profile?.fullName || user.fullName || "User"}
                      </p>
                      <p className="text-[11px] text-slate-400 truncate">{user.email}</p>
                    </div>

                    <div className="py-1">
                      {(profile?.role === 'ADMIN' || profile?.role === 'SUPER_ADMIN') && (
                        <Link
                          href="/admin"
                          onClick={() => setAccountMenuOpen(false)}
                          className="flex items-center gap-2.5 px-3.5 py-2 text-purple-700 hover:bg-purple-50 transition-colors font-bold border-b border-slate-100"
                        >
                          <Shield className="w-3.5 h-3.5 text-purple-600" />
                          <span>Admin Control Center</span>
                        </Link>
                      )}
                      <Link
                        href="/notifications"
                        onClick={() => setAccountMenuOpen(false)}
                        className="flex items-center justify-between px-3.5 py-2 text-slate-700 hover:text-blue-600 hover:bg-slate-50 transition-colors font-medium"
                      >
                        <div className="flex items-center gap-2.5">
                          <Bell className="w-3.5 h-3.5 text-slate-400" />
                          <span>Notifications</span>
                        </div>
                        {unreadNotifications > 0 && (
                          <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-red-100 text-red-700">
                            {unreadNotifications > 99 ? "99+" : unreadNotifications}
                          </span>
                        )}
                      </Link>
                      <Link
                        href="/dashboard"
                        onClick={() => setAccountMenuOpen(false)}
                        className="flex items-center gap-2.5 px-3.5 py-2 text-slate-700 hover:text-blue-600 hover:bg-slate-50 transition-colors font-medium"
                      >
                        <LayoutDashboard className="w-3.5 h-3.5 text-slate-400" />
                        <span>Dashboard</span>
                      </Link>
                      <Link
                        href="/dashboard/history"
                        onClick={() => setAccountMenuOpen(false)}
                        className="flex items-center gap-2.5 px-3.5 py-2 text-slate-700 hover:text-blue-600 hover:bg-slate-50 transition-colors font-medium"
                      >
                        <History className="w-3.5 h-3.5 text-slate-400" />
                        <span>History</span>
                      </Link>
                      <Link
                        href="/dashboard/resumes"
                        onClick={() => setAccountMenuOpen(false)}
                        className="flex items-center gap-2.5 px-3.5 py-2 text-slate-700 hover:text-blue-600 hover:bg-slate-50 transition-colors font-medium"
                      >
                        <FileText className="w-3.5 h-3.5 text-slate-400" />
                        <span>Saved Resumes</span>
                      </Link>
                      <Link
                        href="/dashboard/conversations"
                        onClick={() => setAccountMenuOpen(false)}
                        className="flex items-center gap-2.5 px-3.5 py-2 text-slate-700 hover:text-blue-600 hover:bg-slate-50 transition-colors font-medium"
                      >
                        <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
                        <span>Conversations</span>
                      </Link>
                      <Link
                        href="/dashboard/settings"
                        onClick={() => setAccountMenuOpen(false)}
                        className="flex items-center gap-2.5 px-3.5 py-2 text-slate-700 hover:text-blue-600 hover:bg-slate-50 transition-colors font-medium"
                      >
                        <Settings className="w-3.5 h-3.5 text-slate-400" />
                        <span>Settings</span>
                      </Link>
                      <Link
                        href="/dashboard/profile"
                        onClick={() => setAccountMenuOpen(false)}
                        className="flex items-center gap-2.5 px-3.5 py-2 text-slate-700 hover:text-blue-600 hover:bg-slate-50 transition-colors font-medium"
                      >
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span>Profile</span>
                      </Link>
                      <Link
                        href="/pricing"
                        onClick={() => setAccountMenuOpen(false)}
                        className="flex items-center justify-between px-3.5 py-2 text-slate-700 hover:text-blue-600 hover:bg-slate-50 transition-colors font-medium border-t border-slate-100"
                      >
                        <div className="flex items-center gap-2.5">
                          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                          <span>Plans & Features</span>
                        </div>
                        <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200/60">
                          {profile?.role === 'ADMIN' || profile?.role === 'SUPER_ADMIN' ? 'Admin' : 'Free'}
                        </span>
                      </Link>
                    </div>

                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setAccountMenuOpen(false);
                          openFeedback();
                        }}
                        className="w-full flex items-center gap-2.5 px-3.5 py-2 text-slate-700 hover:text-blue-600 hover:bg-slate-50 transition-colors font-medium text-left cursor-pointer border-b border-slate-100"
                      >
                        <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
                        <span>Share Feedback</span>
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          setAccountMenuOpen(false);
                          await signOut();
                          router.push("/");
                        }}
                        className="w-full flex items-center gap-2.5 px-3.5 py-2 text-red-600 hover:bg-red-50 transition-colors font-medium text-left cursor-pointer"
                      >
                        <LogOut className="w-3.5 h-3.5 text-red-500" />
                        <span>Logout</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href="/login"
                  className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100/90 hover:bg-slate-200/80 rounded-xl transition-all duration-150 border border-slate-200 shadow-xs hover:shadow-sm hover:-translate-y-0.5 active:translate-y-0 active:scale-95 cursor-pointer"
                >
                  Login
                </Link>
                <Link
                  href="/signup"
                  className="px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all duration-150 shadow-xs hover:shadow-sm hover:-translate-y-0.5 active:translate-y-0 active:scale-95 cursor-pointer"
                >
                  Create account
                </Link>
              </div>
            )}

            {/* Mobile Hamburger Drawer Toggle */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-slate-600 hover:text-slate-900 md:hidden rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              aria-label="Toggle Navigation Menu"
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Desktop Mega Menu Dropdown Container — Navbar 7.0 Compact Essential Launcher */}
        <MegaMenu
          activeCategory={activeCategory}
          onMouseEnter={handleMenuMouseEnter}
          onMouseLeave={handleMenuMouseLeave}
          onClose={() => setActiveCategory(null)}
          onOpenSearch={() => {
            setActiveCategory(null);
            setSearchOpen(true);
          }}
          essentialTools={essentialTools.slice(0, 6)}
        />

        {/* Mobile Navigation Drawer with Accordions */}
        {mobileMenuOpen && (
          <div className="md:hidden border-b border-slate-200 bg-white/98 backdrop-blur-md px-4 pt-3 pb-6 space-y-3 animate-in slide-in-from-top-2 duration-150">
            
            {/* Quick Search on Mobile */}
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                setSearchOpen(true);
              }}
              className="w-full flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-600"
            >
              <span className="flex items-center gap-2">
                <Search className="w-4 h-4 text-slate-400" />
                <span>Search all tools...</span>
              </span>
              <kbd className="px-2 py-0.5 rounded bg-white border border-slate-200 text-[10px] text-slate-400">
                Cmd+K
              </kbd>
            </button>

            {/* Mobile Essential Daily Tools Section */}
            <div className="bg-slate-50/80 border border-slate-200/80 rounded-2xl p-3 space-y-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Zap className="w-3 h-3 text-amber-500" />
                  Essential Daily Tools
                </span>
                <Link
                  href="/tools"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-[10px] font-semibold text-blue-600 hover:text-blue-700"
                >
                  View All
                </Link>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {essentialTools.slice(0, 6).map((tool) => {
                  const IconComponent = getToolIcon(tool.icon);
                  return (
                    <Link
                      key={`mob-ess-${tool.key || tool.route}`}
                      href={tool.route}
                      onClick={() => {
                        setMobileMenuOpen(false);
                        handleToolClick(tool.key, tool.category);
                      }}
                      className="flex items-center gap-2 p-2 rounded-xl bg-white border border-slate-200/70 hover:border-blue-300 hover:bg-blue-50/40 text-xs font-semibold text-slate-800 transition-colors shadow-2xs"
                    >
                      <IconComponent className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      <span className="truncate">{tool.name}</span>
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Mobile Accordion 1: PDF Tools */}
            <div className="border border-slate-200/80 rounded-2xl overflow-hidden bg-slate-50/50">
              <button
                type="button"
                onClick={() => toggleMobileSection("pdf")}
                className="w-full p-3.5 text-left font-bold text-xs text-slate-800 flex items-center justify-between"
              >
                <span className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-red-500" />
                  PDF Tools
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-slate-400 transition-transform ${
                    mobileExpandedSection === "pdf" ? "rotate-180 text-blue-600" : ""
                  }`}
                />
              </button>
              {mobileExpandedSection === "pdf" && (
                <div className="p-3 border-t border-slate-200/60 bg-white space-y-1 text-xs max-h-80 overflow-y-auto">
                  <Link
                    href="/pdf"
                    onClick={() => setMobileMenuOpen(false)}
                    className="block p-2 rounded-xl text-blue-600 font-semibold hover:bg-blue-50 mb-1"
                  >
                    View All PDF Tools →
                  </Link>
                  {(
                    navCategories.find((c) => c.id === "pdf")?.allTools?.length > 0
                      ? navCategories.find((c) => c.id === "pdf")!.allTools
                      : [
                          { key: "merge-pdf", name: "Merge PDF", route: "/tools/merge-pdf" },
                          { key: "split-pdf", name: "Split PDF", route: "/tools/split-pdf" },
                          { key: "compress-pdf", name: "Compress PDF", route: "/tools/compress-pdf" },
                          { key: "pdf-to-jpg", name: "PDF to JPG", route: "/tools/pdf-to-jpg" },
                          { key: "pdf-to-word", name: "PDF to Word", route: "/tools/pdf-to-word" },
                          { key: "pdf-to-excel", name: "PDF to Excel", route: "/tools/pdf-to-excel" },
                          { key: "word-to-pdf", name: "Word to PDF", route: "/tools/word-to-pdf" },
                          { key: "excel-to-pdf", name: "Excel to PDF", route: "/tools/excel-to-pdf" },
                          { key: "protect-pdf", name: "Protect PDF", route: "/tools/protect-pdf" },
                          { key: "unlock-pdf", name: "Unlock PDF", route: "/tools/unlock-pdf" },
                          { key: "watermark-pdf", name: "Watermark PDF", route: "/tools/watermark-pdf" },
                          { key: "reorder-pdf", name: "Reorder PDF Pages", route: "/tools/reorder-pdf" },
                          { key: "rotate-pdf", name: "Rotate PDF", route: "/tools/rotate-pdf" },
                          { key: "delete-pdf-pages", name: "Delete PDF Pages", route: "/tools/delete-pdf-pages" },
                          { key: "extract-pdf-pages", name: "Extract PDF Pages", route: "/tools/extract-pdf-pages" },
                          { key: "compress-pdf", name: "Compress PDF", route: "/tools/compress-pdf" },
                          { key: "txt-to-pdf", name: "TXT to PDF", route: "/tools/txt-to-pdf" },
                          { key: "csv-to-pdf", name: "CSV to PDF", route: "/tools/csv-to-pdf" },
                          { key: "html-to-pdf", name: "HTML to PDF", route: "/tools/html-to-pdf" },
                          { key: "pdf-to-png", name: "PDF to PNG", route: "/tools/pdf-to-png" },
                          { key: "pdf-to-powerpoint", name: "PDF to PowerPoint", route: "/tools/pdf-to-powerpoint" },
                          { key: "powerpoint-to-pdf", name: "PowerPoint to PDF", route: "/tools/powerpoint-to-pdf" },
                          { key: "page-numbers-pdf", name: "Add Page Numbers", route: "/tools/page-numbers-pdf" },
                          { key: "pdf-header-footer", name: "PDF Header & Footer", route: "/tools/pdf-header-footer" },
                          { key: "flatten-pdf", name: "Flatten PDF", route: "/tools/flatten-pdf" },
                          { key: "pdf-metadata", name: "PDF Metadata Editor", route: "/tools/pdf-metadata" },
                          { key: "pdf-info", name: "PDF Info & Inspection", route: "/tools/pdf-info" },
                        ]
                  ).map((tool: any) => (
                    <Link
                      key={tool.key}
                      href={tool.route}
                      onClick={() => {
                        handleToolClick(tool.key, "pdf");
                        setMobileMenuOpen(false);
                      }}
                      className="flex items-center justify-between p-2 rounded-xl text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      <span className="font-medium truncate">{tool.name}</span>
                      {tool.isFeatured ? (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200 font-bold shrink-0">Featured</span>
                      ) : tool.isMostUsed ? (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold shrink-0">Most Used</span>
                      ) : tool.requiresPro ? (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500 text-white font-bold shrink-0">PRO</span>
                      ) : null}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Mobile Accordion 2: Image Tools */}
            <div className="border border-slate-200/80 rounded-2xl overflow-hidden bg-slate-50/50">
              <button
                type="button"
                onClick={() => toggleMobileSection("images")}
                className="w-full p-3.5 text-left font-bold text-xs text-slate-800 flex items-center justify-between"
              >
                <span className="flex items-center gap-2">
                  <FileImage className="w-4 h-4 text-blue-500" />
                  Image Tools
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-slate-400 transition-transform ${
                    mobileExpandedSection === "images" ? "rotate-180 text-blue-600" : ""
                  }`}
                />
              </button>
              {mobileExpandedSection === "images" && (
                <div className="p-3 border-t border-slate-200/60 bg-white space-y-1 text-xs max-h-80 overflow-y-auto">
                  <Link
                    href="/images"
                    onClick={() => setMobileMenuOpen(false)}
                    className="block p-2 rounded-xl text-blue-600 font-semibold hover:bg-blue-50 mb-1"
                  >
                    View All Image Tools →
                  </Link>
                  {(
                    navCategories.find((c) => c.id === "images" || c.id === "image")?.allTools?.length > 0
                      ? navCategories.find((c) => c.id === "images" || c.id === "image")!.allTools
                      : [
                          { key: "document-scanner", name: "Document Scanner", route: "/tools/document-scanner" },
                          { key: "scan-to-pdf", name: "Scan to PDF", route: "/tools/scan-to-pdf" },
                          { key: "photo-to-document", name: "Photo to Document", route: "/tools/photo-to-document" },
                          { key: "jpg-to-pdf", name: "JPG to PDF", route: "/tools/jpg-to-pdf" },
                          { key: "png-to-jpg", name: "PNG to JPG", route: "/tools/png-to-jpg" },
                          { key: "jpg-to-png", name: "JPG to PNG", route: "/tools/jpg-to-png" },
                          { key: "image-to-pdf", name: "Image to PDF", route: "/tools/image-to-pdf" },
                          { key: "multiple-images-to-pdf", name: "Multiple Images to PDF", route: "/tools/multiple-images-to-pdf" },
                          { key: "image-resize", name: "Resize Image", route: "/tools/image-resize" },
                          { key: "crop-image", name: "Crop Image", route: "/tools/crop-image" },
                          { key: "compress-image", name: "Compress Image", route: "/tools/compress-image" },
                          { key: "svg-to-png", name: "SVG to PNG", route: "/tools/svg-to-png" },
                          { key: "heic-to-jpg", name: "HEIC to JPG", route: "/tools/heic-to-jpg" },
                        ]
                  ).map((tool: any) => (
                    <Link
                      key={tool.key}
                      href={tool.route}
                      onClick={() => {
                        handleToolClick(tool.key, "images");
                        setMobileMenuOpen(false);
                      }}
                      className="flex items-center justify-between p-2 rounded-xl text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      <span className="font-medium truncate">{tool.name}</span>
                      {tool.isFeatured ? (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200 font-bold shrink-0">Featured</span>
                      ) : tool.isMostUsed ? (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold shrink-0">Most Used</span>
                      ) : tool.requiresPro ? (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500 text-white font-bold shrink-0">PRO</span>
                      ) : null}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Mobile Accordion 3: Student Tools */}
            <div className="border border-slate-200/80 rounded-2xl overflow-hidden bg-slate-50/50">
              <button
                type="button"
                onClick={() => toggleMobileSection("student")}
                className="w-full p-3.5 text-left font-bold text-xs text-slate-800 flex items-center justify-between"
              >
                <span className="flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-indigo-600" />
                  Student Tools
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-slate-400 transition-transform ${
                    mobileExpandedSection === "student" ? "rotate-180 text-blue-600" : ""
                  }`}
                />
              </button>
              {mobileExpandedSection === "student" && (
                <div className="p-3 border-t border-slate-200/60 bg-white space-y-1 text-xs max-h-80 overflow-y-auto">
                  <Link href="/student-tools" onClick={() => setMobileMenuOpen(false)} className="block p-2 rounded-xl text-blue-600 font-semibold hover:bg-blue-50 mb-1">
                    View All Student Tools →
                  </Link>
                  {(
                    navCategories.find((c) => c.id === "student")?.allTools?.length > 0
                      ? navCategories.find((c) => c.id === "student")!.allTools
                      : [
                          { key: "sgpa-calculator", name: "SGPA Calculator", route: "/student/sgpa-calculator" },
                          { key: "cgpa-calculator", name: "CGPA Calculator", route: "/student/cgpa-calculator" },
                          { key: "attendance-tracker", name: "Attendance Planner", route: "/student/attendance" },
                          { key: "exam-marks-analyzer", name: "Marks Calculator", route: "/student/calculator" },
                          { key: "academic-goals", name: "Academic Goals", route: "/student/goals" },
                          { key: "timetable-generator", name: "Timetable Generator", route: "/student/timetable" },
                          { key: "study-planner", name: "Study Planner", route: "/student/study-planner" },
                          { key: "exam-tracker", name: "Exam Schedule Tracker", route: "/student/exams" },
                          { key: "assignment-tracker", name: "Assignment Tracker", route: "/student/assignments" },
                          { key: "student-notes", name: "Study Notes", route: "/student/notes" },
                          { key: "certificate-manager", name: "Certificate Locker", route: "/student/certificates" },
                          { key: "internship-tracker", name: "Internship Tracker", route: "/student/internships" },
                          { key: "hackathon-tracker", name: "Hackathon Tracker", route: "/student/hackathons" },
                        ]
                  ).map((tool: any) => (
                    <Link
                      key={tool.key}
                      href={tool.route}
                      onClick={() => {
                        handleToolClick(tool.key, "student");
                        setMobileMenuOpen(false);
                      }}
                      className="flex items-center justify-between p-2 rounded-xl text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      <span className="font-medium truncate">{tool.name}</span>
                      {tool.isFeatured ? (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200 font-bold shrink-0">Featured</span>
                      ) : tool.isMostUsed ? (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold shrink-0">Most Used</span>
                      ) : tool.requiresPro ? (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500 text-white font-bold shrink-0">PRO</span>
                      ) : null}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Mobile Accordion 4: Career Tools */}
            <div className="border border-slate-200/80 rounded-2xl overflow-hidden bg-slate-50/50">
              <button
                type="button"
                onClick={() => toggleMobileSection("career")}
                className="w-full p-3.5 text-left font-bold text-xs text-slate-800 flex items-center justify-between"
              >
                <span className="flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-emerald-600" />
                  Career Tools
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-slate-400 transition-transform ${
                    mobileExpandedSection === "career" ? "rotate-180 text-blue-600" : ""
                  }`}
                />
              </button>
              {mobileExpandedSection === "career" && (
                <div className="p-3 border-t border-slate-200/60 bg-white space-y-1 text-xs max-h-80 overflow-y-auto">
                  <Link href="/jobs" onClick={() => setMobileMenuOpen(false)} className="block p-2 rounded-xl text-blue-600 font-semibold hover:bg-blue-50 mb-1">
                    Jobs &amp; Internships Platform →
                  </Link>
                  {(
                    navCategories.find((c) => c.id === "career")?.allTools?.length > 0
                      ? navCategories.find((c) => c.id === "career")!.allTools
                      : [
                          { key: "resume-builder", name: "Resume Builder", route: "/student/resume" },
                          { key: "cover-letter", name: "Cover Letter Builder", route: "/student/cover-letter" },
                          { key: "job-tracker", name: "Job Application Tracker", route: "/student/jobs" },
                          { key: "interview-prep", name: "Interview Preparation Hub", route: "/student/interviews" },
                          { key: "skill-gap-analyzer", name: "Skill Gap Analysis", route: "/student/skills" },
                          { key: "ats-analyzer", name: "ATS Keyword Scanner", route: "/student/ats" },
                        ]
                  ).map((tool: any) => (
                    <Link
                      key={tool.key}
                      href={tool.route}
                      onClick={() => {
                        handleToolClick(tool.key, "career");
                        setMobileMenuOpen(false);
                      }}
                      className="flex items-center justify-between p-2 rounded-xl text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      <span className="font-medium truncate">{tool.name}</span>
                      {tool.requiresPro ? (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500 text-white font-bold shrink-0">PRO</span>
                      ) : null}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Mobile Accordion 6: AI & OCR Tools */}
            <div className="border border-slate-200/80 rounded-2xl overflow-hidden bg-purple-50/30 border-purple-200/60">
              <button
                type="button"
                onClick={() => toggleMobileSection("ai")}
                className="w-full p-3.5 text-left font-bold text-xs text-purple-900 flex items-center justify-between"
              >
                <span className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-600" />
                  AI & OCR Tools
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-slate-400 transition-transform ${
                    mobileExpandedSection === "ai" ? "rotate-180 text-purple-600" : ""
                  }`}
                />
              </button>
              {mobileExpandedSection === "ai" && (
                <div className="p-3 border-t border-purple-100 bg-white space-y-1 text-xs max-h-80 overflow-y-auto">
                  <Link href="/tools?category=ai" onClick={() => setMobileMenuOpen(false)} className="block p-2 rounded-xl text-purple-600 font-semibold hover:bg-purple-50 mb-1">
                    View All AI Tools →
                  </Link>
                  {(
                    navCategories.find((c) => c.id === "ai")?.allTools?.length > 0
                      ? navCategories.find((c) => c.id === "ai")!.allTools
                      : [
                          { key: "student-copilot", name: "AI Student Copilot", route: "/student/copilot", requiresPro: true },
                          { key: "copilot-interview", name: "AI Mock Interview Coach", route: "/student/copilot/interview", requiresPro: true },
                          { key: "ocr-image", name: "Image to Text (OCR)", route: "/tools/ocr-image" },
                          { key: "ocr-pdf", name: "Scanned PDF to Text (OCR)", route: "/tools/ocr-pdf" },
                          { key: "document-summary", name: "Document Summarizer", route: "/tools/document-summary" },
                          { key: "document-qa", name: "Ask This Document", route: "/tools/document-qa" },
                        ]
                  ).map((tool: any) => (
                    <Link
                      key={tool.key}
                      href={tool.route}
                      onClick={() => {
                        handleToolClick(tool.key, "ai");
                        setMobileMenuOpen(false);
                      }}
                      className="flex items-center justify-between p-2 rounded-xl text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      <span className="font-medium truncate">{tool.name}</span>
                      {tool.isFeatured ? (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200 font-bold shrink-0">Featured</span>
                      ) : tool.requiresPro ? (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500 text-white font-bold shrink-0">PRO</span>
                      ) : tool.isBeta ? (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-bold shrink-0">Beta</span>
                      ) : null}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Mobile Direct Link: Jobs & Internships */}
            {jobsNavbarVisible && (
              <div>
                <Link
                  href="/jobs"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center justify-between p-3.5 rounded-2xl font-bold text-xs border transition-colors ${
                    pathname?.startsWith("/jobs")
                      ? "bg-blue-50 text-blue-700 border-blue-200"
                      : "bg-slate-50/70 text-slate-800 border-slate-200/80 hover:bg-slate-100"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-blue-600" />
                    <span>Jobs &amp; Internships</span>
                  </div>
                  <span className="px-2 py-0.5 text-[10px] font-bold text-blue-700 bg-blue-100/80 rounded-full">
                    New
                  </span>
                </Link>
              </div>
            )}

            {/* Plans / Pricing */}
            <div className="pt-2">
              <Link
                href="/pricing"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-between p-3 rounded-2xl bg-blue-50/60 hover:bg-blue-50 text-slate-800 font-semibold text-sm border border-blue-100 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span>Plans & Features</span>
                </div>
                <span className="px-2 py-0.5 text-[10px] font-bold text-blue-700 bg-blue-100/80 rounded-full">
                  Free / Pro
                </span>
              </Link>
            </div>

            {/* Account Links in Mobile Drawer */}
            <div className="pt-3 border-t border-slate-200/80 space-y-2">
              {!isLoading && user ? (
                <div className="space-y-1 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-200 text-xs font-bold text-slate-800">
                    {userAvatar ? (
                      <img
                        src={userAvatar}
                        alt={profile?.fullName || user.fullName || "User"}
                        className="w-6 h-6 rounded-full object-cover shrink-0 ring-1 ring-slate-200"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = "none";
                          const fallback = (e.target as HTMLElement).nextElementSibling as HTMLElement;
                          if (fallback) fallback.style.display = "flex";
                        }}
                      />
                    ) : null}
                    <div
                      className={`w-6 h-6 rounded-full bg-blue-600 text-white items-center justify-center text-[10px] font-bold shrink-0 ${
                        userAvatar ? "hidden" : "flex"
                      }`}
                    >
                      {(profile?.fullName || user.fullName || "U").charAt(0).toUpperCase()}
                    </div>
                    <span className="truncate">{profile?.fullName || user.fullName || "Account"}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1 pt-1 text-xs">
                    {(profile?.role === 'ADMIN' || profile?.role === 'SUPER_ADMIN') && (
                      <Link
                        href="/admin"
                        onClick={() => setMobileMenuOpen(false)}
                        className="p-2 text-purple-700 hover:text-purple-900 font-bold col-span-2 bg-purple-50 rounded-lg flex items-center gap-1.5"
                      >
                        <Shield className="w-3.5 h-3.5 text-purple-600" />
                        <span>Admin Control Center</span>
                      </Link>
                    )}
                    <Link
                      href="/dashboard"
                      onClick={() => setMobileMenuOpen(false)}
                      className="p-2 text-slate-700 hover:text-blue-600 font-medium"
                    >
                      Dashboard
                    </Link>
                    <Link
                      href="/dashboard/history"
                      onClick={() => setMobileMenuOpen(false)}
                      className="p-2 text-slate-700 hover:text-blue-600 font-medium"
                    >
                      History
                    </Link>
                    <Link
                      href="/dashboard/resumes"
                      onClick={() => setMobileMenuOpen(false)}
                      className="p-2 text-slate-700 hover:text-blue-600 font-medium"
                    >
                      Resumes
                    </Link>
                    <Link
                      href="/dashboard/settings"
                      onClick={() => setMobileMenuOpen(false)}
                      className="p-2 text-slate-700 hover:text-blue-600 font-medium"
                    >
                      Settings
                    </Link>
                    <Link
                      href="/dashboard/profile"
                      onClick={() => setMobileMenuOpen(false)}
                      className="p-2 text-slate-700 hover:text-blue-600 font-medium"
                    >
                      Profile
                    </Link>
                    <button
                      type="button"
                      onClick={async () => {
                        setMobileMenuOpen(false);
                        await signOut();
                        router.push("/");
                      }}
                      className="p-2 text-red-600 font-medium text-left"
                    >
                      Logout
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 pt-1">
                  <Link
                    href="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex-1 py-2.5 bg-blue-600 text-white font-semibold text-xs rounded-xl text-center shadow-xs"
                  >
                    Login
                  </Link>
                  <Link
                    href="/signup"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs rounded-xl text-center border border-slate-200"
                  >
                    Create Account
                  </Link>
                </div>
              )}
            </div>

            {/* Static Nav Links */}
            <div className="pt-2 flex items-center justify-between text-xs font-semibold text-slate-600 px-2">
              <Link
                href="/about"
                onClick={() => setMobileMenuOpen(false)}
                className="hover:text-blue-600 py-1"
              >
                About
              </Link>
              <Link
                href="/about#contact"
                onClick={() => setMobileMenuOpen(false)}
                className="hover:text-blue-600 py-1"
              >
                Contact
              </Link>
              <Link
                href="/privacy"
                onClick={() => setMobileMenuOpen(false)}
                className="hover:text-blue-600 py-1"
              >
                Privacy
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* Global Command Search Modal (`Cmd+K`) */}
      <GlobalSearchModal
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
        profileId={user?.id || "guest"}
      />
    </>
  );
}
