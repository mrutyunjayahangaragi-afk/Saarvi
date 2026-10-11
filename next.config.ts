import type { NextConfig } from "next";

// Global Iterator polyfill for Node.js build workers and pdfjs-dist
const g = globalThis as unknown as Record<string, unknown>;
if (typeof g.Iterator === "undefined") {
  class CustomIterator {}
  g.Iterator = CustomIterator;
}

const cspHeader = `
  default-src 'self';
  script-src 'self' 'unsafe-inline' 'unsafe-eval' https://checkout.razorpay.com;
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  font-src 'self' https://fonts.gstatic.com data:;
  img-src 'self' data: blob: https://*.razorpay.com https://*.googleusercontent.com https://*.supabase.co https://api.qrserver.com;
  connect-src 'self' https://api.razorpay.com https://lumberjack.razorpay.com https://lumberjack-cx.razorpay.com https://*.supabase.co;
  frame-src 'self' https://api.razorpay.com https://checkout.razorpay.com;
  frame-ancestors 'self';
  worker-src 'self' blob:;
  object-src 'none';
  base-uri 'self';
  form-action 'self';
`.replace(/\s{2,}/g, ' ').trim();

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
      {
        protocol: 'https',
        hostname: 'api.qrserver.com',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: cspHeader,
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
        ],
      },
    ];
  },
  async redirects() {
    return [
      // Direct Search -> Exact Tool Page System (308 Permanent Single-Hop Redirects)
      { source: "/pdf-to-jpg", destination: "/tools/pdf-to-jpg", permanent: true },
      { source: "/jpg-to-pdf", destination: "/tools/jpg-to-pdf", permanent: true },
      { source: "/image-to-pdf", destination: "/tools/image-to-pdf", permanent: true },
      { source: "/compress-pdf", destination: "/tools/compress-pdf", permanent: true },
      { source: "/merge-pdf", destination: "/tools/merge-pdf", permanent: true },
      { source: "/split-pdf", destination: "/tools/split-pdf", permanent: true },
      { source: "/pdf-to-png", destination: "/tools/pdf-to-png", permanent: true },
      { source: "/png-to-jpg", destination: "/tools/png-to-jpg", permanent: true },
      { source: "/jpg-to-png", destination: "/tools/jpg-to-png", permanent: true },
      { source: "/compress-image", destination: "/tools/compress-image", permanent: true },
      { source: "/image-compressor", destination: "/tools/compress-image", permanent: true },
      { source: "/image-resize", destination: "/tools/image-resize", permanent: true },
      { source: "/crop-image", destination: "/tools/crop-image", permanent: true },
      { source: "/rotate-image", destination: "/tools/rotate-image", permanent: true },
      { source: "/rotate-pdf", destination: "/tools/rotate-pdf", permanent: true },
      { source: "/extract-pdf-pages", destination: "/tools/extract-pdf-pages", permanent: true },
      { source: "/delete-pdf-pages", destination: "/tools/delete-pdf-pages", permanent: true },
      { source: "/reorder-pdf-pages", destination: "/tools/reorder-pdf-pages", permanent: true },
      { source: "/reorder-pdf", destination: "/tools/reorder-pdf-pages", permanent: true },
      { source: "/protect-pdf", destination: "/tools/protect-pdf", permanent: true },
      { source: "/unlock-pdf", destination: "/tools/unlock-pdf", permanent: true },
      { source: "/watermark-pdf", destination: "/tools/watermark-pdf", permanent: true },
      { source: "/page-numbers-pdf", destination: "/tools/page-numbers-pdf", permanent: true },
      { source: "/pdf-header-footer", destination: "/tools/pdf-header-footer", permanent: true },
      { source: "/pdf-metadata", destination: "/tools/pdf-metadata", permanent: true },
      { source: "/flatten-pdf", destination: "/tools/flatten-pdf", permanent: true },
      { source: "/pdf-info", destination: "/tools/pdf-info", permanent: true },
      { source: "/pdf-to-word", destination: "/tools/pdf-to-word", permanent: true },
      { source: "/word-to-pdf", destination: "/tools/word-to-pdf", permanent: true },
      { source: "/pdf-to-excel", destination: "/tools/pdf-to-excel", permanent: true },
      { source: "/excel-to-pdf", destination: "/tools/excel-to-pdf", permanent: true },
      { source: "/pdf-to-powerpoint", destination: "/tools/pdf-to-powerpoint", permanent: true },
      { source: "/powerpoint-to-pdf", destination: "/tools/powerpoint-to-pdf", permanent: true },
      { source: "/txt-to-pdf", destination: "/tools/txt-to-pdf", permanent: true },
      { source: "/csv-to-pdf", destination: "/tools/csv-to-pdf", permanent: true },
      { source: "/html-to-pdf", destination: "/tools/html-to-pdf", permanent: true },
      { source: "/scan-to-pdf", destination: "/tools/document-scanner", permanent: true },
      { source: "/tools/scan-to-pdf", destination: "/tools/document-scanner", permanent: true },
      { source: "/document-scanner", destination: "/tools/document-scanner", permanent: true },
      { source: "/photo-to-document", destination: "/tools/document-scanner", permanent: true },
      { source: "/tools/photo-to-document", destination: "/tools/document-scanner", permanent: true },
      { source: "/heic-to-jpg", destination: "/tools?category=image", permanent: true },
      { source: "/tools/heic-to-jpg", destination: "/tools?category=image", permanent: true },
      { source: "/svg-to-png", destination: "/tools?category=image", permanent: true },
      { source: "/tools/svg-to-png", destination: "/tools?category=image", permanent: true },
      { source: "/student/goals", destination: "/student", permanent: true },
      { source: "/student/certificates", destination: "/student", permanent: true },
      { source: "/student/assignments", destination: "/student", permanent: true },
      { source: "/student/notes", destination: "/student", permanent: true },
      { source: "/multiple-images-to-pdf", destination: "/tools/multiple-images-to-pdf", permanent: true },
      { source: "/organize-pdf", destination: "/tools/organize-pdf", permanent: true },
      { source: "/ocr-pdf", destination: "/tools/ocr-pdf", permanent: true },
      { source: "/ocr-image", destination: "/tools/ocr-image", permanent: true },
      { source: "/document-summary", destination: "/tools/document-summary", permanent: true },
      { source: "/document-qa", destination: "/tools/document-qa", permanent: true },
      { source: "/pdf-tools", destination: "/tools", permanent: true },
      { source: "/image-tools", destination: "/tools", permanent: true },
      { source: "/resume-builder", destination: "/student/resume", permanent: true },
      { source: "/ats-checker", destination: "/student/ats", permanent: true },
      { source: "/cover-letter", destination: "/student/cover-letter", permanent: true },
      { source: "/attendance-calculator", destination: "/student/attendance", permanent: true },
      { source: "/timetable", destination: "/student/timetable", permanent: true },
      { source: "/study-planner", destination: "/student/study-planner", permanent: true },
      {
        source: "/student-tools",
        destination: "/student",
        permanent: true,
      },
      {
        source: "/vtu",
        destination: "/student/sgpa-calculator",
        permanent: false,
      },
      {
        source: "/sgpa",
        destination: "/student/sgpa-calculator",
        permanent: false,
      },
      {
        source: "/cgpa",
        destination: "/student/cgpa-calculator",
        permanent: false,
      },
      {
        source: "/student/assignments",
        destination: "/student/assignment-planner",
        permanent: false,
      },
      {
        source: "/student/study",
        destination: "/student/study-planner",
        permanent: false,
      },
      {
        source: "/student/classes",
        destination: "/student/timetable",
        permanent: false,
      },
      {
        source: "/student/workspace",
        destination: "/student/dashboard",
        permanent: false,
      },
      {
        source: "/student/notifications",
        destination: "/student/settings/notifications",
        permanent: false,
      },
      {
        source: "/student/calculator",
        destination: "/student/sgpa-calculator",
        permanent: false,
      },
      {
        source: "/student/courses",
        destination: "/student",
        permanent: false,
      },
      {
        source: "/student/semesters",
        destination: "/student/cgpa-calculator",
        permanent: false,
      },
      {
        source: "/career/interviews",
        destination: "/student/applications",
        permanent: false,
      },
      {
        source: "/career/tracker",
        destination: "/student/applications",
        permanent: false,
      },
      {
        source: "/career/resumes",
        destination: "/student/resume",
        permanent: false,
      },
      {
        source: "/career/resumes/:path*",
        destination: "/student/resume",
        permanent: false,
      },
      {
        source: "/career/skills",
        destination: "/student/career",
        permanent: false,
      },
      {
        source: "/career/skills/:path*",
        destination: "/student/career",
        permanent: false,
      },
      {
        source: "/admin/audit",
        destination: "/admin/audit-logs",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
