import { ComponentType, type Collection, type Message, type Snowflake, type TextChannel } from 'discord.js';
import type { Ticket } from '../../../generated/prisma/client.js';
import { BRAND_NAME } from '../../../config/constants.js';
import { CATEGORIES, LIMITS, PRIORITIES } from '../constants.js';
import { answersOf } from '../forms.js';
import { padNumber } from '../../../utils/format.js';

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const dateFmt = new Intl.DateTimeFormat('pl-PL', {
  dateStyle: 'short',
  timeStyle: 'medium',
  timeZone: 'Europe/Warsaw',
});

/** Bardzo prosty markdown Discorda -> HTML (po escapowaniu). */
function markdown(raw: string, message: Message): string {
  let s = esc(raw);
  s = s.replace(/```(?:\w+)?\n?([\s\S]*?)```/g, (_m, code: string) => `<pre>${code}</pre>`);
  s = s.replace(/`([^`\n]+)`/g, '<code>$1</code>');
  s = s.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  s = s.replace(/__(.+?)__/g, '<u>$1</u>');
  s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<i>$2</i>');
  s = s.replace(/~~(.+?)~~/g, '<s>$1</s>');
  s = s.replace(/^-# (.*)$/gm, '<small>$1</small>');
  s = s.replace(/^#{1,3} (.*)$/gm, '<b class="h">$1</b>');
  s = s.replace(/^(?:&gt;){3} ([\s\S]*)$/m, '<blockquote>$1</blockquote>');
  s = s.replace(/^&gt; (.*)$/gm, '<blockquote>$1</blockquote>');
  s = s.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
  // Wzmianki i emotki
  s = s.replace(/&lt;@!?(\d+)&gt;/g, (_m, id: string) => {
    const u = message.mentions.users.get(id);
    return `<span class="mention">@${esc(u?.displayName ?? u?.username ?? id)}</span>`;
  });
  s = s.replace(/&lt;@&amp;(\d+)&gt;/g, (_m, id: string) => {
    const r = message.guild?.roles.cache.get(id);
    return `<span class="mention">@${esc(r?.name ?? id)}</span>`;
  });
  s = s.replace(/&lt;#(\d+)&gt;/g, (_m, id: string) => {
    const c = message.guild?.channels.cache.get(id);
    return `<span class="mention">#${esc(c?.name ?? id)}</span>`;
  });
  s = s.replace(/&lt;t:(\d+)(?::\w)?&gt;/g, (_m, ts: string) => dateFmt.format(new Date(Number(ts) * 1000)));
  s = s.replace(
    /&lt;(a?):(\w+):(\d+)&gt;/g,
    (_m, a: string, name: string, id: string) =>
      `<img class="emoji" alt=":${name}:" src="https://cdn.discordapp.com/emojis/${id}.${a ? 'gif' : 'png'}?size=32">`,
  );
  return s.replace(/\n/g, '<br>');
}

/** Spłaszcza Components v2 (Container, Section, TextDisplay…) do HTML. */
function componentsHtml(nodes: unknown[], message: Message): string {
  let out = '';
  for (const node of nodes as { type: number; [k: string]: unknown }[]) {
    switch (node.type) {
      case ComponentType.Container:
        out += `<div class="container">${componentsHtml((node.components as unknown[]) ?? [], message)}</div>`;
        break;
      case ComponentType.Section:
        out += `<div class="section">${componentsHtml((node.components as unknown[]) ?? [], message)}</div>`;
        break;
      case ComponentType.TextDisplay:
        out += `<div>${markdown(String(node.content ?? ''), message)}</div>`;
        break;
      case ComponentType.Separator:
        out += node.divider === false ? '<div class="gap"></div>' : '<hr>';
        break;
      case ComponentType.MediaGallery:
        for (const item of (node.items as { media: { url: string } }[]) ?? []) {
          if (!item.media.url.startsWith('attachment://'))
            out += `<img class="media" src="${esc(item.media.url)}">`;
        }
        break;
      case ComponentType.ActionRow: {
        const labels = ((node.components as { label?: string }[]) ?? []).map((c) => c.label).filter(Boolean);
        if (labels.length)
          out += `<div class="buttons">${labels.map((l) => `<span>${esc(l!)}</span>`).join('')}</div>`;
        break;
      }
    }
  }
  return out;
}

function messageHtml(m: Message): string {
  const author = m.member?.displayName ?? m.author.displayName ?? m.author.username;
  const avatar = m.author.displayAvatarURL({ size: 64, extension: 'png' });
  let body = m.content ? `<div>${markdown(m.content, m)}</div>` : '';

  for (const embed of m.embeds) {
    body += `<div class="container">${embed.title ? `<b>${esc(embed.title)}</b><br>` : ''}${
      embed.description ? markdown(embed.description, m) : ''
    }</div>`;
  }
  if (m.components.length)
    body += componentsHtml(
      m.components.map((c) => c.toJSON()),
      m,
    );

  for (const a of m.attachments.values()) {
    body += a.contentType?.startsWith('image/')
      ? `<a href="${esc(a.url)}" target="_blank"><img class="media" src="${esc(a.url)}" alt="${esc(a.name)}"></a>`
      : `<div class="file">Plik: <a href="${esc(a.url)}" target="_blank">${esc(a.name)}</a> (${Math.ceil(a.size / 1024)} KB)</div>`;
  }

  return `<div class="msg">
  <img class="avatar" src="${esc(avatar)}" alt="">
  <div class="content">
    <div class="meta"><b>${esc(author)}</b>${m.author.bot ? '<span class="bot">BOT</span>' : ''}<span class="time">${dateFmt.format(m.createdAt)}</span></div>
    ${body || '<i class="muted">(pusta wiadomość)</i>'}
  </div>
</div>`;
}

/** Pobiera całą historię kanału (od najstarszych). */
export async function fetchAllMessages(channel: TextChannel): Promise<Message[]> {
  const all: Message[] = [];
  let before: Snowflake | undefined;
  while (all.length < LIMITS.transcriptMessages) {
    const batch: Collection<Snowflake, Message> = await channel.messages.fetch({ limit: 100, before });
    if (batch.size === 0) break;
    all.push(...batch.values());
    before = batch.last()?.id;
    if (batch.size < 100) break;
  }
  return all.reverse();
}

export function renderTranscript(
  ticket: Ticket,
  channel: Pick<TextChannel, 'name'>,
  messages: Message[],
  ownerName?: string,
): Buffer {
  const def = CATEGORIES[ticket.category];
  const answers = answersOf(ticket.formData)
    .map((a) => `<dt>${esc(a.label)}</dt><dd>${esc(a.value).replace(/\n/g, '<br>')}</dd>`)
    .join('');
  const participants = new Map<string, number>();
  for (const m of messages)
    if (!m.author.bot) participants.set(m.author.username, (participants.get(m.author.username) ?? 0) + 1);

  const html = `<!doctype html>
<html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Ticket #${padNumber(ticket.id)} – ${BRAND_NAME}</title>
<style>
:root{--bg:#0b0d12;--card:#141821;--line:#232a36;--text:#dbdee1;--muted:#8a94a6;--brand:#1a9fff}
*{box-sizing:border-box}body{margin:0;overflow-wrap:anywhere;background:var(--bg);color:var(--text);font:15px/1.45 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
header{padding:24px 16px;border-bottom:1px solid var(--line);background:linear-gradient(135deg,#0b0d12 60%,#0a2a45)}
header h1{margin:0 0 8px;font-size:22px}header h1 span{color:var(--brand)}
.wrap{max-width:900px;margin:0 auto;padding:0 16px}
.info{display:flex;flex-wrap:wrap;gap:8px 20px;color:var(--muted);font-size:14px}
dl{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:12px 16px;margin:16px 0}
dt{font-weight:600;color:var(--brand);margin-top:8px}dd{margin:2px 0 0;overflow-wrap:anywhere}
.msg{display:flex;gap:12px;padding:10px 0;border-bottom:1px solid #151a23}
.avatar{width:40px;height:40px;border-radius:50%;flex:none}.content{min-width:0;flex:1;overflow-wrap:anywhere}
.meta{margin-bottom:2px}.time{color:var(--muted);font-size:12px;margin-left:8px}
.bot{background:var(--brand);color:#fff;font-size:10px;padding:1px 4px;border-radius:3px;margin-left:6px}
.container{border-left:4px solid var(--brand);background:var(--card);border-radius:6px;padding:8px 12px;margin:6px 0}
.section{display:block}hr{border:0;border-top:1px solid var(--line);margin:8px 0}.gap{height:8px}
.buttons span{display:inline-block;background:#2b2f3a;border-radius:4px;padding:2px 10px;margin:4px 6px 0 0;font-size:13px}
.media{max-width:100%;max-height:320px;border-radius:6px;margin-top:6px;display:block}
.emoji{width:20px;height:20px;vertical-align:-4px}
code,pre{background:#0d1017;border:1px solid var(--line);border-radius:4px;padding:1px 4px;font:13px ui-monospace,monospace}
pre{padding:8px;white-space:pre-wrap}blockquote{margin:2px 0;padding-left:10px;border-left:3px solid #4e5058}
.mention{background:rgba(26,159,255,.15);color:#7cc4ff;border-radius:3px;padding:0 2px}
small,.muted{color:var(--muted)}a{color:#4fb5ff}.h{font-size:16px}
footer{color:var(--muted);text-align:center;padding:24px 16px;font-size:13px}
</style></head><body>
<header><div class="wrap">
<h1><span>${BRAND_NAME}</span> • Ticket #${padNumber(ticket.id)} – ${esc(def.label)}</h1>
<div class="info">
<span>Kanał: #${esc(channel.name)}</span>
<span>Klient: ${ownerName ? `${esc(ownerName)} (${esc(ticket.userId)})` : esc(ticket.userId)}</span>
<span>Priorytet: ${PRIORITIES[ticket.priority].label}</span>
<span>Otwarty: ${dateFmt.format(ticket.openedAt)}</span>
${ticket.closedAt ? `<span>Zamknięty: ${dateFmt.format(ticket.closedAt)}</span>` : ''}
<span>Wiadomości: ${messages.length}</span>
</div></div></header>
<main class="wrap">
${answers ? `<dl>${answers}</dl>` : ''}
${messages.map(messageHtml).join('\n')}
</main>
<footer>Uczestnicy: ${[...participants].map(([n, c]) => `${esc(n)} (${c})`).join(', ') || 'brak'}<br>
Wygenerowano ${dateFmt.format(new Date())} • ${BRAND_NAME} Bot</footer>
</body></html>`;

  return Buffer.from(html, 'utf8');
}
