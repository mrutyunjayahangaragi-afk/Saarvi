import type { Metadata } from 'next';
import { createMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = createMetadata({
  title: 'Certificates Vault',
  description: 'Private student credentials and course completion certificates repository.',
  path: '/student/certificates',
  noIndex: true,
});

export default function CertificatesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
