import type { Metadata } from 'next';
import { createMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = createMetadata({
  title: 'Tasks & Action Items',
  description: 'Private student academic task manager.',
  path: '/student/tasks',
  noIndex: true,
});

export default function TasksLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
