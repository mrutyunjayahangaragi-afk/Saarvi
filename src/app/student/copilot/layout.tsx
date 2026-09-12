import type { Metadata } from 'next';
import { createMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = createMetadata({
  title: 'Academic Copilot',
  description: 'Private AI study assistant and mock interview coach.',
  path: '/student/copilot',
  noIndex: true,
});

export default function CopilotLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
