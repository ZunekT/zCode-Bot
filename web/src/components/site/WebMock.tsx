import { Icon } from '../Icon';

export function WebMock({ url = 'twojafirma.pl', compact = false }: { url?: string; compact?: boolean }) {
  return (
    <div className={`browser wm${compact ? ' wm-compact' : ''}`} aria-hidden>
      <div className="browser-bar">
        <i />
        <i />
        <i />
        <div className="browser-url">
          <span className="wm-lock" />
          {url}
        </div>
      </div>
      <div className="wm-page">
        <div className="wm-nav">
          <span className="wm-logo" />
          <span className="wm-links">
            <i />
            <i />
            <i />
          </span>
          <span className="wm-btn sm" />
        </div>
        <div className="wm-hero">
          <div className="wm-copy">
            <span className="wm-pill" />
            <span className="wm-h big" />
            <span className="wm-h grad" />
            <span className="wm-p" />
            <span className="wm-p short" />
            <span className="wm-actions">
              <span className="wm-btn" />
              <span className="wm-btn ghost" />
            </span>
          </div>
          <div className="wm-art">
            <span className="wm-orb" />
            <span className="wm-card c1" />
            <span className="wm-card c2" />
          </div>
        </div>
        <div className="wm-features">
          {[0, 1, 2].map((i) => (
            <span key={i} className="wm-feature" style={{ '--i': i } as React.CSSProperties}>
              <i />
              <b />
              <em />
            </span>
          ))}
        </div>
      </div>
      <div className="wm-score">
        <svg viewBox="0 0 36 36" width="44" height="44">
          <circle cx="18" cy="18" r="15.5" fill="none" stroke="rgba(46,204,143,.18)" strokeWidth="3" />
          <circle
            className="wm-score-ring"
            cx="18"
            cy="18"
            r="15.5"
            fill="none"
            stroke="#2ecc8f"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray="97.4"
            transform="rotate(-90 18 18)"
          />
        </svg>
        <span>
          <b>100</b>
          <small>PageSpeed</small>
        </span>
      </div>
    </div>
  );
}

export function BotMock() {
  const options = [
    ['cart', 'Zamówienie bota', 'Chcesz zamówić bota lub nową funkcję'],
    ['laptop', 'Zamówienie strony', 'Strona firmowa, landing, sklep'],
    ['support', 'Wsparcie techniczne', 'Problem z botem lub stroną'],
    ['idea', 'Pytanie', 'Ceny, terminy, możliwości'],
  ];
  return (
    <div className="dc dc-mini" aria-hidden>
      <div className="dc-top">
        <span className="hash">#</span> tickety
        <span className="dc-online">
          <span className="live-dot" /> online
        </span>
      </div>
      <div className="dc-body">
        <div className="dc-msg">
          <img className="dc-avatar" src="/emojis/logo_round.png" alt="" width={40} height={40} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="dc-name">
              zxCode <span className="dc-app">APP</span>
            </div>
            <div className="dc-card">
              <h4>
                <Icon name="ticket" size={20} /> Centrum pomocy
              </h4>
              <div style={{ color: '#b5bac1' }}>Wybierz kategorię – otworzymy prywatny kanał.</div>
              <div className="dc-select">
                Wybierz kategorię…
                <svg width="12" height="12" viewBox="0 0 16 16">
                  <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </div>
              <div className="dc-options">
                {options.map(([icon, label, hint], i) => (
                  <div key={label} className={`dc-option${i === 1 ? ' on' : ''}`}>
                    <Icon name={icon!} size={20} />
                    <span>
                      <b>{label}</b>
                      <small>{hint}</small>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
