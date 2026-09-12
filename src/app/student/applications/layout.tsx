import type { Metadata } from 'next';
import { createMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = createMetadata({
  title: 'Job Applications Tracker',
  description: 'Private student career application tracking and interview pipeline.',
  path: '/student/applications',
  noIndex: true,
});

export default function ApplicationsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
