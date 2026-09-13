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

export const metadata: Metadata = {
  title: "Saarvi — Study. Work. Grow.",
  description:
    "Convert, compress and manage documents with simple tools designed for students and everyday users.",
  applicationName: "Saarvi",
  keywords: ["saarvi", "pdf tools", "image converter", "student tools", "compress pdf", "merge pdf", "id photo", "resume builder"],
  authors: [{ name: "Saarvi Team" }],
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/brand/saarvi-mark.png", type: "image/png" },
    ],
    apple: [
      { url: "/brand/saarvi-mark.png" },
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
