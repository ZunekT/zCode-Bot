'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { TicketDetails } from '@/lib/api';
import { post } from '@/lib/client';
import { Icon } from './Icon';
import { useToast } from './Toast';
import { Modal } from './ui/Modal';

const CDN = /^https:\/\/(cdn|media)\.discordapp\.(com|net)\//;

export function TicketChat({ id, open, messages }: { id: number; open: boolean; messages: TicketDetails['messages'] }) {
  const router = useRouter();
  const toast = useToast();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState<'reply' | 'close' | null>(null);
  const [closing, setClosing] = useState(false);
  const [reason, setReason] = useState('');
  const chat = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chat.current?.scrollTo({ top: chat.current.scrollHeight });
  }, [messages.length]);

  // Odświeżanie rozmowy co 15 s, gdy karta jest widoczna.
  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => !document.hidden && router.refresh(), 15000);
    return () => clearInterval(t);
  }, [open, router]);

  async function send() {
    if (!text.trim()) return;
    setBusy('reply');
    const res = await post(`/api/admin/tickets/${id}/reply`, { content: text.trim() });
    setBusy(null);
    if (!res.ok) return toast.show(false, res.error ?? 'Nie udało się wysłać.');
    setText('');
    toast.show(true, 'Wysłano na kanał ticketu.');
    router.refresh();
  }

  async function close() {
    setBusy('close');
    const res = await post(`/api/admin/tickets/${id}/close`, { reason: reason.trim() || undefined });
    setBusy(null);
    if (!res.ok) return toast.show(false, res.error ?? 'Nie udało się zamknąć.');
    setClosing(false);
    toast.show(true, 'Ticket zamknięty – transkrypt zapisany, klient dostał prośbę o ocenę.');
    router.refresh();
  }

  return (
    <section className="card glow" style={{ display: 'flex', flexDirection: 'column', minHeight: 420 }}>
      <div className="card-head">
        <Icon name="discord" />
        <h2>Rozmowa</h2>
        <div className="spacer" />
        {open && (
          <button className="btn btn-sm btn-danger" onClick={() => setClosing(true)}>
            Zamknij ticket
          </button>
        )}
      </div>
      <div ref={chat} className="chat" style={{ flex: 1 }}>
        {messages.length === 0 && <div className="muted small" style={{ padding: 20, textAlign: 'center' }}>{open ? 'Brak wiadomości.' : 'Ticket zamknięty – rozmowa jest w transkrypcie.'}</div>}
        {messages.map((m) => (
          <div key={m.id} className={`msg${m.author.bot ? ' bot' : ''}`}>
            <img className="av" src={CDN.test(m.author.avatar) ? m.author.avatar : '/emojis/user.png'} alt="" width={36} height={36} loading="lazy" />
            <div style={{ minWidth: 0 }}>
              <div className="msg-name">
                {m.author.name}
                {m.author.bot && <span className="dc-app">APP</span>}
                <small>{new Date(m.createdAt).toLocaleString('pl-PL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</small>
              </div>
              {m.content && <div className="msg-text">{m.content.replace(/<a?:\w+:\d+>/g, '').replace(/<@!?(\d+)>/g, '@$1').replace(/<@&(\d+)>/g, '@rola').replace(/<t:(\d+)(:\w)?>/g, (_, s) => new Date(Number(s) * 1000).toLocaleString('pl-PL'))}</div>}
              {m.attachments.length > 0 && (
                <div className="msg-att">
                  {m.attachments.map((a) =>
                    a.image && CDN.test(a.url) ? (
                      <a key={a.url} href={a.url} target="_blank" rel="noreferrer">
                        <img src={a.url} alt={a.name} loading="lazy" />
                      </a>
                    ) : (
                      <a key={a.url} href={a.url} target="_blank" rel="noreferrer" className="btn btn-sm">
                        {a.name}
                      </a>
                    ),
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      {open && (
        <form
          className="reply-box"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <textarea
            className="input"
            placeholder="Odpowiedz klientowi… (Ctrl+Enter wysyła)"
            value={text}
            maxLength={3500}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) void send();
            }}
          />
          <button className={`btn btn-primary${busy === 'reply' ? ' loading' : ''}`} type="submit" disabled={!text.trim() || busy !== null}>
            Wyślij
          </button>
        </form>
      )}
      <Modal
        open={closing}
        onClose={() => setClosing(false)}
        title={`Zamknąć ticket #${id}?`}
        busy={busy === 'close'}
        actions={
          <>
            <button className="btn btn-ghost" onClick={() => setClosing(false)}>
              Anuluj
            </button>
            <button className={`btn btn-danger-solid${busy === 'close' ? ' loading' : ''}`} onClick={close}>
              Zamknij
            </button>
          </>
        }
      >
        <p>Bot zapisze transkrypt, przeniesie kanał do archiwum i poprosi klienta o ocenę.</p>
        <input className="input" style={{ marginTop: 14 }} placeholder="Powód (opcjonalnie)" value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} />
      </Modal>
    </section>
  );
}
