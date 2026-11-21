import { revalidatePath, revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';
import { api, ApiError } from '@/lib/api';
import { guarded } from '@/lib/route';
import { getSession } from '@/lib/session';

type Method = 'GET' | 'PUT' | 'POST' | 'DELETE';

const RULES: [Method[], RegExp][] = [
  [['PUT', 'DELETE'], /^draft$/],
  [['POST'], /^publish$/],
  [['POST', 'DELETE'], /^schedule$/],
  [['POST'], /^preview-token$/],
  [['PUT'], /^(announcement|maintenance|redirects)$/],
  [['GET'], /^(stats|export|pricing|portfolio|reviews)$/],
  [['PUT', 'DELETE'], /^members\/\d{17,20}$/],
  [['POST'], /^pricing\/(packages|addons)$/],
  [['PUT', 'DELETE'], /^pricing\/(packages|addons)\/\d{1,9}$/],
  [['POST'], /^portfolio$/],
  [['PUT', 'DELETE'], /^portfolio\/\d{1,9}$/],
  [['POST'], /^portfolio\/\d{1,9}\/images$/],
  [['DELETE'], /^portfolio-images\/\d{1,9}$/],
  [['PUT', 'DELETE'], /^reviews\/\d{1,9}$/],
];

const allowed = (method: Method, path: string) => RULES.some(([m, re]) => m.includes(method) && re.test(path));
type Ctx = { params: Promise<{ id: string; akcja: string[] }> };

async function target(ctx: Ctx) {
  const { id, akcja } = await ctx.params;
  return { id: Number(id) || 0, path: akcja.join('/') };
}

function refresh() {
  revalidateTag('zxcode-content', { expire: 0 });
  revalidateTag('zxcode-site', { expire: 0 });
  revalidatePath('/', 'layout');
}

export async function GET(request: Request, ctx: Ctx) {
  const { id, path } = await target(ctx);
  const session = await getSession();
  if (!session || !allowed('GET', path)) return NextResponse.json({ error: 'Nie znaleziono.' }, { status: 404 });
  const query = new URL(request.url).search;
  try {
    const data = await api.cmsCall<unknown>(session.id, 'GET', id, `${path}${query}`);
    if (path === 'export')
      return new NextResponse(JSON.stringify(data, null, 2), {
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'content-disposition': `attachment; filename="tresc-strony-${id}-${new Date().toISOString().slice(0, 10)}.json"`,
          'cache-control': 'no-store',
        },
      });
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof ApiError) return NextResponse.json(err.body, { status: err.status >= 500 ? 502 : err.status });
    throw err;
  }
}

async function mutate(method: Method, request: Request, ctx: Ctx) {
  const { id, path } = await target(ctx);
  if (!allowed(method, path)) return NextResponse.json({ error: 'Nie znaleziono.' }, { status: 404 });
  return guarded(request, async (session, body) => {
    const data = await api.cmsCall<unknown>(session.id, method, id, path, method === 'DELETE' ? undefined : body);
    refresh();
    return data;
  });
}

export const PUT = (r: Request, c: Ctx) => mutate('PUT', r, c);
export const POST = (r: Request, c: Ctx) => mutate('POST', r, c);
export const DELETE = (r: Request, c: Ctx) => mutate('DELETE', r, c);
