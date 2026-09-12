import type { Metadata } from 'next';
import { createMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = createMetadata({
  title: 'Document Q&A — Ask Questions About Documents',
  description: 'Ask precise questions against lecture notes, syllabus documents, and PDF manuals with grounded citations.',
  path: '/tools/document-qa',
  keywords: ['document qa', 'ask pdf', 'chat with notes', 'study document assistant'],
});

export default function DocumentQaLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
