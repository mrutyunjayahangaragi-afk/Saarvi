import type { Metadata } from 'next';
import { createMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = createMetadata({
  title: 'Pricing & Plans',
  description: 'Saarvi free tier and Pro subscription plans. Transparent pricing for students, engineers, and everyday users.',
  path: '/pricing',
  keywords: ['saarvi pricing', 'free pdf tools', 'student subscription', 'document converter pricing'],
});

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
