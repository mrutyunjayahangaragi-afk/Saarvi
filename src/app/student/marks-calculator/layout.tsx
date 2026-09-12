import type { Metadata } from 'next';
import { createMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = createMetadata({
  title: 'VTU Marks & Passing Cutoffs Calculator',
  description: 'Evaluate minimum CIE and SEE passing marks, calculate required exam scores, and project grade cutoffs for VTU engineering courses.',
  path: '/student/marks-calculator',
  keywords: ['vtu marks calculator', 'vtu passing marks', 'cie cutoffs', 'see minimum passing marks'],
});

export default function MarksCalculatorLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
