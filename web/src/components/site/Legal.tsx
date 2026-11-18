import type { ReactNode } from 'react';
import { company, isPlaceholder } from '@/lib/company';
import { PageHero } from './Sections';

/** Dana firmy; brakująca (placeholder) wyróżniona na żółto, żeby było widać, co uzupełnić. */
export function C({ k }: { k: keyof typeof company }) {
  const v = company[k];
  if (!v) return <span className="missing">[{k}]</span>;
  return isPlaceholder(v) ? <span className="missing">{v}</span> : <>{v}</>;
}

export function Mail() {
  return isPlaceholder(company.email) ? <C k="email" /> : <a href={`mailto:${company.email}`}>{company.email}</a>;
}

export interface LegalSection {
  id: string;
  title: string;
  body: ReactNode;
}

export function LegalPage({ kicker, title, lead, sections }: { kicker: string; title: string; lead: string; sections: LegalSection[] }) {
  return (
    <>
      <PageHero kicker={kicker} title={title} lead={lead} />
      <div className="wrap legal">
        <nav className="legal-toc" aria-label="Spis treści">
          <b>Spis treści</b>
          {sections.map((s, i) => (
            <a key={s.id} href={`#${s.id}`}>
              {i + 1}. {s.title}
            </a>
          ))}
        </nav>
        <article className="prose">
          <p className="legal-meta">Obowiązuje od {company.documentsDate}.</p>
          {sections.map((s, i) => (
            <section key={s.id}>
              <h2 id={s.id}>
                {i + 1}. {s.title}
              </h2>
              {s.body}
            </section>
          ))}
        </article>
      </div>
    </>
  );
}
