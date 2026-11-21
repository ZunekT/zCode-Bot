import type { ServiceKind } from '../../generated/prisma/client.js';
import { prisma } from '../../db/prisma.js';
import { UserError } from '../../core/errors.js';
import { slugify } from '../../utils/format.js';
import { inspectImage } from './images.js';

const KINDS: ServiceKind[] = ['BOT', 'WEBSITE'];
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const kind = (v: unknown): ServiceKind => (KINDS.includes(v as ServiceKind) ? (v as ServiceKind) : 'BOT');

function price(v: unknown): number {
  const n = typeof v === 'string' ? Number(v.replace(',', '.').replace(/\s|zł/gi, '')) : Number(v);
  if (!Number.isFinite(n) || n < 0 || n > 1_000_000) throw new UserError('Cena musi być liczbą od 0 do 1 000 000.');
  return Math.round(n * 100) / 100;
}

const lines = (v: unknown, max: number, each: number) =>
  (Array.isArray(v) ? v : typeof v === 'string' ? v.split('\n') : [])
    .map((x) => str(x, each))
    .filter(Boolean)
    .slice(0, max);

export async function pricingData() {
  const [packages, addons] = await Promise.all([
    prisma.pricingPackage.findMany({ orderBy: [{ kind: 'asc' }, { position: 'asc' }, { id: 'asc' }] }),
    prisma.pricingItem.findMany({ orderBy: [{ kind: 'asc' }, { id: 'asc' }] }),
  ]);
  return {
    packages: packages.map((p) => ({ id: p.id, kind: p.kind, name: p.name, description: p.description, price: Number(p.price), features: p.features, position: p.position })),
    addons: addons.map((a) => ({ id: a.id, kind: a.kind, label: a.label, description: a.description, price: Number(a.price), active: a.active })),
  };
}

export async function savePackage(id: number | null, input: Record<string, unknown>) {
  const name = str(input.name, 60);
  if (!name) throw new UserError('Podaj nazwę pakietu.');
  const data = {
    kind: kind(input.kind),
    name,
    description: str(input.description, 300),
    price: price(input.price),
    features: lines(input.features, 12, 120),
    position: Number.isInteger(input.position) ? Number(input.position) : 0,
  };
  const clash = await prisma.pricingPackage.findFirst({ where: { name, ...(id && { NOT: { id } }) } });
  if (clash) throw new UserError('Pakiet o takiej nazwie już istnieje.');
  if (!id && (await prisma.pricingPackage.count({ where: { kind: data.kind } })) >= 3)
    throw new UserError('Maksymalnie 3 pakiety na rodzaj usługi (limit wiadomości na Discordzie).');
  if (id) await prisma.pricingPackage.update({ where: { id }, data });
  else await prisma.pricingPackage.create({ data });
  return pricingData();
}

export async function deletePackage(id: number) {
  await prisma.pricingPackage.deleteMany({ where: { id } });
  return pricingData();
}

export async function saveAddon(id: number | null, input: Record<string, unknown>) {
  const label = str(input.label, 60);
  if (!label) throw new UserError('Podaj nazwę dodatku.');
  const data = { kind: kind(input.kind), label, description: str(input.description, 200) || null, price: price(input.price), active: input.active !== false };
  if (id) await prisma.pricingItem.update({ where: { id }, data });
  else {
    if ((await prisma.pricingItem.count()) >= 50) throw new UserError('Maksymalnie 50 dodatków.');
    let key = slugify(label, 30) || 'dodatek';
    if (await prisma.pricingItem.findUnique({ where: { key } })) key = `${key}-${Date.now().toString(36)}`;
    await prisma.pricingItem.create({ data: { ...data, key } });
  }
  return pricingData();
}

export async function deleteAddon(id: number) {
  await prisma.pricingItem.deleteMany({ where: { id } });
  return pricingData();
}

export async function portfolioData() {
  const items = await prisma.portfolioItem.findMany({ orderBy: [{ position: 'asc' }, { id: 'desc' }], include: { images: { select: { id: true, position: true }, orderBy: { position: 'asc' } } } });
  return items.map((p) => ({ id: p.id, kind: p.kind, title: p.title, description: p.description, technologies: p.technologies, url: p.url, position: p.position, images: p.images.map((i) => i.id) }));
}

function projectUrl(v: unknown): string | null {
  const u = str(v, 300);
  if (!u) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(u) ? u : `https://${u}`);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error();
    return url.toString();
  } catch {
    throw new UserError('Nieprawidłowy adres projektu.');
  }
}

export async function savePortfolio(id: number | null, input: Record<string, unknown>) {
  const title = str(input.title, 80);
  if (!title) throw new UserError('Podaj tytuł realizacji.');
  const data = {
    kind: kind(input.kind),
    title,
    description: str(input.description, 2000),
    technologies: lines(input.technologies, 12, 40),
    url: projectUrl(input.url),
    position: Number.isInteger(input.position) ? Number(input.position) : 0,
  };
  if (id) await prisma.portfolioItem.update({ where: { id }, data });
  else await prisma.portfolioItem.create({ data });
  return portfolioData();
}

export async function deletePortfolio(id: number) {
  await prisma.portfolioItem.deleteMany({ where: { id } });
  return portfolioData();
}

export async function addPortfolioImage(itemId: number, data: Buffer) {
  const item = await prisma.portfolioItem.findUnique({ where: { id: itemId }, include: { _count: { select: { images: true } } } });
  if (!item) throw new UserError('Nie ma takiej realizacji.');
  if (item._count.images >= 10) throw new UserError('Maksymalnie 10 zdjęć na realizację.');
  if (data.length > 4 * 1024 * 1024) throw new UserError('Zdjęcie może mieć maksymalnie 4 MB.');
  const info = inspectImage(data);
  if (!info) throw new UserError('Obsługiwane formaty: PNG, JPG, WebP, GIF.');
  await prisma.portfolioImage.create({ data: { itemId, name: `realizacja-${itemId}.${info.ext}`, contentType: info.type, data: new Uint8Array(data), position: item._count.images } });
  return portfolioData();
}

export async function deletePortfolioImage(imageId: number) {
  await prisma.portfolioImage.deleteMany({ where: { id: imageId } });
  return portfolioData();
}

export async function reviewsData() {
  const reviews = await prisma.review.findMany({ orderBy: { createdAt: 'desc' }, take: 200, include: { order: { select: { id: true, title: true } } } });
  return reviews.map((r) => ({ id: r.id, userId: r.userId, rating: r.rating, content: r.content, approved: r.approved, createdAt: r.createdAt.toISOString(), order: r.order ? { id: r.order.id, title: r.order.title } : null }));
}

export async function setReviewApproved(id: number, approved: boolean, by: string) {
  await prisma.review.update({ where: { id }, data: { approved, reviewedAt: new Date(), reviewedBy: by } });
  return reviewsData();
}

export async function deleteReview(id: number) {
  await prisma.review.deleteMany({ where: { id } });
  return reviewsData();
}
