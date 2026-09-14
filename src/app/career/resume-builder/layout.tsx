import type { Metadata } from 'next';
import { createMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = createMetadata({
  title: 'Resume Builder',
  description: 'Build modern, ATS-friendly resumes directly in your browser with real-time preview and instant PDF export.',
  path: '/career/resume-builder',
});

export default function ResumeBuilderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
