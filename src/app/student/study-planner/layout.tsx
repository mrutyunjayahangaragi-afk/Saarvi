import type { Metadata } from 'next';
import { createMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = createMetadata({
  title: 'Study Planner',
  description: 'Private exam preparation and study session planner.',
  path: '/student/study-planner',
  noIndex: true,
});

export default function StudyPlannerLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
