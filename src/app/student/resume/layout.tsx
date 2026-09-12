import type { Metadata } from 'next';
import { createMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = createMetadata({
  title: 'Resume Builder',
  description: 'Private student ATS resume editor with client-side vector PDF generation.',
  path: '/student/resume',
  noIndex: true,
});

export default function StudentResumeLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
