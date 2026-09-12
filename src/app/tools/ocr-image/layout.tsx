import type { Metadata } from 'next';
import { createMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = createMetadata({
  title: 'OCR Image — Extract Text from Photos & Screenshots',
  description: 'Extract clear, structured text from PNG, JPG, and photo scans using privacy-preserving image recognition.',
  path: '/tools/ocr-image',
  keywords: ['ocr image', 'extract text from photo', 'image to text', 'screenshot to text'],
});

export default function OcrImageLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
