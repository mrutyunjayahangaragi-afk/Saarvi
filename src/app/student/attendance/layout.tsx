import type { Metadata } from 'next';
import { createMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = createMetadata({
  title: 'Attendance Tracker',
  description: 'Private class attendance tracking and safe bunk calculations.',
  path: '/student/attendance',
  noIndex: true,
});

export default function AttendanceLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
