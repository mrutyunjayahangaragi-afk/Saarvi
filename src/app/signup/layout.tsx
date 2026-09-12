import type { Metadata } from 'next';
import { createMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = createMetadata({
  title: 'Create Account',
  description: 'Create your Saarvi account.',
  path: '/signup',
  noIndex: true,
});

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
