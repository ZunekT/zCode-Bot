import 'server-only';
import { NextResponse } from 'next/server';
import { ApiError } from './api';
import { env } from './env';
import { getSession, type Session } from './session';

/**
 * Wspólna obsługa zapisu z panelu: sesja + ochrona CSRF (nagłówek Origin musi być naszą stroną)
 * i przekazanie błędów walidacji z API bota.
 */
export async function guarded(
  request: Request,
  fn: (session: Session, body: unknown) => Promise<unknown>,
): Promise<NextResponse> {
  const origin = request.headers.get('origin');
  if (origin !== new URL(env.siteUrl).origin) {
    return NextResponse.json({ error: 'Nieprawidłowe źródło żądania.' }, { status: 403 });
  }
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Sesja wygasła – zaloguj się ponownie.' }, { status: 401 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Nieprawidłowe dane.' }, { status: 400 });
  }
  try {
    return NextResponse.json(await fn(session, body));
  } catch (err) {
    if (err instanceof ApiError) return NextResponse.json(err.body, { status: err.status >= 500 ? 502 : err.status });
    console.error(err);
    return NextResponse.json({ error: 'Błąd serwera.' }, { status: 500 });
  }
}
