/**
 * Saarvi Navigation Store & Persistence Engine
 * Unified Admin Control Center 2.0 (Phase 40 Part A)
 *
 * Persists navigation configurations (visibility, position, featured, badges)
 * into Supabase table `navigation_configs` with an in-memory cached fallback.
 */

import { CANONICAL_TOOL_REGISTRY } from '../tools/tool-registry';
import type { CanonicalTool } from '../tools/tool-registry';
import { getSupabaseAdminClient } from '../supabase/admin';

export type NavigationStatus = 'ACTIVE' | 'NAVBAR_HIDDEN' | 'DISABLED' | 'MAINTENANCE';

export interface NavigationConfigItem {
  id: string;
  toolId: string;
  toolName: string;
  categoryId: string;
  route: string;
  position: number;
  visibleInNavbar: boolean;
  visibleInMegaMenu: boolean;
  visibleInSearch: boolean;
  visibleInHomepage: boolean;
  visibleInAI: boolean;
  featured: boolean;
  badge?: string | null;
  status: NavigationStatus;
  createdAt: string;
  updatedAt: string;
  updatedBy?: string;
}

/**
 * Builds default seed configurations derived deterministically from CANONICAL_TOOL_REGISTRY.
 */
function buildDefaultConfigs(): NavigationConfigItem[] {
  return CANONICAL_TOOL_REGISTRY.map((tool, index) => {
    const isFeatured = ['merge-pdf', 'pdf-to-excel', 'resume-builder', 'sgpa-calculator', 'document-scanner'].includes(tool.key);
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

class NavigationStore {
  private cache: NavigationConfigItem[] | null = null;
  private cacheExpiry = 0;
  private readonly TTL_MS = 60_000; // 1 minute in-memory cache

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
}

export const navigationStore = new NavigationStore();
