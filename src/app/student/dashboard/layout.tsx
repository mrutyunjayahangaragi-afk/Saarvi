import type { Metadata } from 'next';
import { createMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = createMetadata({
  title: 'Student Dashboard',
  description: 'Private student academic dashboard.',
  path: '/student/dashboard',
  noIndex: true,
});

export default function StudentDashboardLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
