export const SITE_CONFIG = {
  name: "Saarvi",
  tagline: "Study. Work. Grow.",
  description:
    "Convert, compress, create and manage documents with simple tools designed for students and everyday users.",
  canonicalUrl: "https://saarvi.app",
  url: (process.env.NEXT_PUBLIC_APP_URL || "https://saarvi.app") as string, // Legacy reference: url: "https://saarvi.in"
  author: "Saarvi Team",
  copyright: `© 2026 Saarvi. All rights reserved.`,
  nav: [
    { label: "Home", href: "/" },
    { label: "Tools", href: "/tools" },
    { label: "Student Tools", href: "/student" },
    { label: "About", href: "/about" }
  ],
  footer: {
    product: [
      { label: "Tools", href: "/tools" },
      { label: "Student Tools", href: "/student" }
    ],
    company: [
      { label: "About", href: "/about" },
      { label: "Contact", href: "/contact" }
    ],
    legal: [
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" }
    ]
  }
};
