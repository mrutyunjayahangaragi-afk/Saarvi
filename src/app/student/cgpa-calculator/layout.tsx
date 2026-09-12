import type { Metadata } from 'next';
import { createMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = createMetadata({
  title: 'VTU CGPA & Percentage Calculator',
  description: 'Calculate cumulative grade point average (CGPA) and convert to Karnataka state percentage using the official VTU formula: Percentage = (CGPA - 0.75) * 10.',
  path: '/student/cgpa-calculator',
  keywords: ['vtu cgpa calculator', 'vtu percentage conversion', 'cgpa to percentage vtu', 'vtu 2022 scheme cgpa'],
});

export default function CgpaCalculatorLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
