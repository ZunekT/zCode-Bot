'use client';

import { useRef, useState } from 'react';
import { renderRichText } from '@/lib/richtext';

const TOOLS: { label: string; title: string; wrap?: [string, string]; line?: string }[] = [
  { label: 'B', title: 'Pogrubienie', wrap: ['**', '**'] },
  { label: 'I', title: 'Kursywa', wrap: ['*', '*'] },
  { label: 'H', title: 'Nagłówek', line: '## ' },
  { label: '•', title: 'Lista', line: '- ' },
  { label: '1.', title: 'Lista numerowana', line: '1. ' },
  { label: 'Link', title: 'Link', wrap: ['[', '](https://)'] },
];

export function RichTextInput({ id, value, onChange, maxLength }: { id: string; value: string; onChange: (v: string) => void; maxLength?: number }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [preview, setPreview] = useState(false);

  function apply(t: (typeof TOOLS)[number]) {
    const el = ref.current;
    if (!el) return;
    const { selectionStart: a, selectionEnd: b } = el;
    let next = value;
    let caret = b;
    if (t.wrap) {
      const sel = value.slice(a, b) || (t.label === 'Link' ? 'tekst linku' : 'tekst');
      next = value.slice(0, a) + t.wrap[0] + sel + t.wrap[1] + value.slice(b);
      caret = a + t.wrap[0].length + sel.length + (t.label === 'Link' ? t.wrap[1].length - 1 : t.wrap[1].length);
    } else if (t.line) {
      const start = value.lastIndexOf('\n', a - 1) + 1;
      next = value.slice(0, start) + t.line + value.slice(start);
      caret = b + t.line.length;
    }
    if (maxLength && next.length > maxLength) return;
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(caret, caret);
    });
  }

  return (
    <div className="rte">
      <div className="rte-bar" role="toolbar" aria-label="Formatowanie">
        {TOOLS.map((t) => (
          <button key={t.label} type="button" className={`rte-btn rte-${t.label === 'B' ? 'b' : t.label === 'I' ? 'i' : 'x'}`} title={t.title} aria-label={t.title} disabled={preview} onClick={() => apply(t)}>
            {t.label}
          </button>
        ))}
        <span className="grow" />
        <button type="button" className={`rte-btn rte-toggle${preview ? ' on' : ''}`} onClick={() => setPreview((p) => !p)}>
          {preview ? 'Edytuj' : 'Podgląd'}
        </button>
      </div>
      {preview ? (
        <div className="rte-preview rich" dangerouslySetInnerHTML={{ __html: renderRichText(value) || '<p class="faint">Pusto</p>' }} />
      ) : (
        <textarea
          id={id}
          ref={ref}
          className="input rte-area"
          rows={Math.min(16, Math.max(5, value.split('\n').length + 1))}
          maxLength={maxLength}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}
