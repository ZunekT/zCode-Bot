'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { post } from '@/lib/client';
import { DEADLINES, SITE_BUDGETS, SITE_TYPES } from '@/lib/quote';
import { Icon } from '../Icon';

type Field = 'siteType' | 'budget' | 'deadline' | 'description' | 'name' | 'email' | 'consent' | 'website';

const EMAIL = /^[^\s@<>()[\]\\,;:"]{1,64}@[a-z0-9-]+(\.[a-z0-9-]+)+$/i;

export function QuoteForm({ pkg }: { pkg?: string }) {
  const [f, setF] = useState({
    siteType: '',
    budget: '',
    deadline: '',
    description: pkg ? `Interesuje mnie pakiet „${pkg}”.\n\n` : '',
    name: '',
    email: '',
    company: '',
    website: '',
    discord: '',
    consent: false,
    trap: '',
  });
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ name: string; email: string } | null>(null);
  const started = useRef(0);
  const top = useRef<HTMLDivElement>(null);

  useEffect(() => {
    started.current = Date.now();
  }, []);

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => {
    setF((x) => ({ ...x, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };

  function validate() {
    const e: Partial<Record<Field, string>> = {};
    if (!f.siteType) e.siteType = 'Wybierz rodzaj strony.';
    if (!f.budget) e.budget = 'Wybierz budżet.';
    if (!f.deadline) e.deadline = 'Wybierz termin.';
    if (f.description.trim().length < 20) e.description = 'Opisz projekt w kilku zdaniach (min. 20 znaków).';
    if (f.name.trim().length < 2) e.name = 'Podaj imię.';
    if (!EMAIL.test(f.email.trim())) e.email = 'Podaj poprawny adres e-mail.';
    if (f.website.trim() && !/^(https?:\/\/)?[^\s]+\.[^\s]+$/i.test(f.website.trim())) e.website = 'Podaj poprawny adres strony.';
    if (!f.consent) e.consent = 'Zaakceptuj politykę prywatności, żebyśmy mogli odpowiedzieć.';
    return e;
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    setError(null);
    const e = validate();
    setErrors(e);
    const first = Object.keys(e)[0];
    if (first) {
      document.getElementById(`q-${first}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setBusy(true);
    const res = await post<{ id: number }>('/api/wycena', {
      ...f,
      name: f.name.trim(),
      email: f.email.trim(),
      elapsed: Date.now() - started.current,
    });
    setBusy(false);
    if (!res.ok) return setError(res.error ?? 'Nie udało się wysłać. Spróbuj ponownie.');
    setDone({ name: f.name.trim(), email: f.email.trim() });
    top.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  if (done) {
    return (
      <div ref={top} className="quote-done tab-in">
        <span className="quote-check" aria-hidden>
          <svg viewBox="0 0 52 52" width="64" height="64">
            <circle cx="26" cy="26" r="24" fill="none" />
            <path d="M15 27l7 7 15-16" fill="none" />
          </svg>
        </span>
        <h2>Dziękujemy, {done.name}!</h2>
        <p>
          Zapytanie dotarło do nas. Przygotujemy bezpłatną wycenę i odezwiemy się na <b>{done.email}</b>.
        </p>
        <div className="final-actions">
          <Link href="/realizacje?typ=strony" className="ghost-btn">
            Zobacz nasze realizacje
          </Link>
          <Link href="/" className="ghost-btn">
            Strona główna
          </Link>
        </div>
      </div>
    );
  }

  const err = (k: Field) => errors[k] && <span className="q-error">{errors[k]}</span>;

  return (
    <div ref={top} className="quote">
      <form className="quote-form" onSubmit={submit} noValidate>
        <fieldset id="q-siteType" className={errors.siteType ? 'invalid' : undefined}>
          <legend>
            <span className="q-num">1</span> Co budujemy?
          </legend>
          <div className="q-types">
            {SITE_TYPES.map((t) => (
              <label key={t.value} className={`q-type${f.siteType === t.value ? ' on' : ''}`}>
                <input type="radio" name="siteType" value={t.value} checked={f.siteType === t.value} onChange={() => set('siteType', t.value)} />
                <Icon name={t.icon} size={24} />
                <b>{t.label}</b>
                <small>{t.hint}</small>
              </label>
            ))}
          </div>
          {err('siteType')}
        </fieldset>

        <fieldset id="q-budget" className={errors.budget ? 'invalid' : undefined}>
          <legend>
            <span className="q-num">2</span> Budżet
          </legend>
          <div className="q-chips">
            {SITE_BUDGETS.map((b) => (
              <label key={b.value} className={`q-chip${f.budget === b.value ? ' on' : ''}`}>
                <input type="radio" name="budget" value={b.value} checked={f.budget === b.value} onChange={() => set('budget', b.value)} />
                {b.label}
              </label>
            ))}
          </div>
          {err('budget')}
        </fieldset>

        <fieldset id="q-deadline" className={errors.deadline ? 'invalid' : undefined}>
          <legend>
            <span className="q-num">3</span> Termin
          </legend>
          <div className="q-chips">
            {DEADLINES.map((d) => (
              <label key={d.value} className={`q-chip${f.deadline === d.value ? ' on' : ''}`}>
                <input type="radio" name="deadline" value={d.value} checked={f.deadline === d.value} onChange={() => set('deadline', d.value)} />
                {d.label}
              </label>
            ))}
          </div>
          {err('deadline')}
        </fieldset>

        <fieldset className={errors.description ? 'invalid' : undefined}>
          <legend>
            <span className="q-num">4</span> Opisz projekt
          </legend>
          <textarea
            id="q-description"
            className="input"
            rows={6}
            maxLength={3000}
            placeholder="Czym zajmuje się firma, jakie podstrony i funkcje są potrzebne, strony, które Ci się podobają, czy masz już logo i domenę…"
            value={f.description}
            onChange={(e) => set('description', e.target.value)}
          />
          <div className="q-meta">
            {err('description') || <span />}
            <span className="faint small">{f.description.length}/3000</span>
          </div>
        </fieldset>

        <fieldset>
          <legend>
            <span className="q-num">5</span> Kontakt
          </legend>
          <div className="q-grid">
            <label className="q-field">
              <span>Imię *</span>
              <input id="q-name" className="input" autoComplete="given-name" maxLength={80} value={f.name} onChange={(e) => set('name', e.target.value)} />
              {err('name')}
            </label>
            <label className="q-field">
              <span>E-mail *</span>
              <input id="q-email" className="input" type="email" autoComplete="email" maxLength={120} value={f.email} onChange={(e) => set('email', e.target.value)} />
              {err('email')}
            </label>
            <label className="q-field">
              <span>Firma</span>
              <input className="input" autoComplete="organization" maxLength={80} value={f.company} onChange={(e) => set('company', e.target.value)} />
            </label>
            <label className="q-field">
              <span>Obecna strona</span>
              <input id="q-website" className="input" inputMode="url" placeholder="jeśli masz" maxLength={200} value={f.website} onChange={(e) => set('website', e.target.value)} />
              {err('website')}
            </label>
            <label className="q-field wide">
              <span>Nick na Discordzie</span>
              <input className="input" maxLength={40} placeholder="opcjonalnie – możemy pisać też tam" value={f.discord} onChange={(e) => set('discord', e.target.value)} />
            </label>
          </div>
          <div className="q-trap" aria-hidden>
            <label>
              Nie wypełniaj
              <input tabIndex={-1} autoComplete="off" value={f.trap} onChange={(e) => set('trap', e.target.value)} />
            </label>
          </div>
        </fieldset>

        <label id="q-consent" className={`q-consent${errors.consent ? ' invalid' : ''}`}>
          <input type="checkbox" checked={f.consent} onChange={(e) => set('consent', e.target.checked)} />
          <span>
            Akceptuję politykę prywatności – podane dane wykorzystamy wyłącznie do przygotowania wyceny i kontaktu w tej sprawie.{' '}
            <Link href="/polityka-prywatnosci" target="_blank">
              Polityka prywatności
            </Link>
          </span>
        </label>
        {err('consent')}

        {error && (
          <div className="notice notice-err" role="alert">
            <Icon name="shield_x" />
            <p>{error}</p>
          </div>
        )}

        <button type="submit" className={`cta-btn q-submit${busy ? ' loading' : ''}`} disabled={busy}>
          {busy ? 'Wysyłanie…' : 'Wyślij zapytanie'}
        </button>
      </form>

      <aside className="quote-side">
        <div className="panel-box">
          <h3>Co dalej?</h3>
          <ol className="q-next">
            <li>
              <b>Analizujemy zapytanie</b>
              <span>Jeśli czegoś brakuje, dopytamy mailowo.</span>
            </li>
            <li>
              <b>Dostajesz wycenę</b>
              <span>Zakres, cena i termin – bezpłatnie i bez zobowiązań.</span>
            </li>
            <li>
              <b>Startujemy</b>
              <span>Po akceptacji projektujemy, a postęp widzisz w panelu.</span>
            </li>
          </ol>
          <p className="faint small" style={{ marginTop: 16 }}>
            Wolisz napisać bezpośrednio? <a href="mailto:kontakt@zxcode.pl">kontakt@zxcode.pl</a>
          </p>
        </div>
      </aside>
    </div>
  );
}
