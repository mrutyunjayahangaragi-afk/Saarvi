import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Saarvi — Study. Work. Grow.',
    short_name: 'Saarvi',
    description: 'Convert, compress, and manage documents with simple, private tools designed for students and professionals.',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#2563eb',
    icons: [
      {
        src: '/favicon.ico',
        sizes: 'any',
        type: 'image/x-icon',
      },
      {
        src: '/favicon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
      },
      {
        src: '/brand/favicon.png',
        sizes: '256x256',
        type: 'image/png',
      },
      {
        src: '/brand/saarvi-mark.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  };
}
