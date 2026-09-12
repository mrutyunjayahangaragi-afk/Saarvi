import type { Metadata } from 'next';
import { createMetadata } from '@/lib/seo/metadata';
import DashboardLayoutClient from '@/components/dashboard/DashboardLayoutClient';

export const metadata: Metadata = createMetadata({
  title: 'Workspace Dashboard',
  description: 'Private user workspace, conversion history, and account settings.',
  path: '/dashboard',
  noIndex: true,
});

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <DashboardLayoutClient>{children}</DashboardLayoutClient>;
}
