import type { Metadata } from 'next';
import { createMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = createMetadata({
  title: 'Study Assistant',
  description: 'Private student study assistant.',
  path: '/student/study-assistant',
  noIndex: true,
});

export default function StudyAssistantLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
