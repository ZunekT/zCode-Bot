import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'zxCode – programowanie botów Discord', template: '%s · zxCode' },
  description: 'Boty Discord na zamówienie. Panel do zarządzania botem, monitoring i hosting.',
  icons: { icon: '/emojis/logo_round.png' },
};

export const viewport: Viewport = { themeColor: '#06080c' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl">
      <body>{children}</body>
    </html>
  );
}
