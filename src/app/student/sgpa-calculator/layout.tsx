import type { Metadata } from 'next';
import { createMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = createMetadata({
  title: 'VTU SGPA Calculator — 2022 & 2018 Scheme',
  description: 'Official deterministic VTU SGPA calculator supporting CIE + SEE evaluation, credit weighting, and CBCS/NEP schemes.',
  path: '/student/sgpa-calculator',
  keywords: ['vtu sgpa calculator', 'vtu 2022 scheme', 'vtu grading system', 'vtu marks calculator', 'calculate sgpa'],
});

export default function SgpaCalculatorLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
