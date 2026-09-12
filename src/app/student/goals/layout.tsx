import type { Metadata } from 'next';
import { createMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = createMetadata({
  title: 'Semester Goals',
  description: 'Private academic and career milestone goals.',
  path: '/student/goals',
  noIndex: true,
});

export default function GoalsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
