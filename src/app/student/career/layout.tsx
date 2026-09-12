import type { Metadata } from 'next';
import { createMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = createMetadata({
  title: 'Career & Placement Suite',
  description: 'Private student career dashboard and skill gap planner.',
  path: '/student/career',
  noIndex: true,
});

export default function StudentCareerLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
