# zxcode-cms

Treść strony internetowej edytowana w panelu **zxcode.pl**. W kodzie strony opisujesz, co klient może zmieniać (teksty, zdjęcia, cennik, FAQ, galerie, godziny otwarcia), a klient edytuje to sam w panelu w zakładce „Moje strony”. Po zapisie strona odświeża się od razu.

- działa z Next.js (App Router), ale też z każdym frameworkiem na Node.js 18+,
- zero zależności,
- gdy panel jest niedostępny, strona pokazuje ostatnią pobraną albo domyślną treść,
- typy TypeScript wynikają z opisu sekcji, więc edytor podpowiada pola.

## Instalacja

```bash
npm install zxcode-cms
```

W `.env` strony (klucz dostajesz od zxCode, komenda `/cms dodaj`). **Tylko po stronie serwera** – nigdy z prefiksem `NEXT_PUBLIC_`:

```ini
ZXCODE_SITE_KEY=zxs_12_...
ZXCODE_URL=https://bot.zxcode.pl
```

## Użycie (Next.js)

`lib/cms.ts`:

```ts
import { createSite, field } from 'zxcode-cms';

export const site = createSite({
  webhookUrl: 'https://twojafirma.pl/api/zxcode',
  sections: {
    baner: {
      label: 'Baner na stronie głównej',
      fields: {
        tytul: field.text({ label: 'Tytuł', default: 'Studio fotograficzne w Krakowie', maxLength: 80 }),
        opis: field.textarea({ label: 'Opis', default: 'Sesje rodzinne, biznesowe i ślubne.' }),
        zdjecie: field.image({ label: 'Zdjęcie w tle' }),
        przycisk: field.url({ label: 'Link przycisku', default: '/kontakt' }),
      },
    },
    cennik: {
      label: 'Cennik',
      fields: {
        pozycje: field.list({
          label: 'Usługi',
          max: 30,
          fields: {
            nazwa: field.text({ label: 'Nazwa', required: true }),
            cena: field.number({ label: 'Cena (zł)', min: 0 }),
            polecana: field.toggle({ label: 'Wyróżnij' }),
          },
        }),
      },
    },
    kontakt: {
      label: 'Kontakt',
      fields: {
        telefon: field.text({ label: 'Telefon' }),
        godziny: field.textarea({ label: 'Godziny otwarcia', default: 'pn–pt 9:00–17:00' }),
      },
    },
  },
});
```

Na stronie (komponent serwerowy):

```tsx
import { site } from '@/lib/cms';

export default async function Home() {
  const { baner, cennik } = await site.content();
  return (
    <>
      <h1>{baner.tytul}</h1>
      <p>{baner.opis}</p>
      {baner.zdjecie && <img src={baner.zdjecie.url} alt={baner.zdjecie.alt} width={baner.zdjecie.width ?? undefined} height={baner.zdjecie.height ?? undefined} />}
      <ul>
        {cennik.pozycje.map((p) => (
          <li key={p.nazwa}>{p.nazwa} – {p.cena} zł</li>
        ))}
      </ul>
    </>
  );
}
```

Natychmiastowe odświeżanie po zapisie w panelu – `app/api/zxcode/route.ts`:

```ts
import { revalidateTag } from 'next/cache';
import { site } from '@/lib/cms';

export const POST = site.webhook(() => revalidateTag(site.tag, { expire: 0 }));
```

Bez webhooka strona odświeży treść sama co `revalidate` sekund (domyślnie 300).

Dla `next/image` dodaj domenę zdjęć do `next.config`:

```ts
images: { remotePatterns: [{ protocol: 'https', hostname: 'bot.zxcode.pl', pathname: '/cms/v1/assets/**' }] }
```

## Typy pól

| Pole | Wartość na stronie | Opcje |
|---|---|---|
| `field.text()` | tekst w jednej linii | `maxLength` (do 500) |
| `field.textarea()` | dłuższy tekst | `maxLength` (do 20 000) |
| `field.number()` | liczba albo `null` | `min`, `max`, `integer` |
| `field.toggle()` | `true` / `false` | – |
| `field.select()` | wartość z listy | `options` |
| `field.color()` | `#rrggbb` | – |
| `field.url()` | `https://…`, `/podstrona`, `mailto:`, `tel:` | – |
| `field.image()` | `{ url, alt, width, height }` albo `null` | – |
| `field.list()` | tablica elementów | `fields` (bez list w listach), `max` (do 200) |

Każde pole przyjmuje `label`, `description`, `required` i (poza zdjęciem i listą) `default`.

Teksty zwracamy jako zwykły tekst – React sam je bezpiecznie wyświetla. Nie wstawiaj ich przez `dangerouslySetInnerHTML`.

## Opcje `createSite`

```js
createSite({
  sections: {},
  key: process.env.ZXCODE_SITE_KEY,
  url: process.env.ZXCODE_URL,       // domyślnie https://bot.zxcode.pl
  webhookUrl: 'https://…/api/zxcode', // adres do natychmiastowego odświeżania
  revalidate: 300,                    // sekundy cache Next.js; false = zawsze świeże
  tag: 'zxcode-cms',                  // tag cache Next.js
  ttl: 15,                            // sekundy cache w pamięci (inne frameworki)
  timeout: 5000,
  debug: false,
});
```

## Inne frameworki

```js
const { createSite, field } = require('zxcode-cms');
const site = createSite({ sections: { /* … */ }, ttl: 60 });

app.get('/', async (req, res) => res.render('index', await site.content()));
app.post('/api/zxcode', async (req, res) => {
  const handler = site.webhook();
  const r = await handler(new Request('http://x', { method: 'POST', headers: req.headers, body: req.rawBody }));
  res.status(r.status).end();
});
```

Podpis webhooka możesz też sprawdzić ręcznie: `verifySignature(klucz, nagłówekTimestamp, nagłówekPodpisu, surowaTreść)`.
