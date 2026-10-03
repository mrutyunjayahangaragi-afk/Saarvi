import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { AuthProvider } from "@/context/AuthContext";
import { PlatformProvider } from "@/context/PlatformContext";
import AdvertisementGate from "@/components/advertising/AdvertisementGate";
import GlobalAIAssistant from "@/components/ai/GlobalAIAssistant";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#2563eb"
};

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://saarvi.app";
const googleVerification = process.env.GOOGLE_SITE_VERIFICATION?.trim();

export const metadata: Metadata = {
  // Configured dynamically for production (legacy reference: metadataBase: new URL("https://saarvi.app"))
  metadataBase: new URL(siteUrl),
  title: {
    default: "Saarvi — Study. Work. Grow.",
    template: "%s — Saarvi",
  },
  description:
    "Convert, compress and manage documents with simple tools designed for students and everyday users.",
  applicationName: "Saarvi",
  alternates: {
    canonical: siteUrl,
  },
  verification: googleVerification
    ? {
        google: googleVerification,
      }
    : undefined,
  keywords: ["saarvi", "pdf tools", "image converter", "student tools", "compress pdf", "merge pdf", "id photo", "resume builder"],
  authors: [{ name: "Saarvi Team" }],
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/brand/saarvi-mark.png", type: "image/png", sizes: "512x512" },
    ],
    shortcut: [
      { url: "/favicon.ico" },
    ],
    apple: [
      { url: "/brand/saarvi-mark.png", sizes: "180x180", type: "image/png" },
    ],
  },
  openGraph: {
    title: "Saarvi — Study. Work. Grow.",
    description: "Convert, compress and manage documents with simple tools designed for students and everyday users.",
    siteName: "Saarvi",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Saarvi — Study. Work. Grow.",
      },
    ],
  },
};

import { FeedbackProvider } from "@/context/FeedbackContext";
import FeedbackModal from "@/components/feedback/FeedbackModal";
import SmartResultBanner from "@/components/ux/SmartResultBanner";

import MobileBottomNav from "@/components/layout/MobileBottomNav";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var isPathAdmin = window.location.pathname.indexOf('/admin') === 0;
                  if (isPathAdmin) {
                    document.documentElement.classList.remove('dark');
                    document.documentElement.classList.add('light');
                    document.documentElement.setAttribute('data-theme', 'light');
                    document.documentElement.style.colorScheme = 'light';
                    return;
                  }
                  var stored = localStorage.getItem('doc_ease_theme');
                  var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
                  var isDark = stored === 'dark' || ((!stored || stored === 'system') && prefersDark);
                  if (isDark) {
                    document.documentElement.classList.add('dark');
                    document.documentElement.classList.remove('light');
                    document.documentElement.setAttribute('data-theme', 'dark');
                    document.documentElement.style.colorScheme = 'dark';
                  } else {
                    document.documentElement.classList.remove('dark');
                    document.documentElement.classList.add('light');
                    document.documentElement.setAttribute('data-theme', 'light');
                    document.documentElement.style.colorScheme = 'light';
                  }
                } catch (e) {}
              })();
            `
          }}
        />
      </head>
      <body className="min-h-full flex flex-col transition-colors duration-200 pb-16 md:pb-0">
        <ThemeProvider>
          <PlatformProvider>
            <AuthProvider>
              <FeedbackProvider>
                <AdvertisementGate />
                {children}
                <FeedbackModal />
                <SmartResultBanner />
                <GlobalAIAssistant />
                <MobileBottomNav />
              </FeedbackProvider>
            </AuthProvider>
          </PlatformProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

