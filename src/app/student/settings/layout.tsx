import type { Metadata } from 'next';
import { createMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = createMetadata({
  title: 'Student Settings',
  description: 'Private student notification and profile preferences.',
  path: '/student/settings',
  noIndex: true,
});

export default function StudentSettingsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
