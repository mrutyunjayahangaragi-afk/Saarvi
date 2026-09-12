import type { Metadata } from 'next';
import { createMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = createMetadata({
  title: 'Hackathons Tracker',
  description: 'Private hackathon participation, project submissions, and awards tracker.',
  path: '/student/hackathons',
  noIndex: true,
});

export default function HackathonsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
