import type { Metadata } from 'next';
import { createMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = createMetadata({
  title: 'Internships Tracker',
  description: 'Private student internship logging and experiential learning portfolio.',
  path: '/student/internships',
  noIndex: true,
});

export default function InternshipsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
