import { getSupabaseAdminClient } from '../supabase/admin.ts';

export type NavigationAudience = 'ALL' | 'AUTHENTICATED' | 'FREE' | 'PRO' | 'ADMIN';
export type NavigationOpenBehavior = 'same_tab' | 'new_tab';
export type NavigationBadgeType = 'NEW' | 'BETA' | 'UPDATED' | 'POPULAR' | 'PRO';

export interface NavigationItem {
  id: string;
  key: string;
  label: string;
  route: string;
  icon?: string;
  parent_id?: string | null;
  order_index: number;
  enabled: boolean;
  visible_desktop: boolean;
  visible_mobile: boolean;
  open_behavior: NavigationOpenBehavior;
  is_system: boolean;
  /** protected: true means Admin cannot delete this item */
  protected?: boolean;
  feature_flag?: string | null;
  audience: NavigationAudience;
  external_url?: string | null;
  /** Optional admin-configured badge label: NEW, BETA, UPDATED, POPULAR */
  badge?: string | null;
  badge_type?: NavigationBadgeType | null;
  description?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface NavigationVersion {
  id: string;
  version_number: number;
  items: NavigationItem[];
  created_by?: string | null;
  published_at: string;
  notes?: string | null;
}

export interface NavigationValidationError {
  itemKey?: string;
  field?: string;
  message: string;
  severity: 'error' | 'warning';
}

/**
 * RESERVED_SYSTEM_KEYS: These are UI chrome items that are always present.
 * Admin can modify label/icon/order but cannot delete them.
 */
export const RESERVED_SYSTEM_KEYS = new Set([
  'logo',
  'search',
  'notifications',
  'profile',
]);

/**
 * PROTECTED_NAV_KEYS: Navigation items Admin cannot delete (can configure label/icon/order).
 */
export const PROTECTED_NAV_KEYS = new Set([
  'home',
  'tools',
]);

export const DEFAULT_NAVIGATION_ITEMS: NavigationItem[] = [
  {
    id: 'nav-home',
    key: 'home',
    label: 'Home',
    route: '/',
    icon: 'Home',
    order_index: 0,
    enabled: true,
    visible_desktop: true,
    visible_mobile: true,
    open_behavior: 'same_tab',
    is_system: true,
    protected: true,
    audience: 'ALL',
    description: 'Saarvi home page',
  },
  {
    id: 'nav-tools',
    key: 'tools',
    label: 'Tools',
    route: '/tools',
    icon: 'LayoutGrid',
    order_index: 1,
    enabled: true,
    visible_desktop: true,
    visible_mobile: true,
    open_behavior: 'same_tab',
    is_system: true,
    protected: true,
    audience: 'ALL',
    description: 'PDF, Image, Student, Career, and AI tool launcher',
  },
  {
    id: 'nav-jobs',
    key: 'jobs',
    label: 'Jobs & Internships',
    route: '/jobs',
    icon: 'Briefcase',
    order_index: 2,
    enabled: true,
    visible_desktop: true,
    visible_mobile: true,
    open_behavior: 'same_tab',
    is_system: false,
    feature_flag: 'jobs_platform',
    audience: 'ALL',
    description: 'Career opportunity discovery platform',
  },
  {
    id: 'nav-student',
    key: 'student',
    label: 'Student Utilities',
    route: '/student',
    icon: 'GraduationCap',
    order_index: 3,
    enabled: true,
    visible_desktop: true,
    visible_mobile: true,
    open_behavior: 'same_tab',
    is_system: false,
    audience: 'ALL',
    description: 'SGPA/CGPA calculators, VTU tools, attendance, study planner, and academic tools',
  },
  {
    id: 'nav-plans',
    key: 'pricing',
    label: 'Plans',
    route: '/pricing',
    icon: 'Sparkles',
    order_index: 4,
    enabled: true,
    visible_desktop: true,
    visible_mobile: true,
    open_behavior: 'same_tab',
    is_system: false,
    audience: 'ALL',
    description: 'Saarvi Free and Pro subscription plans',
  },
];

// In-memory published cache with fast lookup
let publishedNavCache: NavigationItem[] | null = null;
let publishedNavCacheTime = 0;
const CACHE_TTL_MS = 60_000; // 1 minute TTL

// In-memory draft store for staging changes prior to publish
let draftNavStore: NavigationItem[] | null = null;

// In-memory version history fallback
let inMemoryVersions: NavigationVersion[] = [
  {
    id: 'ver-1',
    version_number: 1,
    items: DEFAULT_NAVIGATION_ITEMS,
    created_by: 'system',
    published_at: new Date().toISOString(),
    notes: 'Initial default published state',
  },
];

export class NavigationService {
  /**
   * Returns authoritative published navigation items.
   * Cached for high throughput; falls back to DEFAULT_NAVIGATION_ITEMS.
   */
  static async getPublishedItems(forceRefresh = false): Promise<NavigationItem[]> {
    const now = Date.now();
    if (!forceRefresh && publishedNavCache && now - publishedNavCacheTime < CACHE_TTL_MS) {
      return publishedNavCache;
    }

    try {
      const supabase = getSupabaseAdminClient();
      if (!supabase) {
        return DEFAULT_NAVIGATION_ITEMS;
      }

      const { data, error } = await supabase
        .from('navigation_items')
        .select('*')
        .eq('enabled', true)
        .order('order_index', { ascending: true });

      if (error || !data || data.length === 0) {
        publishedNavCache = DEFAULT_NAVIGATION_ITEMS;
      } else {
        publishedNavCache = data as NavigationItem[];
      }
      publishedNavCacheTime = now;
      return publishedNavCache;
    } catch {
      return DEFAULT_NAVIGATION_ITEMS;
    }
  }

  /**
   * Returns current draft items or published items if no draft exists.
   */
  static async getDraftItems(): Promise<NavigationItem[]> {
    if (draftNavStore) {
      return draftNavStore;
    }
    const published = await this.getPublishedItems(true);
    // Deep clone to ensure draft mutations are isolated
    draftNavStore = JSON.parse(JSON.stringify(published));
    return draftNavStore!;
  }

  /**
   * Saves a working draft in memory / staging without affecting live users.
   */
  static saveDraft(items: NavigationItem[]): { success: boolean; errors: NavigationValidationError[] } {
    const validation = this.validateNavigation(items);
    // Draft can be saved even with warnings, but critical errors should be highlighted
    draftNavStore = JSON.parse(JSON.stringify(items));
    return {
      success: true,
      errors: validation.errors,
    };
  }

  /**
   * Validates navigation structure according to safety rules.
   */
  static validateNavigation(items: NavigationItem[]): {
    valid: boolean;
    errors: NavigationValidationError[];
  } {
    const errors: NavigationValidationError[] = [];
    const seenLabels = new Set<string>();
    const seenRoutes = new Set<string>();

    let desktopCount = 0;

    for (const item of items) {
      if (!item.enabled) continue;

      // Duplicate label check
      const normLabel = item.label.trim().toLowerCase();
      if (seenLabels.has(normLabel)) {
        errors.push({
          itemKey: item.key,
          field: 'label',
          message: `Duplicate navbar label "${item.label}". Labels must be unique.`,
          severity: 'error',
        });
      }
      seenLabels.add(normLabel);

      // Route check
      const normRoute = item.route.trim().toLowerCase();
      if (seenRoutes.has(normRoute) && normRoute !== '#') {
        errors.push({
          itemKey: item.key,
          field: 'route',
          message: `Duplicate route "${item.route}". Multiple items cannot point to the same destination.`,
          severity: 'error',
        });
      }
      seenRoutes.add(normRoute);

      // Security check on route / external URL
      const checkUrl = item.external_url || item.route;
      if (/^(javascript|data|file|vbscript):/i.test(checkUrl)) {
        errors.push({
          itemKey: item.key,
          field: 'route',
          message: `Security violation: Disallowed URL scheme "${checkUrl}". Only http, https, or relative routes are allowed.`,
          severity: 'error',
        });
      }

      // Internal route format
      if (!item.external_url && !item.route.startsWith('/') && item.route !== '#') {
        errors.push({
          itemKey: item.key,
          field: 'route',
          message: `Internal route "${item.route}" must start with a leading slash (e.g. /tools).`,
          severity: 'error',
        });
      }

      // Internal route resolution check — expanded to cover all active Saarvi app roots
      const KNOWN_VALID_ROOTS = [
        '/',
        '/tools',
        '/jobs',
        '/admin',
        '/pricing',
        '/plans',
        '/student',
        '/student-tools',
        '/vtu',
        '/terms',
        '/privacy',
        '/about',
        '/contact',
        '/career',
        '/settings',
        '/profile',
        '/notifications',
        '/resume',
        '/blog',
        '/images',
        '/pdf',
        '/internships',
        '/dashboard',
        '/login',
        '/signup',
        '/mock-interview',
        '/resources',
        '/plans',
        '/checkout',
      ];
      if (!item.external_url && item.route !== '#' && item.route.startsWith('/')) {
        const isKnown = KNOWN_VALID_ROOTS.some(
          (r) => item.route === r || item.route.startsWith(`${r}/`)
        );
        if (!isKnown) {
          errors.push({
            itemKey: item.key,
            field: 'route',
            message: `Internal route "${item.route}" does not resolve to an active application path. If this is a valid new route, ask the platform engineer to add it to KNOWN_VALID_ROOTS.`,
            severity: 'warning', // Downgraded to warning — new routes may be valid but unknown to the validator
          });
        }
      }

      if (item.visible_desktop) {
        desktopCount++;
      }
    }

    // Reserved system routes check
    const hasHomeOrLogo = items.some((i) => i.route === '/' || i.key === 'logo');
    if (!hasHomeOrLogo) {
      errors.push({
        field: 'route',
        message: 'Reserved system route "/" must remain present in navigation items.',
        severity: 'error',
      });
    }

    // Overflow warning
    if (desktopCount > 7) {
      errors.push({
        message: `High item count (${desktopCount} desktop items). Consider consolidating into dropdowns to prevent horizontal overflow on smaller laptops.`,
        severity: 'warning',
      });
    }

    const hasErrors = errors.some((e) => e.severity === 'error');
    return {
      valid: !hasErrors,
      errors,
    };
  }

  /**
   * Helper validator returning standard boolean and string error messages.
   */
  static validateItems(items: any[]): { valid: boolean; errors: string[] } {
    const normalized: NavigationItem[] = items.map((it, idx) => ({
      id: it.id || `nav-${idx}`,
      key: it.key || it.label?.toLowerCase().replace(/\s+/g, '-') || `item-${idx}`,
      label: it.label || `Item ${idx}`,
      route: it.route || '/',
      enabled: it.enabled ?? it.isEnabled ?? true,
      order_index: it.order_index ?? it.orderIndex ?? idx,
      visible_desktop: it.visible_desktop ?? true,
      visible_mobile: it.visible_mobile ?? true,
      open_behavior: it.open_behavior || 'same_tab',
      is_system: it.is_system ?? it.isSystem ?? false,
      audience: it.audience || 'ALL',
    }));
    const res = this.validateNavigation(normalized);
    return {
      valid: res.valid,
      errors: res.errors.map((e) => e.message),
    };
  }

  /**
   * Publishes the current draft to live users and creates a version snapshot.
   */
  static async publishDraft(
    param1?: string,
    param2?: string
  ): Promise<{ success: boolean; version?: number; errors?: NavigationValidationError[] }> {
    const adminId = param1?.includes('admin') ? param1 : param2?.includes('admin') ? param2 : 'admin-system';
    const notes = param1 !== adminId ? param1 : param2 !== adminId ? param2 : 'Published navigation';

    const draft = await this.getDraftItems();
    const validation = this.validateNavigation(draft);

    if (!validation.valid) {
      return {
        success: false,
        errors: validation.errors,
      };
    }

    const supabase = getSupabaseAdminClient();
    const now = new Date().toISOString();
    let nextVersion = inMemoryVersions.length + 1;

    if (supabase) {
      try {
        const { data: latestVer } = await supabase
          .from('navigation_versions')
          .select('version_number')
          .order('version_number', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (latestVer?.version_number) {
          nextVersion = latestVer.version_number + 1;
        }

        await supabase.from('navigation_versions').insert({
          version_number: nextVersion,
          items: draft,
          created_by: adminId,
          published_at: now,
          notes: notes || `Published by admin ${adminId}`,
        });

        for (let i = 0; i < draft.length; i++) {
          const item = draft[i];
          item.order_index = i;
          item.updated_at = now;
          item.updated_by = adminId;

          await supabase.from('navigation_items').upsert({
            id: item.id || `nav-${item.key}`,
            key: item.key,
            label: item.label,
            route: item.route,
            icon: item.icon || null,
            order_index: i,
            enabled: item.enabled,
            visible_desktop: item.visible_desktop,
            visible_mobile: item.visible_mobile,
            open_behavior: item.open_behavior,
            is_system: item.is_system,
            feature_flag: item.feature_flag || null,
            audience: item.audience,
            external_url: item.external_url || null,
            updated_by: adminId,
            updated_at: now,
          });
        }
      } catch (e) {
        console.error('[NavigationService.publishDraft] DB error:', e);
      }
    }

    // Keep in-memory snapshot updated
    inMemoryVersions.unshift({
      id: `ver-${nextVersion}`,
      version_number: nextVersion,
      items: JSON.parse(JSON.stringify(draft)),
      created_by: adminId,
      published_at: now,
      notes: notes || `Published version ${nextVersion}`,
    });

    // Invalidate cache immediately
    publishedNavCache = JSON.parse(JSON.stringify(draft));
    publishedNavCacheTime = Date.now();
    draftNavStore = null;

    return {
      success: true,
      version: nextVersion,
    };
  }

  /**
   * Retrieves previous published versions for rollback.
   */
  static async getVersions(): Promise<NavigationVersion[]> {
    const supabase = getSupabaseAdminClient();
    if (!supabase) return inMemoryVersions;

    try {
      const { data, error } = await supabase
        .from('navigation_versions')
        .select('*')
        .order('version_number', { ascending: false })
        .limit(20);

      if (error || !data || data.length === 0) return inMemoryVersions;
      return data as NavigationVersion[];
    } catch {
      return inMemoryVersions;
    }
  }

  /**
   * Alias for getVersions returning full version history.
   */
  static async getVersionHistory(): Promise<NavigationVersion[]> {
    return this.getVersions();
  }

  /**
   * Rolls back live navigation to a previously published version snapshot.
   */
  static async rollbackToVersion(
    versionNumber: number,
    adminId: string
  ): Promise<{ success: boolean; error?: string }> {
    const supabase = getSupabaseAdminClient();

    if (supabase) {
      try {
        const { data: ver, error } = await supabase
          .from('navigation_versions')
          .select('*')
          .eq('version_number', versionNumber)
          .single();

        if (!error && ver && ver.items) {
          draftNavStore = ver.items as NavigationItem[];
          await this.publishDraft(adminId, `Rollback to version ${versionNumber}`);
          return { success: true };
        }
      } catch (err: any) {
        console.warn('[NavigationService.rollbackToVersion] DB lookup error:', err);
      }
    }

    // In-memory fallback
    const memVer = inMemoryVersions.find((v) => v.version_number === versionNumber);
    if (memVer) {
      draftNavStore = JSON.parse(JSON.stringify(memVer.items));
      publishedNavCache = draftNavStore;
      publishedNavCacheTime = Date.now();
      return { success: true };
    }

    return { success: false, error: `Version ${versionNumber} not found.` };
  }

  /**
   * Resets draft to the default system navigation.
   */
  static resetToDefault(): NavigationItem[] {
    draftNavStore = JSON.parse(JSON.stringify(DEFAULT_NAVIGATION_ITEMS));
    return draftNavStore!;
  }
}
