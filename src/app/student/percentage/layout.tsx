import type { Metadata } from 'next';
import { createMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = createMetadata({
  title: 'VTU CGPA to Percentage Converter',
  description: 'Official VTU formula to convert CGPA to equivalent percentage: Percentage = [CGPA - 0.75] x 10 with verified class declaration.',
  path: '/student/percentage',
  keywords: ['vtu percentage calculator', 'cgpa to percentage', 'vtu conversion formula', 'first class distinction vtu'],
});

export default function PercentageCalculatorLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
