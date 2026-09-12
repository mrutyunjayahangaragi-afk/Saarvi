import type { Metadata } from 'next';
import { createMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = createMetadata({
  title: 'Assignment Planner',
  description: 'Private student assignment deadline and prioritization planner.',
  path: '/student/assignment-planner',
  noIndex: true,
});

export default function AssignmentPlannerLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
