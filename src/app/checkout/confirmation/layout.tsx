import type { Metadata } from 'next';
import { createMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = createMetadata({
  title: 'Order Confirmation',
  description: 'Saarvi subscription confirmation.',
  path: '/checkout/confirmation',
  noIndex: true,
});

export default function CheckoutConfirmationLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
