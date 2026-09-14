import type { NextConfig } from "next";

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
