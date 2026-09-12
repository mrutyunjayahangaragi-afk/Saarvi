import type { Metadata } from 'next';
import { createMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = createMetadata({
  title: 'Document Summary — Summarize Long PDFs',
  description: 'Generate concise, executive bullet-point summaries and key takeaway extractions from complex PDF reports and academic readings.',
  path: '/tools/document-summary',
  keywords: ['document summarizer', 'summarize pdf', 'study summary generator', 'paper overview'],
});

export default function DocumentSummaryLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
