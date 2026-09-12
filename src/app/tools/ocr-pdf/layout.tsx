import type { Metadata } from 'next';
import { createMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = createMetadata({
  title: 'OCR PDF — Extract Text from Scanned PDFs',
  description: 'Optical Character Recognition (OCR) for scanned PDF documents. Extract searchable, editable text with high accuracy.',
  path: '/tools/ocr-pdf',
  keywords: ['ocr pdf', 'extract text from pdf', 'scanned pdf to text', 'searchable pdf'],
});

export default function OcrPdfLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
