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
  Bell
} from "lucide-react";
import { SITE_CONFIG } from "@/config/site";
import { SaarviMark } from "@/components/brand/SaarviLogo";
import { useAuth } from "@/context/AuthContext";
import MegaMenu, { ActiveMenuCategory } from "./MegaMenu";
import GlobalSearchModal from "@/components/tools/GlobalSearchModal";
import AnnouncementBanner from "./AnnouncementBanner";

export default function Navbar() {
  const { user, profile, signOut, isLoading } = useAuth();
  const router = useRouter();
  const [activeCategory, setActiveCategory] = useState<ActiveMenuCategory>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileExpandedSection, setMobileExpandedSection] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [navCategories, setNavCategories] = useState<any[]>([]);
  const [isMac, setIsMac] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const ua = window.navigator?.userAgent || "";
      setIsMac(/macintosh|mac os x/i.test(ua));
    }
  }, []);

  useEffect(() => {
    async function loadNav() {
      try {
        const res = await fetch('/api/navigation');
        if (res.ok) {
          const data = await res.json();
          if (data.categories) {
            setNavCategories(data.categories);
          }
        }
      } catch {}
    }
    loadNav();
  }, []);

  useEffect(() => {
    if (!user) return;
    let isCancelled = false;
    fetch('/api/notifications?limit=1', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!isCancelled && data && typeof data.unreadCount === 'number') {
          setUnreadNotifications(data.unreadCount);
        }
      })
      .catch(() => {});
    return () => {
      isCancelled = true;
    };
  }, [user]);

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

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const accountDropdownRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  // Close account dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (accountDropdownRef.current && !accountDropdownRef.current.contains(e.target as Node)) {
        setAccountMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Scroll elevation listener
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 15);
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

  // Hover zone buffer management
  const handleNavMouseEnter = (category: ActiveMenuCategory) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setActiveCategory(category);
  };

  const handleNavMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    // Small buffer delay (150ms) to allow smooth transit between navbar and mega menu
    timeoutRef.current = setTimeout(() => {
      setActiveCategory(null);
    }, 150);
  };

  const handleMenuMouseEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const handleMenuMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      setActiveCategory(null);
    }, 150);
  };

  const toggleMobileSection = (section: string) => {
    setMobileExpandedSection((prev) => (prev === section ? null : section));
  };

  return (
    <>
      <AnnouncementBanner />
      <header
        className={`sticky top-0 z-40 w-full transition-all duration-200 ${
          isScrolled
            ? "bg-white/95 backdrop-blur-md border-b border-slate-200/90 shadow-xs"
            : "bg-white/90 backdrop-blur-xs border-b border-slate-100"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4 relative">
          
          {/* LEFT: Saarvi Logo */}
          <Link
            href="/"
            className="flex items-center gap-2.5 group transition-transform duration-200 hover:scale-[1.02] active:scale-95 shrink-0"
            aria-label="Saarvi Home"
          >
            <SaarviMark size={36} className="group-hover:shadow-md group-hover:-translate-y-0.5 transition-all duration-200" />
            <div className="flex flex-col">
              <span className="font-extrabold text-lg text-slate-900 tracking-tight leading-tight">
                {SITE_CONFIG.name}
              </span>
              <span className="text-[10px] text-slate-500 font-medium hidden sm:inline">
                {SITE_CONFIG.tagline}
              </span>
            </div>
          </Link>

          {/* CENTER: Desktop Mega Menu Navigation Links */}
          <nav
            className="hidden md:flex items-center gap-1 text-sm font-medium text-slate-600"
            aria-label="Main Navigation"
          >
            {/* Tools Category */}
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
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setActiveCategory(activeCategory === "tools" ? null : "tools");
                  }
                }}
                className={`px-3.5 py-1.5 rounded-xl transition-all duration-150 flex items-center gap-1.5 cursor-pointer ${
                  activeCategory === "tools"
                    ? "text-blue-600 font-semibold bg-blue-50"
                    : "hover:text-slate-900 hover:bg-slate-100/70 text-slate-700"
                }`}
              >
                <span>Tools</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-200 ${
                    activeCategory === "tools" ? "rotate-180 text-blue-600" : "text-slate-400"
                  }`}
                />
              </Link>
            </div>

            {/* PDF Category */}
            <div
              onMouseEnter={() => handleNavMouseEnter("pdf")}
              onMouseLeave={handleNavMouseLeave}
              className="relative py-2"
            >
              <Link
                href="/tools?category=pdf"
                aria-expanded={activeCategory === "pdf"}
                aria-haspopup="true"
                onFocus={() => handleNavMouseEnter("pdf")}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setActiveCategory(activeCategory === "pdf" ? null : "pdf");
                  }
                }}
                className={`px-3.5 py-1.5 rounded-xl transition-all duration-150 flex items-center gap-1.5 cursor-pointer ${
                  activeCategory === "pdf"
                    ? "text-blue-600 font-semibold bg-blue-50"
                    : "hover:text-slate-900 hover:bg-slate-100/70 text-slate-700"
                }`}
              >
                <span>PDF</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-200 ${
                    activeCategory === "pdf" ? "rotate-180 text-blue-600" : "text-slate-400"
                  }`}
                />
              </Link>
            </div>

            {/* Images Category */}
            <div
              onMouseEnter={() => handleNavMouseEnter("images")}
              onMouseLeave={handleNavMouseLeave}
              className="relative py-2"
            >
              <Link
                href="/tools?category=image"
                aria-expanded={activeCategory === "images"}
                aria-haspopup="true"
                onFocus={() => handleNavMouseEnter("images")}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setActiveCategory(activeCategory === "images" ? null : "images");
                  }
                }}
                className={`px-3.5 py-1.5 rounded-xl transition-all duration-150 flex items-center gap-1.5 cursor-pointer ${
                  activeCategory === "images"
                    ? "text-blue-600 font-semibold bg-blue-50"
                    : "hover:text-slate-900 hover:bg-slate-100/70 text-slate-700"
                }`}
              >
                <span>Images</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-200 ${
                    activeCategory === "images" ? "rotate-180 text-blue-600" : "text-slate-400"
                  }`}
                />
              </Link>
            </div>

            {/* Student Tools Category */}
            <div
              onMouseEnter={() => handleNavMouseEnter("student")}
              onMouseLeave={handleNavMouseLeave}
              className="relative py-2"
            >
              <Link
                href="/student"
                aria-expanded={activeCategory === "student"}
                aria-haspopup="true"
                onFocus={() => handleNavMouseEnter("student")}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setActiveCategory(activeCategory === "student" ? null : "student");
                  }
                }}
                className={`px-3.5 py-1.5 rounded-xl transition-all duration-150 flex items-center gap-1.5 cursor-pointer ${
                  activeCategory === "student"
                    ? "text-blue-600 font-semibold bg-blue-50"
                    : "hover:text-slate-900 hover:bg-slate-100/70 text-slate-700"
                }`}
              >
                <span>Student Tools</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-200 ${
                    activeCategory === "student" ? "rotate-180 text-blue-600" : "text-slate-400"
                  }`}
                />
              </Link>
            </div>

            {/* Plans / Pricing */}
            <div className="relative py-2">
              <Link
                href="/pricing"
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
                    {unreadNotifications > 9 ? "9+" : unreadNotifications}
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
                  <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0">
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
                            {unreadNotifications > 9 ? "9+" : unreadNotifications}
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
              <Link
                href="/login"
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100/90 hover:bg-slate-200/80 rounded-xl transition-all duration-150 border border-slate-200 shadow-xs hover:shadow-sm hover:-translate-y-0.5 active:translate-y-0 active:scale-95 cursor-pointer"
              >
                Login
              </Link>
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

        {/* Desktop Mega Menu Dropdown Container */}
        <MegaMenu
          activeCategory={activeCategory}
          onMouseEnter={handleMenuMouseEnter}
          onMouseLeave={handleMenuMouseLeave}
          onClose={() => setActiveCategory(null)}
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
                <div className="p-3 border-t border-slate-200/60 bg-white space-y-1 text-xs">
                  <Link
                    href="/tools?category=pdf"
                    onClick={() => setMobileMenuOpen(false)}
                    className="block p-2 rounded-xl text-blue-600 font-semibold hover:bg-blue-50"
                  >
                    View All PDF Tools →
                  </Link>
                  <Link href="/tools/merge-pdf" onClick={() => setMobileMenuOpen(false)} className="block p-2 rounded-xl text-slate-700 hover:bg-slate-50">
                    Merge PDF
                  </Link>
                  <Link href="/tools/split-pdf" onClick={() => setMobileMenuOpen(false)} className="block p-2 rounded-xl text-slate-700 hover:bg-slate-50">
                    Split PDF
                  </Link>
                  <Link href="/tools/compress-pdf" onClick={() => setMobileMenuOpen(false)} className="block p-2 rounded-xl text-slate-700 hover:bg-slate-50">
                    Compress PDF
                  </Link>
                  <Link href="/tools/pdf-to-jpg" onClick={() => setMobileMenuOpen(false)} className="block p-2 rounded-xl text-slate-700 hover:bg-slate-50">
                    PDF to JPG
                  </Link>
                  <Link href="/tools/rotate-pdf" onClick={() => setMobileMenuOpen(false)} className="block p-2 rounded-xl text-slate-700 hover:bg-slate-50">
                    Rotate PDF
                  </Link>
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
                <div className="p-3 border-t border-slate-200/60 bg-white space-y-1 text-xs">
                  <Link
                    href="/tools?category=image"
                    onClick={() => setMobileMenuOpen(false)}
                    className="block p-2 rounded-xl text-blue-600 font-semibold hover:bg-blue-50"
                  >
                    View All Image Tools →
                  </Link>
                  <Link href="/tools/jpg-to-pdf" onClick={() => setMobileMenuOpen(false)} className="block p-2 rounded-xl text-slate-700 hover:bg-slate-50">
                    JPG to PDF
                  </Link>
                  <Link href="/tools/png-to-jpg" onClick={() => setMobileMenuOpen(false)} className="block p-2 rounded-xl text-slate-700 hover:bg-slate-50">
                    PNG to JPG
                  </Link>
                  <Link href="/tools/multiple-images-to-pdf" onClick={() => setMobileMenuOpen(false)} className="block p-2 rounded-xl text-slate-700 hover:bg-slate-50">
                    Multiple Images to PDF
                  </Link>
                  <Link href="/tools/image-resize" onClick={() => setMobileMenuOpen(false)} className="block p-2 rounded-xl text-slate-700 hover:bg-slate-50">
                    Resize Image
                  </Link>
                  <Link href="/tools/compress-image" onClick={() => setMobileMenuOpen(false)} className="block p-2 rounded-xl text-slate-700 hover:bg-slate-50">
                    Compress Image
                  </Link>
                </div>
              )}
            </div>

            {/* Mobile Accordion 3: Academic Tools */}
            <div className="border border-slate-200/80 rounded-2xl overflow-hidden bg-slate-50/50">
              <button
                type="button"
                onClick={() => toggleMobileSection("academic")}
                className="w-full p-3.5 text-left font-bold text-xs text-slate-800 flex items-center justify-between"
              >
                <span className="flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-purple-600" />
                  Academic Tools
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-slate-400 transition-transform ${
                    mobileExpandedSection === "academic" ? "rotate-180 text-blue-600" : ""
                  }`}
                />
              </button>
              {mobileExpandedSection === "academic" && (
                <div className="p-3 border-t border-slate-200/60 bg-white space-y-1 text-xs">
                  <Link href="/student/sgpa-calculator" onClick={() => setMobileMenuOpen(false)} className="block p-2 rounded-xl text-slate-700 hover:bg-slate-50 font-semibold">
                    SGPA Calculator
                  </Link>
                  <Link href="/student/cgpa-calculator" onClick={() => setMobileMenuOpen(false)} className="block p-2 rounded-xl text-slate-700 hover:bg-slate-50">
                    CGPA Calculator
                  </Link>
                  <Link href="/student/attendance" onClick={() => setMobileMenuOpen(false)} className="block p-2 rounded-xl text-slate-700 hover:bg-slate-50">
                    Attendance Planner
                  </Link>
                  <Link href="/student/calculator" onClick={() => setMobileMenuOpen(false)} className="block p-2 rounded-xl text-slate-700 hover:bg-slate-50">
                    Marks Calculator
                  </Link>
                  <Link href="/student/goals" onClick={() => setMobileMenuOpen(false)} className="block p-2 rounded-xl text-slate-700 hover:bg-slate-50">
                    Academic Goals
                  </Link>
                </div>
              )}
            </div>

            {/* Mobile Accordion 4: Student Tools */}
            <div className="border border-slate-200/80 rounded-2xl overflow-hidden bg-slate-50/50">
              <button
                type="button"
                onClick={() => toggleMobileSection("student")}
                className="w-full p-3.5 text-left font-bold text-xs text-slate-800 flex items-center justify-between"
              >
                <span className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-600" />
                  Student Utilities
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-slate-400 transition-transform ${
                    mobileExpandedSection === "student" ? "rotate-180 text-blue-600" : ""
                  }`}
                />
              </button>
              {mobileExpandedSection === "student" && (
                <div className="p-3 border-t border-slate-200/60 bg-white space-y-1 text-xs">
                  <Link href="/student" onClick={() => setMobileMenuOpen(false)} className="block p-2 rounded-xl text-blue-600 font-semibold hover:bg-blue-50">
                    Student Portal Overview →
                  </Link>
                  <Link href="/student/timetable" onClick={() => setMobileMenuOpen(false)} className="block p-2 rounded-xl text-slate-700 hover:bg-slate-50">
                    Timetable Generator
                  </Link>
                  <Link href="/student/study-planner" onClick={() => setMobileMenuOpen(false)} className="block p-2 rounded-xl text-slate-700 hover:bg-slate-50">
                    Study Planner
                  </Link>
                  <Link href="/student/exams" onClick={() => setMobileMenuOpen(false)} className="block p-2 rounded-xl text-slate-700 hover:bg-slate-50">
                    Exam Schedule Tracker
                  </Link>
                  <Link href="/student/assignments" onClick={() => setMobileMenuOpen(false)} className="block p-2 rounded-xl text-slate-700 hover:bg-slate-50">
                    Assignment Tracker
                  </Link>
                  <Link href="/student/certificates" onClick={() => setMobileMenuOpen(false)} className="block p-2 rounded-xl text-slate-700 hover:bg-slate-50">
                    Certificate Locker
                  </Link>
                  <Link href="/student/internships" onClick={() => setMobileMenuOpen(false)} className="block p-2 rounded-xl text-slate-700 hover:bg-slate-50">
                    Internship Tracker
                  </Link>
                  <Link href="/student/hackathons" onClick={() => setMobileMenuOpen(false)} className="block p-2 rounded-xl text-slate-700 hover:bg-slate-50">
                    Hackathon Tracker
                  </Link>
                </div>
              )}
            </div>

            {/* Mobile Accordion 5: Career Tools */}
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
                <div className="p-3 border-t border-slate-200/60 bg-white space-y-1 text-xs">
                  <Link href="/student/resume" onClick={() => setMobileMenuOpen(false)} className="block p-2 rounded-xl text-slate-700 hover:bg-slate-50 font-semibold">
                    Resume Builder (Live Preview)
                  </Link>
                  <Link href="/student/cover-letter" onClick={() => setMobileMenuOpen(false)} className="block p-2 rounded-xl text-slate-700 hover:bg-slate-50 font-semibold">
                    Cover Letter Builder
                  </Link>
                  <Link href="/student/jobs" onClick={() => setMobileMenuOpen(false)} className="block p-2 rounded-xl text-slate-700 hover:bg-slate-50">
                    Job Application Tracker
                  </Link>
                  <Link href="/student/interviews" onClick={() => setMobileMenuOpen(false)} className="block p-2 rounded-xl text-slate-700 hover:bg-slate-50">
                    Interview Preparation Hub
                  </Link>
                  <Link href="/student/skills" onClick={() => setMobileMenuOpen(false)} className="block p-2 rounded-xl text-slate-700 hover:bg-slate-50">
                    Skill Gap Analysis
                  </Link>
                  <Link href="/student/ats" onClick={() => setMobileMenuOpen(false)} className="block p-2 rounded-xl text-slate-700 hover:bg-slate-50">
                    ATS Keyword Scanner
                  </Link>
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
                <div className="p-3 border-t border-purple-100 bg-white space-y-1 text-xs">
                  <Link href="/student/copilot" onClick={() => setMobileMenuOpen(false)} className="block p-2 rounded-xl text-purple-700 hover:bg-purple-50 font-semibold">
                    AI Student Copilot
                  </Link>
                  <Link href="/student/copilot/interview" onClick={() => setMobileMenuOpen(false)} className="block p-2 rounded-xl text-slate-700 hover:bg-slate-50">
                    AI Mock Interview Coach
                  </Link>
                  <Link href="/tools/ocr-image" onClick={() => setMobileMenuOpen(false)} className="block p-2 rounded-xl text-slate-700 hover:bg-slate-50">
                    Image to Text (OCR)
                  </Link>
                  <Link href="/tools/ocr-pdf" onClick={() => setMobileMenuOpen(false)} className="block p-2 rounded-xl text-slate-700 hover:bg-slate-50">
                    Scanned PDF to Text (OCR)
                  </Link>
                  <Link href="/tools/document-summary" onClick={() => setMobileMenuOpen(false)} className="block p-2 rounded-xl text-slate-700 hover:bg-slate-50">
                    Document Summarizer
                  </Link>
                  <Link href="/tools/document-qa" onClick={() => setMobileMenuOpen(false)} className="block p-2 rounded-xl text-slate-700 hover:bg-slate-50">
                    Ask This Document
                  </Link>
                </div>
              )}
            </div>

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
                    <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">
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
