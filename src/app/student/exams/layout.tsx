import type { Metadata } from 'next';
import { createMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = createMetadata({
  title: 'Exam Schedule',
  description: 'Private exam schedule and countdown manager.',
  path: '/student/exams',
  noIndex: true,
});

export default function ExamsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
