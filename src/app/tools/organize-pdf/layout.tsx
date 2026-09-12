import type { Metadata } from 'next';
import { createMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = createMetadata({
  title: 'Organize PDF Pages — Reorder, Rotate & Delete',
  description: 'Rearrange PDF page order, rotate pages, delete unnecessary pages, and save your reordered PDF directly in the browser.',
  path: '/tools/organize-pdf',
  keywords: ['organize pdf', 'reorder pdf pages', 'rotate pdf', 'delete pdf pages', 'client-side pdf editor'],
});

export default function OrganizePdfLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
