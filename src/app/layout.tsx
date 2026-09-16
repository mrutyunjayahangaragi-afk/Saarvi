import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { AuthProvider } from "@/context/AuthContext";
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

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://saarvi-beta.vercel.app";
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
                  // Enforce clean white light-first experience by default
                  document.documentElement.classList.remove('dark');
                } catch (e) {}
              })();
            `
          }}
        />
      </head>
      <body className="min-h-full flex flex-col transition-colors duration-200">
        <ThemeProvider>
          <AuthProvider>
            <AdvertisementGate />
            {children}
            <GlobalAIAssistant />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
