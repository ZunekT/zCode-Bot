import type { Metadata, Viewport } from 'next';
import { GeistMono } from 'geist/font/mono';
import { GeistSans } from 'geist/font/sans';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'zxCode – programowanie botów Discord', template: '%s · zxCode' },
  description:
    'Boty Discord na zamówienie: tickety, ekonomia, RP, moderacja i integracje. Panel ustawień, monitoring 24/7 i opieka po wdrożeniu.',
  openGraph: { title: 'zxCode – programowanie botów Discord', images: ['/branding/banner.png'], locale: 'pl_PL', type: 'website' },
  icons: { icon: '/emojis/logo_round.png' },
};

export const viewport: Viewport = { themeColor: '#06080c' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
