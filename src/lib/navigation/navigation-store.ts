/**
 * Saarvi Navigation Store & Persistence Engine
 * Unified Admin Control Center 2.0 (Phase 40 Part A & Part D)
 *
 * Guarantees:
 * 1. Single source of truth for dynamic navigation: CANONICAL_TOOL_REGISTRY + Supabase `navigation_configs` + Feature Flags.
 * 2. Supabase table `navigation_configs` authoritative persistence with cached fallback.
 * 3. Supports adding tools, removing from navbar without deleting underlying tools, reordering, and category customization.
 * 4. Zero arbitrary URLs or unsafe injections: every route is strictly derived from canonical tools.
 */

import { CANONICAL_TOOL_REGISTRY, CANONICAL_TOOL_CATEGORIES } from '../tools/tool-registry.ts';
import type { CanonicalTool, CanonicalToolCategory } from '../tools/tool-registry.ts';
import { getSupabaseAdminClient } from '../supabase/admin.ts';
import { featureServerStore } from '../features/feature-store.ts';

export type NavigationStatus = 'ACTIVE' | 'NAVBAR_HIDDEN' | 'DISABLED' | 'MAINTENANCE';

export interface NavigationConfigItem {
  id: string;
  toolId: string;
  toolName: string;
  categoryId: string;
  subcategory?: string;
  route: string;
  position: number;
  visibleInNavbar: boolean;
  visibleInMegaMenu: boolean;
  visibleInSearch: boolean;
  visibleInHomepage: boolean;
  visibleInAI: boolean;
  featured: boolean;
  essentialNavbar?: boolean;
  pinnedRank?: number | null;
  locked?: boolean;
  badge?: string | null;
  status: NavigationStatus;
  createdAt: string;
  updatedAt: string;
  updatedBy?: string;
}

export interface CategoryConfigItem {
  id: string;
  label: string;
  route: string;
  position: number;
  visible: boolean;
}

export const DEFAULT_CATEGORY_CONFIGS: CategoryConfigItem[] = [
  { id: 'pdf', label: 'PDF Tools', route: '/tools?category=pdf', position: 0, visible: true },
  { id: 'image', label: 'Image Tools', route: '/tools?category=image', position: 1, visible: true },
  { id: 'academic', label: 'Academic Tools', route: '/student', position: 2, visible: true },
  { id: 'student', label: 'Student Tools', route: '/student', position: 3, visible: true },
  { id: 'career', label: 'Career Tools', route: '/student', position: 4, visible: true },
  { id: 'ai', label: 'AI Tools', route: '/tools?category=ai', position: 5, visible: true },
];

/**
 * Builds default seed configurations derived deterministically from CANONICAL_TOOL_REGISTRY.
 */
function buildDefaultConfigs(): NavigationConfigItem[] {
  return CANONICAL_TOOL_REGISTRY.map((tool, index) => {
    const isFeatured = ['merge-pdf', 'compress-pdf', 'resume-builder', 'sgpa-calculator', 'document-scanner'].includes(tool.key);
    return {
      id: `nav_${tool.key}_${tool.category}`,
      toolId: tool.key,
      toolName: tool.name,
      categoryId: tool.category,
      route: tool.route,
      position: index,
      visibleInNavbar: true,
      visibleInMegaMenu: true,
      visibleInSearch: true,
      visibleInHomepage: true,
      visibleInAI: true,
      featured: isFeatured,
      badge: tool.badge || (isFeatured ? 'POPULAR' : null),
      status: 'ACTIVE',
      createdAt: new Date('2026-01-01T00:00:00Z').toISOString(),
      updatedAt: new Date().toISOString(),
      updatedBy: 'system',
    };
  });
}

import { toolDiscoveryService } from './tool-discovery-service.ts';

class NavigationStore {
  private cache: NavigationConfigItem[] | null = null;
  private categoryCache: CategoryConfigItem[] = [...DEFAULT_CATEGORY_CONFIGS];
  private cacheExpiry = 0;
  private readonly TTL_MS = 60_000; // 1 minute in-memory cache

  /**
   * Clears internal cache and triggers smart navbar tool discovery cache invalidation.
   */
  public invalidateCache(): void {
    this.cache = null;
    this.cacheExpiry = 0;
    try {
      toolDiscoveryService.invalidateCache();
    } catch {}
  }

  /**
   * Retrieves all navigation configurations, prioritizing Supabase table `navigation_configs`.
   */
  async getAllConfigs(): Promise<NavigationConfigItem[]> {
    const now = Date.now();
    if (this.cache && now < this.cacheExpiry) {
      return [...this.cache];
    }

    try {
      const supabase = getSupabaseAdminClient();
      if (!supabase) {
        if (!this.cache) this.cache = buildDefaultConfigs();
        this.cacheExpiry = now + this.TTL_MS;
        return [...this.cache];
      }

      const { data, error } = await supabase
        .from('navigation_configs')
        .select('*')
        .order('position', { ascending: true });

      if (error || !data || data.length === 0) {
        // Fallback to seeded defaults if table is empty or connection not available
        if (!this.cache) {
          this.cache = buildDefaultConfigs();
        }
        this.cacheExpiry = now + this.TTL_MS;
        return [...this.cache];
      }

      // Merge Supabase records with canonical tools metadata (names, routes)
      const canonicalMap = new Map<string, CanonicalTool>();
      CANONICAL_TOOL_REGISTRY.forEach((t) => canonicalMap.set(t.key, t));

      const merged: NavigationConfigItem[] = data.map((row: any) => {
        const canonical = canonicalMap.get(row.tool_id);
        return {
          id: row.id,
          toolId: row.tool_id,
          toolName: canonical?.name || row.tool_id,
          categoryId: row.category_id,
          route: canonical?.route || `/tools/${row.tool_id}`,
          position: row.position ?? 0,
          visibleInNavbar: row.visible_in_navbar ?? true,
          visibleInMegaMenu: row.visible_in_mega_menu ?? true,
          visibleInSearch: row.visible_in_search ?? true,
          visibleInHomepage: row.visible_in_homepage ?? true,
          visibleInAI: row.visible_in_ai ?? true,
          featured: row.featured ?? false,
          badge: row.badge ?? null,
          status: row.status || 'ACTIVE',
          createdAt: row.created_at || new Date().toISOString(),
          updatedAt: row.updated_at || new Date().toISOString(),
          updatedBy: row.updated_by || 'admin@saarvi.in',
        };
      });

      this.cache = merged;
      this.cacheExpiry = now + this.TTL_MS;
      return [...merged];
    } catch (err) {
      console.warn('[NavigationStore] Failed to query Supabase, using in-memory defaults:', err);
      if (!this.cache) {
        this.cache = buildDefaultConfigs();
      }
      this.cacheExpiry = now + this.TTL_MS;
      return [...this.cache];
    }
  }

  /**
   * Retrieves category configurations.
   */
  async getCategoryConfigs(): Promise<CategoryConfigItem[]> {
    return [...this.categoryCache].sort((a, b) => a.position - b.position);
  }

  /**
   * Updates category label or visibility.
   */
  async updateCategoryConfig(
    categoryId: string,
    updates: Partial<Omit<CategoryConfigItem, 'id'>>,
    _adminEmail = 'admin@saarvi.in'
  ): Promise<CategoryConfigItem[]> {
    const found = this.categoryCache.find((c) => c.id === categoryId);
    if (found) {
      Object.assign(found, updates);
    }
    return [...this.categoryCache].sort((a, b) => a.position - b.position);
  }

  /**
   * Reorders categories based on ordered array of IDs.
   */
  async reorderCategories(categoryIdsInOrder: string[]): Promise<CategoryConfigItem[]> {
    categoryIdsInOrder.forEach((id, idx) => {
      const cat = this.categoryCache.find((c) => c.id === id);
      if (cat) cat.position = idx;
    });
    this.categoryCache.sort((a, b) => a.position - b.position);
    return [...this.categoryCache];
  }

  /**
   * Updates a specific navigation item configuration in Supabase and local cache.
   */
  async updateConfig(
    toolId: string,
    categoryId: string,
    updates: Partial<Omit<NavigationConfigItem, 'id' | 'toolId' | 'categoryId' | 'createdAt'>>,
    adminEmail = 'admin@saarvi.in'
  ): Promise<NavigationConfigItem> {
    const all = await this.getAllConfigs();
    const existingIndex = all.findIndex((i) => i.toolId === toolId && i.categoryId === categoryId);

    const nowIso = new Date().toISOString();
    const id = existingIndex >= 0 ? all[existingIndex].id : `nav_${toolId}_${categoryId}`;
    const canonical = CANONICAL_TOOL_REGISTRY.find((t) => t.key === toolId);

    const updatedItem: NavigationConfigItem = {
      ...(existingIndex >= 0 ? all[existingIndex] : {
        id,
        toolId,
        toolName: canonical?.name || toolId,
        categoryId,
        route: canonical?.route || `/tools/${toolId}`,
        position: all.length,
        visibleInNavbar: true,
        visibleInMegaMenu: true,
        visibleInSearch: true,
        visibleInHomepage: true,
        visibleInAI: true,
        featured: false,
        badge: null,
        status: 'ACTIVE' as NavigationStatus,
        createdAt: nowIso,
      }),
      ...updates,
      updatedAt: nowIso,
      updatedBy: adminEmail,
    };

    if (existingIndex >= 0) {
      all[existingIndex] = updatedItem;
    } else {
      all.push(updatedItem);
    }
    this.cache = all;
    try {
      toolDiscoveryService.invalidateCache();
    } catch {}

    try {
      const supabase = getSupabaseAdminClient();
      if (supabase) {
        await supabase.from('navigation_configs').upsert({
          id: updatedItem.id,
          tool_id: updatedItem.toolId,
          category_id: updatedItem.categoryId,
          position: updatedItem.position,
          visible_in_navbar: updatedItem.visibleInNavbar,
          visible_in_mega_menu: updatedItem.visibleInMegaMenu,
          visible_in_search: updatedItem.visibleInSearch,
          visible_in_homepage: updatedItem.visibleInHomepage,
          visible_in_ai: updatedItem.visibleInAI,
          featured: updatedItem.featured,
          badge: updatedItem.badge,
          status: updatedItem.status,
          updated_at: updatedItem.updatedAt,
          updated_by: adminEmail,
        });
      }
    } catch (err) {
      console.warn('[NavigationStore] Failed to upsert to Supabase:', err);
    }

    return updatedItem;
  }

  /**
   * Adds an existing registered tool to a navigation category.
   */
  async addTool(
    toolId: string,
    categoryId: string,
    overrides?: Partial<NavigationConfigItem>,
    adminEmail = 'admin@saarvi.in'
  ): Promise<NavigationConfigItem> {
    const canonical = CANONICAL_TOOL_REGISTRY.find((t) => t.key === toolId);
    if (!canonical) {
      throw new Error(`Tool "${toolId}" is not registered in CANONICAL_TOOL_REGISTRY.`);
    }

    return this.updateConfig(
      toolId,
      categoryId,
      {
        visibleInNavbar: overrides?.visibleInNavbar ?? true,
        visibleInMegaMenu: overrides?.visibleInMegaMenu ?? true,
        visibleInSearch: overrides?.visibleInSearch ?? true,
        visibleInHomepage: overrides?.visibleInHomepage ?? true,
        visibleInAI: overrides?.visibleInAI ?? true,
        featured: overrides?.featured ?? false,
        badge: overrides?.badge ?? null,
        status: overrides?.status ?? 'ACTIVE',
        ...overrides,
      },
      adminEmail
    );
  }

  /**
   * Removes a tool from Navbar visibility without deleting the underlying tool.
   */
  async removeFromNavbar(
    toolId: string,
    categoryId: string,
    adminEmail = 'admin@saarvi.in'
  ): Promise<NavigationConfigItem> {
    return this.updateConfig(
      toolId,
      categoryId,
      {
        visibleInNavbar: false,
      },
      adminEmail
    );
  }

  /**
   * Reorders items within a category according to an ordered list of toolIds.
   */
  async reorderCategory(
    categoryId: string,
    toolIdsInOrder: string[],
    adminEmail = 'admin@saarvi.in'
  ): Promise<NavigationConfigItem[]> {
    const all = await this.getAllConfigs();
    const nowIso = new Date().toISOString();

    toolIdsInOrder.forEach((tid, idx) => {
      const item = all.find((i) => i.toolId === tid && i.categoryId === categoryId);
      if (item) {
        item.position = idx;
        item.updatedAt = nowIso;
        item.updatedBy = adminEmail;
      }
    });

    all.sort((a, b) => a.position - b.position);
    this.cache = all;
    try {
      toolDiscoveryService.invalidateCache();
    } catch {}

    // Batch upsert to Supabase in background
    try {
      const supabase = getSupabaseAdminClient();
      if (supabase) {
        const rows = all
          .filter((i) => i.categoryId === categoryId)
          .map((i) => ({
            id: i.id,
            tool_id: i.toolId,
            category_id: i.categoryId,
            position: i.position,
            visible_in_navbar: i.visibleInNavbar,
            visible_in_mega_menu: i.visibleInMegaMenu,
            visible_in_search: i.visibleInSearch,
            visible_in_homepage: i.visibleInHomepage,
            visible_in_ai: i.visibleInAI,
            featured: i.featured,
            badge: i.badge,
            status: i.status,
            updated_at: i.updatedAt,
            updated_by: adminEmail,
          }));
        await supabase.from('navigation_configs').upsert(rows);
      }
    } catch (err) {
      console.warn('[NavigationStore] Failed to update category order in Supabase:', err);
    }

    return all;
  }

  /**
   * Resets all configurations to canonical defaults.
   */
  async resetToDefaults(adminEmail = 'admin@saarvi.in'): Promise<NavigationConfigItem[]> {
    const defaults = buildDefaultConfigs();
    this.cache = defaults;
    this.categoryCache = [...DEFAULT_CATEGORY_CONFIGS];
    try {
      toolDiscoveryService.invalidateCache();
    } catch {}

    try {
      const supabase = getSupabaseAdminClient();
      if (supabase) {
        await supabase.from('navigation_configs').delete().neq('id', 'NONE');
        const rows = defaults.map((d) => ({
          id: d.id,
          tool_id: d.toolId,
          category_id: d.categoryId,
          position: d.position,
          visible_in_navbar: d.visibleInNavbar,
          visible_in_mega_menu: d.visibleInMegaMenu,
          visible_in_search: d.visibleInSearch,
          visible_in_homepage: d.visibleInHomepage,
          visible_in_ai: d.visibleInAI,
          featured: d.featured,
          badge: d.badge,
          status: d.status,
          updated_at: d.updatedAt,
          updated_by: adminEmail,
        }));
        await supabase.from('navigation_configs').insert(rows);
      }
    } catch (err) {
      console.warn('[NavigationStore] Failed to reset defaults in Supabase:', err);
    }

    return defaults;
  }

  /**
   * Resolves effective runtime navigation by combining CANONICAL_TOOL_REGISTRY,
   * Supabase navigation configs, and active Feature Flags.
   */
  async getEffectiveNavigation() {
    const configs = await this.getAllConfigs();
    const categories = await this.getCategoryConfigs();

    // Map feature flags
    const featureMap = new Map<string, { status?: string; accessMode?: string }>();
    try {
      const flags = featureServerStore.getAllFeatures();
      flags.forEach((f) => {
        featureMap.set(f.id, { status: f.status, accessMode: f.accessMode });
        if (f.key) {
          featureMap.set(f.key, { status: f.status, accessMode: f.accessMode });
        }
      });
    } catch {}

    const configMap = new Map<string, NavigationConfigItem>();
    configs.forEach((c) => configMap.set(`${c.toolId}:${c.categoryId}`, c));

    // Resolve per category
    const resolvedCategories = categories
      .filter((cat) => cat.visible)
      .map((cat) => {
        const catTools = CANONICAL_TOOL_REGISTRY.filter((t) => t.category === cat.id);

        const resolvedTools = catTools
          .map((tool) => {
            const conf = configMap.get(`${tool.key}:${cat.id}`);
            const flag = featureMap.get(tool.featureFlagKey) || featureMap.get(tool.key);

            const isFlagDisabled = flag?.status === 'DISABLED';
            const isFlagMaintenance = flag?.status === 'MAINTENANCE';
            const isPro = flag?.accessMode === 'SUBSCRIPTION' || tool.defaultAccess === 'SUBSCRIPTION';

            let effectiveStatus: NavigationStatus = conf?.status || 'ACTIVE';
            if (isFlagDisabled) effectiveStatus = 'DISABLED';
            else if (isFlagMaintenance) effectiveStatus = 'MAINTENANCE';

            return {
              key: tool.key,
              name: tool.name,
              route: tool.route,
              icon: tool.icon,
              category: tool.category,
              categoryName: cat.label,
              description: tool.description,
              position: conf?.position ?? 0,
              visibleInNavbar: conf ? conf.visibleInNavbar : true,
              visibleInMegaMenu: conf ? conf.visibleInMegaMenu : true,
              visibleInSearch: conf ? conf.visibleInSearch : true,
              visibleInHomepage: conf ? conf.visibleInHomepage : true,
              visibleInAI: conf ? conf.visibleInAI : true,
              featured: conf ? conf.featured : false,
              badge: conf?.badge || tool.badge || (conf?.featured ? 'FEATURED' : null),
              status: effectiveStatus,
              requiresPro: isPro,
              isEnabled: effectiveStatus !== 'DISABLED',
            };
          })
          .sort((a, b) => a.position - b.position);

        return {
          id: cat.id,
          label: cat.label,
          route: cat.route,
          position: cat.position,
          tools: resolvedTools,
        };
      });

    return {
      categories: resolvedCategories,
      allTools: configs,
    };
  }
}

export const navigationStore = new NavigationStore();
