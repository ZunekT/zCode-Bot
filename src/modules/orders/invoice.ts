import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Invoice, Order } from '../../generated/prisma/client.js';
import { BRAND_NAME } from '../../config/constants.js';
import { formatMoney, formatOrderId } from '../../utils/format.js';

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const date = new Intl.DateTimeFormat('pl-PL', { dateStyle: 'long', timeZone: 'Europe/Warsaw' });

let bannerData: string | null = null;
function banner(): string {
  if (bannerData === null) {
    try {
      const file = readFileSync(path.resolve(process.cwd(), 'assets', 'branding', 'banner-panel.jpg'));
      bannerData = `data:image/jpeg;base64,${file.toString('base64')}`;
    } catch {
      bannerData = '';
    }
  }
  return bannerData;
}

export const invoiceFileName = (invoice: Pick<Invoice, 'number'>) =>
  `proforma-${invoice.number.replace(/\//g, '-')}.html`;

/** Faktura proforma jako samodzielny plik HTML (można wydrukować lub zapisać jako PDF). */
export function renderInvoice(
  invoice: Invoice,
  order: Order,
  opts: { clientName: string; paymentDetails: string | null; totalPrice: number | null; paidBefore: number },
): Buffer {
  const amount = Number(invoice.amount);
  const transferTitle = `${formatOrderId(order.id)} ${invoice.number}`;
  const html = `<!doctype html>
<html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Proforma ${esc(invoice.number)} – ${BRAND_NAME}</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#eef1f5;font:15px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#1d2330;overflow-wrap:anywhere}
.page{max-width:820px;margin:24px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)}
.banner{display:block;width:100%;background:#05070b}
.body{padding:28px 32px}
h1{margin:0;font-size:26px}h1 span{color:#1a9fff}
.meta{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin:20px 0}
.box{background:#f5f8fc;border:1px solid #e1e8f2;border-radius:8px;padding:12px 14px}
.box b{display:block;font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:#6b7891;margin-bottom:4px}
table{width:100%;border-collapse:collapse;margin:16px 0}th,td{text-align:left;padding:10px;border-bottom:1px solid #e1e8f2}
th{font-size:12px;text-transform:uppercase;color:#6b7891}td.num,th.num{text-align:right;white-space:nowrap}
.total{display:flex;justify-content:flex-end;gap:24px;font-size:20px;font-weight:700;margin-top:4px}.total span{color:#1a9fff}
pre{white-space:pre-wrap;font:14px/1.5 ui-monospace,Consolas,monospace;background:#0b0f17;color:#e3ecf7;padding:14px;border-radius:8px;margin:8px 0 0}
.title{font-size:16px;font-weight:700;background:#fff7e6;border:1px dashed #f0b44c;border-radius:8px;padding:10px 14px;margin-top:12px}
.note{color:#6b7891;font-size:13px;margin-top:24px}
@media print{body{background:#fff}.page{box-shadow:none;margin:0}}
</style></head><body><div class="page">
${banner() ? `<img class="banner" src="${banner()}" alt="${BRAND_NAME}">` : ''}
<div class="body">
<h1>Faktura <span>proforma</span> ${esc(invoice.number)}</h1>
<div class="meta">
  <div class="box"><b>Sprzedawca</b>${BRAND_NAME}<br>Programowanie botów Discord</div>
  <div class="box"><b>Nabywca</b>${esc(opts.clientName)}<br><small>Discord ID: ${esc(order.userId)}</small></div>
  <div class="box"><b>Data wystawienia</b>${date.format(invoice.issuedAt)}</div>
  <div class="box"><b>Termin płatności</b><strong>${date.format(invoice.dueDate)}</strong></div>
</div>
<table>
  <thead><tr><th>Lp.</th><th>Nazwa usługi</th><th class="num">Kwota</th></tr></thead>
  <tbody>
    <tr><td>1</td><td>${esc(order.title)}<br><small>Zlecenie ${formatOrderId(order.id)}${opts.totalPrice !== null ? ` • wartość zlecenia ${formatMoney(opts.totalPrice, invoice.currency)}` : ''}${opts.paidBefore > 0 ? ` • wpłacono dotąd ${formatMoney(opts.paidBefore, invoice.currency)}` : ''}</small></td><td class="num">${formatMoney(amount, invoice.currency)}</td></tr>
  </tbody>
</table>
<div class="total">Do zapłaty: <span>${formatMoney(amount, invoice.currency)}</span></div>
<h3>Dane do przelewu</h3>
${opts.paymentDetails ? `<pre>${esc(opts.paymentDetails)}</pre>` : '<p>Dane do przelewu przekaże obsługa w tickecie.</p>'}
<div class="title">Tytuł przelewu: ${esc(transferTitle)}</div>
<p class="note">Dokument proforma nie jest fakturą VAT ani dowodem księgowym. Po zaksięgowaniu wpłaty status zlecenia zmieni się automatycznie, a Ty dostaniesz powiadomienie na Discordzie.</p>
</div></div></body></html>`;
  return Buffer.from(html, 'utf8');
}
