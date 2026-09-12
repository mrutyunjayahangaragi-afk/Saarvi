import type { Metadata } from 'next';
import { createMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = createMetadata({
  title: 'Weekly Timetable',
  description: 'Private class schedule and conflict management.',
  path: '/student/timetable',
  noIndex: true,
});

export default function TimetableLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
