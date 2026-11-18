'use client';

import { Icon } from '@/components/Icon';

export default function PanelError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="card empty">
      <Icon name="shield_x" size={56} />
      <h2>Coś poszło nie tak</h2>
      <p>{error.message?.includes('niedostępny') ? error.message : 'Nie udało się wczytać danych. Spróbuj ponownie za chwilę.'}</p>
      <button className="btn btn-primary" onClick={reset}>
        Spróbuj ponownie
      </button>
    </div>
  );
}
