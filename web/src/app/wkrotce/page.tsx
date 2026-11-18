import type { Metadata } from 'next';
import './wkrotce.css';

export const metadata: Metadata = {
  title: 'Start wkrótce',
  robots: { index: false, follow: false },
};

export default function ComingSoon() {
  return (
    <main className="soon">
      <div className="soon-glow" aria-hidden />
      <div className="soon-grid" aria-hidden />
      <div className="soon-inner">
        <img src="/emojis/logo_round.png" alt="zxCode" width={84} height={84} className="soon-logo" />
        <h1>
          Start <span>wkrótce</span>
        </h1>
      </div>
    </main>
  );
}
