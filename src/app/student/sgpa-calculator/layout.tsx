import type { Metadata } from 'next';
import { createMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = createMetadata({
  title: 'SGPA Calculator',
  description: 'Deterministic SGPA calculator supporting CIE + SEE evaluation, credit weighting, and multi-university CBCS/NEP schemes.',
  path: '/student/sgpa-calculator',
  keywords: ['sgpa calculator', 'vtu sgpa calculator', 'engineering sgpa calculator', 'college sgpa calculator', 'calculate sgpa'],
});

export default function SgpaCalculatorLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
