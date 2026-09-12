import type { Metadata } from 'next';
import { createMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = createMetadata({
  title: 'Cover Letter Builder',
  description: 'Private targeted internship and engineering cover letter generator.',
  path: '/student/cover-letter',
  noIndex: true,
});

export default function CoverLetterLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
