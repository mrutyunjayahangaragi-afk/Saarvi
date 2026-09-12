import type { Metadata } from 'next';
import { createMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = createMetadata({
  title: 'Career Workspace',
  description: 'Private student career management.',
  path: '/career',
  noIndex: true,
});

export default function CareerLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
