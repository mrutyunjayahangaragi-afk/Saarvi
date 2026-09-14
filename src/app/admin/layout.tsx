import type { Metadata } from 'next';
import { createMetadata } from '@/lib/seo/metadata';
import AdminLayoutClient from '@/components/admin/AdminLayoutClient';

export const metadata: Metadata = createMetadata({
  title: 'Admin Portal',
  description: 'Saarvi platform administrative management.',
  path: '/admin',
  noIndex: true,
});

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminLayoutClient>{children}</AdminLayoutClient>;
}
