import type { ResumeTemplateDefinition } from "../../types/career.ts";

export const BUILT_IN_RESUME_TEMPLATES: ResumeTemplateDefinition[] = [
  {
    id: "classic-ats",
    name: "ATS Classic — Saarvi",
    description: "Official Saarvi single-column, Helvetica, text-based LaTeX structure with hyperref links and non-table skills flow.",
    category: "STANDARD",
    isActive: true,
    isPro: false,
    isFeatured: true,
    sortOrder: 1,
    primaryColor: "#0f172a",
    fontFamily: "Inter, Helvetica, Arial, sans-serif",
    layout: "single-column",
    badges: ["ATS First", "LaTeX Ready"],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "modern-professional",
    name: "Modern Professional",
    description: "Subtle royal blue accents, clean metadata chips, polished hierarchy for corporate and engineering roles.",
    category: "STANDARD",
    isActive: true,
    isPro: false,
    isFeatured: true,
    sortOrder: 2,
    primaryColor: "#2563eb",
    fontFamily: "Inter, sans-serif",
    layout: "single-column",
    badges: ["Popular", "Corporate & Tech"],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "executive",
    name: "Executive Serif",
    description: "Deep navy headers, prominent leadership and experience framing with elegant serif typography.",
    category: "EXECUTIVE",
    isActive: true,
    isPro: false,
    isFeatured: false,
    sortOrder: 3,
    primaryColor: "#1e293b",
    fontFamily: "Georgia, Cambria, 'Times New Roman', serif",
    layout: "single-column",
    badges: ["Senior", "Leadership"],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "student-clean",
    name: "Student Clean",
    description: "Prominently highlights university education, scheme, branch, CGPA, projects, certifications & hackathons.",
    category: "ACADEMIC",
    isActive: true,
    isPro: false,
    isFeatured: true,
    sortOrder: 4,
    primaryColor: "#0d9488",
    fontFamily: "Inter, sans-serif",
    layout: "single-column",
    badges: ["VTU Optimized", "Campus Placement"],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "minimal",
    name: "Tech Minimal",
    description: "High information density, condensed typography, zero decorative dividers, maximum ATS speed.",
    category: "TECHNICAL",
    isActive: true,
    isPro: false,
    isFeatured: false,
    sortOrder: 5,
    primaryColor: "#334155",
    fontFamily: "system-ui, -apple-system, sans-serif",
    layout: "single-column",
    badges: ["Compact", "Fast ATS"],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "creative-accent",
    name: "Creative Accent",
    description: "Vibrant violet header accents with modern metadata tags and two-column sidebar layout.",
    category: "CREATIVE",
    isActive: true,
    isPro: true,
    isFeatured: false,
    sortOrder: 6,
    primaryColor: "#7c3aed",
    fontFamily: "Inter, Outfit, sans-serif",
    layout: "two-column-left",
    badges: ["Pro Plan", "Modern Layout"],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
];

const TEMPLATE_STORAGE_KEY = "saarvi_admin_resume_templates";

// In-memory runtime cache for server-side environments
let inMemoryTemplates: ResumeTemplateDefinition[] = [...BUILT_IN_RESUME_TEMPLATES];

export const resumeTemplateService = {
  /**
   * Retrieves all templates (active & inactive).
   */
  getAllTemplates(): ResumeTemplateDefinition[] {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem(TEMPLATE_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed.sort((a, b) => a.sortOrder - b.sortOrder);
          }
        }
      } catch {
        // Fallback to memory
      }
    }
    return [...inMemoryTemplates].sort((a, b) => a.sortOrder - b.sortOrder);
  },

  /**
   * Retrieves only active templates for user/student display.
   */
  getActiveTemplates(): ResumeTemplateDefinition[] {
    return this.getAllTemplates().filter((t) => t.isActive);
  },

  /**
   * Retrieves a template by its unique ID.
   */
  getTemplateById(id: string): ResumeTemplateDefinition | undefined {
    return this.getAllTemplates().find((t) => t.id === id);
  },

  /**
   * Saves or updates a template definition.
   */
  saveTemplate(template: ResumeTemplateDefinition): ResumeTemplateDefinition {
    const list = this.getAllTemplates();
    const index = list.findIndex((t) => t.id === template.id);

    const updatedTemplate: ResumeTemplateDefinition = {
      ...template,
      updatedAt: new Date().toISOString(),
    };

    if (index >= 0) {
      list[index] = updatedTemplate;
    } else {
      updatedTemplate.createdAt = new Date().toISOString();
      list.push(updatedTemplate);
    }

    inMemoryTemplates = list;

    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(list));
      } catch {
        // ignore
      }
    }

    return updatedTemplate;
  },

  /**
   * Toggles the active status of a template.
   */
  toggleTemplateActive(id: string, isActive: boolean): ResumeTemplateDefinition | null {
    const tpl = this.getTemplateById(id);
    if (!tpl) return null;
    return this.saveTemplate({ ...tpl, isActive });
  },

  /**
   * Duplicates an existing template into a new custom template.
   */
  duplicateTemplate(id: string): ResumeTemplateDefinition | null {
    const original = this.getTemplateById(id);
    if (!original) return null;

    const newId = `${original.id}-copy-${Date.now().toString(36)}`;
    const copy: ResumeTemplateDefinition = {
      ...original,
      id: newId,
      name: `${original.name} (Copy)`,
      sortOrder: original.sortOrder + 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return this.saveTemplate(copy);
  },

  /**
   * Resets all templates to original built-in defaults.
   */
  resetToDefaults(): ResumeTemplateDefinition[] {
    inMemoryTemplates = [...BUILT_IN_RESUME_TEMPLATES];
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem(TEMPLATE_STORAGE_KEY);
      } catch {
        // ignore
      }
    }
    return [...BUILT_IN_RESUME_TEMPLATES];
  },
};
