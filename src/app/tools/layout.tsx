import type { Metadata } from 'next';
import { createMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = createMetadata({
  title: 'All Tools — Document & Image Utilities',
  description: 'Explore the complete directory of browser-based PDF converters, image format tools, compression utilities, and student calculators.',
  path: '/tools',
  keywords: ['all document tools', 'pdf converters', 'image format converter', 'student calculators directory'],
});

export default function ToolsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
