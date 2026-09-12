import { Plan, ProcessingType } from "./plan";

export type ToolCategory = "image" | "pdf" | "student" | "ai" | "ocr";

export type ToolStatus = "available" | "beta" | "coming_soon" | "disabled" | "maintenance";

export type PrivacyLevel = "local" | "external";

export interface ToolLimits {
  maxPages?: number;
  maxChars?: number;
  maxMB?: number;
  maxPixels?: number;
}

export interface ToolFaq {
  question: string;
  answer: string;
}

export type ToolSubcategory =
  | "academic"
  | "planning"
  | "career"
  | "organization"
  | "documents";

export interface ToolDefinition {
  id: string;
  slug: string;
  name: string;
  category: ToolCategory;
  subcategory?: ToolSubcategory;
  badge?: string;
  description: string;
  detailedDescription?: string;
  icon: string;
  route: string;
  status: ToolStatus;
  requiresAuth: boolean;
  requiresPro: boolean;
  requiredPlan?: Plan;
  processingType?: ProcessingType;
  featureId?: string;
  popular?: boolean;
  supportedFormats: string[];
  inputFormats?: string[];
  maxSizeMB: number;
  howItWorks?: string[];
  faq?: ToolFaq[];
  relatedSlugs?: string[];
  keywords?: string[];
  requiresExternalProcessing?: boolean;
  supportsLocalProcessing?: boolean;
  supportsOCR?: boolean;
  supportsAI?: boolean;
  privacyLevel?: PrivacyLevel;
  processor?: string;
  limits?: ToolLimits;
}

