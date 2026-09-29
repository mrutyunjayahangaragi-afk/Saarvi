import { getSupabaseAdminClient } from '../supabase/admin.ts';
import { isSupabaseConfigured } from '../supabase/config.ts';
import type {
  CareerTemplate,
  DocumentType,
  TemplateStatus,
  CompiledTemplateSchema,
  TemplateSource,
} from './types.ts';
import { BUILT_IN_RESUME_TEMPLATES } from '../services/resumeTemplateService.ts';
import { SAMPLE_RESUME_PROFILE } from '../services/resumeSampleData.ts';

// In-memory cache for ultra-fast response and serverless fallback
const inMemoryTemplateCache = new Map<string, CareerTemplate>();
let isInitialized = false;

function mapRowToTemplate(row: any): CareerTemplate {
  return {
    id: row.id,
    documentType: row.document_type as DocumentType,
    name: row.name,
    description: row.description || '',
    category: row.category,
    version: row.version || 1,
    status: row.status as TemplateStatus,
    isActive: Boolean(row.is_active),
    isPro: Boolean(row.is_pro),
    isFeatured: Boolean(row.is_featured),
    sortOrder: row.sort_order || 0,
    primaryColor: row.primary_color || '#0f172a',
    fontFamily: row.font_family || 'Inter, sans-serif',
    layout: row.layout || 'single-column',
    pageSize: row.page_size || 'A4',
    margins: row.margins || { top: 20, bottom: 20, left: 20, right: 20 },
    schema: row.schema || ({} as CompiledTemplateSchema),
    sampleData: row.sample_data || SAMPLE_RESUME_PROFILE,
    thumbnailUrl: row.thumbnail_url || undefined,
    sourceFileUrl: row.source_file_url || undefined,
    fileHash: row.file_hash || undefined,
    source: (row.source || 'Saarvi Original') as TemplateSource,
    sourceUrl: row.source_url || undefined,
    license: row.license || 'Saarvi Proprietary',
    licenseUrl: row.license_url || undefined,
    rightsVerified: Boolean(row.rights_verified ?? true),
    rightsNotes: row.rights_notes || undefined,
    createdBy: row.created_by || undefined,
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString(),
  };
}

function mapTemplateToRow(tpl: CareerTemplate): Record<string, any> {
  return {
    id: tpl.id,
    document_type: tpl.documentType,
    name: tpl.name,
    description: tpl.description,
    category: tpl.category,
    version: tpl.version,
    status: tpl.status,
    is_active: tpl.isActive,
    is_pro: tpl.isPro,
    is_featured: tpl.isFeatured,
    sort_order: tpl.sortOrder,
    primary_color: tpl.primaryColor,
    font_family: tpl.fontFamily,
    layout: tpl.layout,
    page_size: tpl.pageSize,
    margins: tpl.margins,
    schema: tpl.schema,
    sample_data: tpl.sampleData,
    thumbnail_url: tpl.thumbnailUrl || null,
    source_file_url: tpl.sourceFileUrl || null,
    file_hash: tpl.fileHash || null,
    source: tpl.source,
    source_url: tpl.sourceUrl || null,
    license: tpl.license,
    license_url: tpl.licenseUrl || null,
    rights_verified: tpl.rightsVerified,
    rights_notes: tpl.rightsNotes || null,
    created_by: tpl.createdBy || null,
    created_at: tpl.createdAt,
    updated_at: tpl.updatedAt,
  };
}

export class TemplateRepository {
  /**
   * Initializes built-in templates into database if not already present.
   */
  public static async initializeDefaults(): Promise<void> {
    if (isInitialized) return;

    // Convert BUILT_IN_RESUME_TEMPLATES to CareerTemplate records
    for (const b of BUILT_IN_RESUME_TEMPLATES) {
      if (!inMemoryTemplateCache.has(b.id)) {
        const tpl: CareerTemplate = {
          id: b.id,
          documentType: 'RESUME',
          name: b.name,
          description: b.description,
          category: b.category as any,
          version: 1,
          status: 'PUBLISHED',
          isActive: b.isActive,
          isPro: b.isPro,
          isFeatured: b.isFeatured,
          sortOrder: b.sortOrder,
          primaryColor: b.primaryColor,
          fontFamily: b.fontFamily,
          layout: b.layout as any,
          pageSize: 'A4',
          margins: { top: 20, bottom: 20, left: 20, right: 20 },
          schema: {
            templateId: b.id,
            version: 1,
            documentType: 'RESUME',
            pageSize: 'A4',
            margins: { top: 20, bottom: 20, left: 20, right: 20 },
            fontFamily: b.fontFamily,
            primaryColor: b.primaryColor,
            accentColor: '#0f172a',
            layout: b.layout as any,
            mode: 'COMPILED',
            header: {
              fullNameField: 'fullName',
              headlineField: 'headline',
              emailField: 'email',
              phoneField: 'phone',
              locationField: 'location',
            },
            sections: [
              { id: 'summary', title: 'Summary', type: 'text', sourceKey: 'summary' },
              { id: 'experience', title: 'Experience', type: 'repeat', sourceKey: 'experience' },
              { id: 'education', title: 'Education', type: 'repeat', sourceKey: 'education' },
              { id: 'skills', title: 'Skills', type: 'skills-tags', sourceKey: 'skills' },
            ],
          },
          sampleData: SAMPLE_RESUME_PROFILE,
          source: 'Saarvi Original',
          license: 'Saarvi Proprietary',
          rightsVerified: true,
          createdAt: b.createdAt || new Date().toISOString(),
          updatedAt: b.updatedAt || new Date().toISOString(),
        };
        inMemoryTemplateCache.set(tpl.id, tpl);
      }
    }

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdminClient();
      if (supabase) {
        try {
          const { count, error } = await supabase
            .from('career_templates')
            .select('id', { count: 'exact', head: true });

          if (!error && (count === null || count === 0)) {
            const rows = Array.from(inMemoryTemplateCache.values()).map(mapTemplateToRow);
            await supabase.from('career_templates').insert(rows);
          }
        } catch (err) {
          console.warn('[TemplateRepository] Seed check note:', err);
        }
      }
    }

    isInitialized = true;
  }

  /**
   * Finds a template by its SHA-256 file hash to prevent duplicates.
   */
  public static async findByHash(fileHash: string): Promise<CareerTemplate | null> {
    await this.initializeDefaults();

    // Check memory
    for (const tpl of inMemoryTemplateCache.values()) {
      if (tpl.fileHash === fileHash) return tpl;
    }

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdminClient();
      if (supabase) {
        const { data } = await supabase
          .from('career_templates')
          .select('*')
          .eq('file_hash', fileHash)
          .maybeSingle();

        if (data) {
          const mapped = mapRowToTemplate(data);
          inMemoryTemplateCache.set(mapped.id, mapped);
          return mapped;
        }
      }
    }

    return null;
  }

  /**
   * Retrieves all templates for Admin management with optional filtering.
   */
  public static async getAllTemplates(filters?: {
    documentType?: DocumentType;
    status?: TemplateStatus | 'ALL';
    category?: string;
    search?: string;
  }): Promise<CareerTemplate[]> {
    await this.initializeDefaults();

    let list: CareerTemplate[] = [];

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdminClient();
      if (supabase) {
        let query = supabase.from('career_templates').select('*').order('sort_order', { ascending: true });

        if (filters?.documentType) {
          query = query.eq('document_type', filters.documentType);
        }
        if (filters?.status && filters.status !== 'ALL') {
          query = query.eq('status', filters.status);
        }
        if (filters?.category && filters.category !== 'ALL') {
          query = query.eq('category', filters.category);
        }

        const { data, error } = await query;
        if (!error && data && data.length > 0) {
          list = data.map(mapRowToTemplate);
          // Sync cache
          for (const item of list) {
            inMemoryTemplateCache.set(item.id, item);
          }
        }
      }
    }

    if (list.length === 0) {
      list = Array.from(inMemoryTemplateCache.values());
      if (filters?.documentType) {
        list = list.filter((t) => t.documentType === filters.documentType);
      }
      if (filters?.status && filters.status !== 'ALL') {
        list = list.filter((t) => t.status === filters.status);
      }
      if (filters?.category && filters.category !== 'ALL') {
        list = list.filter((t) => t.category === filters.category);
      }
    }

    if (filters?.search?.trim()) {
      const q = filters.search.trim().toLowerCase();
      list = list.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.category.toLowerCase().includes(q)
      );
    }

    return list.sort((a, b) => a.sortOrder - b.sortOrder);
  }

  /**
   * Retrieves published, active templates visible to end users.
   */
  public static async getActiveTemplates(docType: DocumentType = 'RESUME'): Promise<CareerTemplate[]> {
    const all = await this.getAllTemplates({ documentType: docType, status: 'PUBLISHED' });
    return all.filter((t) => t.isActive);
  }

  /**
   * Retrieves a template by its ID and optional pinned version.
   */
  public static async getTemplateById(id: string, version?: number): Promise<CareerTemplate | null> {
    await this.initializeDefaults();

    if (inMemoryTemplateCache.has(id)) {
      const cached = inMemoryTemplateCache.get(id)!;
      if (!version || cached.version === version) return cached;
    }

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdminClient();
      if (supabase) {
        let query = supabase.from('career_templates').select('*').eq('id', id);
        if (version) {
          query = query.eq('version', version);
        }
        const { data } = await query.maybeSingle();
        if (data) {
          const tpl = mapRowToTemplate(data);
          inMemoryTemplateCache.set(tpl.id, tpl);
          return tpl;
        }
      }
    }

    return inMemoryTemplateCache.get(id) || null;
  }

  /**
   * Saves or updates a template in the canonical database.
   */
  public static async saveTemplate(tpl: CareerTemplate): Promise<CareerTemplate> {
    await this.initializeDefaults();

    const updated: CareerTemplate = {
      ...tpl,
      updatedAt: new Date().toISOString(),
    };

    inMemoryTemplateCache.set(updated.id, updated);

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdminClient();
      if (supabase) {
        const row = mapTemplateToRow(updated);
        const { error } = await supabase.from('career_templates').upsert(row, { onConflict: 'id' });
        if (error) {
          console.error('[TemplateRepository] Error saving template to Supabase:', error.message);
        }
      }
    }

    return updated;
  }

  /**
   * Creates a new version (v2, v3...) of an existing template.
   */
  public static async createNewVersion(
    originalId: string,
    updates: Partial<CareerTemplate>
  ): Promise<CareerTemplate | null> {
    const original = await this.getTemplateById(originalId);
    if (!original) return null;

    const newVersion = original.version + 1;
    const newId = `${original.id}_v${newVersion}`;

    const versioned: CareerTemplate = {
      ...original,
      ...updates,
      id: newId,
      version: newVersion,
      name: updates.name || `${original.name} (v${newVersion})`,
      status: updates.status || 'DRAFT',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return this.saveTemplate(versioned);
  }

  /**
   * Toggles the active status of a template.
   */
  public static async toggleActive(id: string, isActive: boolean): Promise<CareerTemplate | null> {
    const tpl = await this.getTemplateById(id);
    if (!tpl) return null;
    return this.saveTemplate({ ...tpl, isActive });
  }

  /**
   * Updates template publishing status.
   * Enforces rights verification: UNKNOWN or unverified templates cannot be published.
   */
  public static async updateStatus(
    id: string,
    status: TemplateStatus,
    adminNotes?: string
  ): Promise<{ success: boolean; template?: CareerTemplate; error?: string }> {
    const tpl = await this.getTemplateById(id);
    if (!tpl) {
      return { success: false, error: 'Template not found' };
    }

    if (status === 'PUBLISHED' && (!tpl.rightsVerified || tpl.source === ('UNKNOWN' as any))) {
      return {
        success: false,
        error: 'Cannot publish template: Copyright / License rights must be verified before publishing.',
      };
    }

    const updated = await this.saveTemplate({
      ...tpl,
      status,
      rightsNotes: adminNotes || tpl.rightsNotes,
    });

    return { success: true, template: updated };
  }

  /**
   * Duplicates an existing template into a new custom template.
   */
  public static async duplicateTemplate(id: string): Promise<CareerTemplate | null> {
    const original = await this.getTemplateById(id);
    if (!original) return null;

    const newId = `${original.id}-copy-${Date.now().toString(36)}`;
    const copy: CareerTemplate = {
      ...original,
      id: newId,
      name: `${original.name} (Copy)`,
      version: 1,
      status: 'DRAFT',
      sortOrder: original.sortOrder + 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return this.saveTemplate(copy);
  }
}
