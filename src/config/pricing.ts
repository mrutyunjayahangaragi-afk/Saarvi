// DocEase Phase 13: Centralized Server-Authoritative Pricing Configuration
// The server determines prices, currency, and intervals. Frontend never submits arbitrary amounts.

import { BillingInterval } from '@/types/plan';

export interface PlanPriceConfig {
  plan: 'pro';
  interval: BillingInterval;
  amountCents: number; // in lowest currency denomination (e.g. 9900 paise = ₹99)
  amountDisplay: string;
  currency: string;
  name: string;
  description: string;
  savingsNote?: string;
  periodLabel: string;
}

export const PRO_PRICING: Record<BillingInterval, PlanPriceConfig> = {
  monthly: {
    plan: 'pro',
    interval: 'monthly',
    amountCents: 9900, // ₹99.00
    amountDisplay: '₹99',
    currency: 'INR',
    name: 'Saarvi Pro Monthly',
    description: 'High-throughput document and student productivity package',
    periodLabel: '/month',
  },
  yearly: {
    plan: 'pro',
    interval: 'yearly',
    amountCents: 89900, // ₹899.00 (~₹75/mo)
    amountDisplay: '₹899',
    currency: 'INR',
    name: 'Saarvi Pro Yearly',
    description: 'Annual commitment with ~25% savings for continuous academic productivity',
    savingsNote: 'Save ~25%',
    periodLabel: '/year',
  },
};

// Strictly Active Features (No misleading AI/OCR advertising per Section 15 & 16)
export const ACTIVE_PRO_BENEFITS = [
  {
    title: '50-File Batch Queue',
    description: 'Convert or compress up to 50 documents or images simultaneously in a single queue (vs 10 on Free).',
  },
  {
    title: '100 MB File Limit',
    description: 'Process large high-resolution scans and portfolios up to 100 MB per file directly in browser memory.',
  },
  {
    title: '200-Page PDF Processing',
    description: 'Split, extract, and reorder long technical books, question papers, and manuals up to 200 pages.',
  },
  {
    title: 'Premium ATS Resume Templates',
    description: 'Full access to professional two-column, Ivy League minimalist, and modern tech resume templates.',
  },
  {
    title: '365-Day Workspace History',
    description: 'Preserve your conversion records and quick-reaccess metadata for a full academic year.',
  },
  {
    title: 'Multi-Profile Student Management',
    description: 'Save distinct academic tracking profiles for multiple semesters, degree schemes, or students.',
  },
  {
    title: '100% In-Browser Privacy',
    description: 'All local tools remain 100% local. Pro never forces your documents into cloud storage.',
  },
];

export const PRO_ROADMAP_DISCLAIMER =
  'Notice: AI-powered document assistants and Optical Character Recognition (OCR) tools are not included in this release and are currently in development.';

export function getPlanPrice(interval: BillingInterval): PlanPriceConfig {
  const price = PRO_PRICING[interval];
  if (!price) {
    throw new Error(`Invalid billing interval requested: ${interval}`);
  }
  return price;
}
