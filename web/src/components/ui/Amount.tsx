import { CountUp } from '../site/islands';

export function Amount({ v, dash = '—' }: { v: number | null | undefined; dash?: string }) {
  if (v === null || v === undefined) return <>{dash}</>;
  return <CountUp to={v} money />;
}
