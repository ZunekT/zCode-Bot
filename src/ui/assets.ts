import { AttachmentBuilder } from 'discord.js';
import path from 'node:path';

const brandingDir = path.resolve(process.cwd(), 'assets', 'branding');

/**
 * Baner zxCode do paneli (1200×400, ~25 KB – lekki, bo panel z select menu jest odświeżany po każdym wyborze).
 * W panelu: .banner(BANNER_URL)
 */
export function bannerFile(): AttachmentBuilder {
  return new AttachmentBuilder(path.join(brandingDir, 'banner-panel.jpg'), { name: 'banner.jpg' });
}

export function logoFile(): AttachmentBuilder {
  return new AttachmentBuilder(path.join(brandingDir, 'logo.jpg'), { name: 'logo.jpg' });
}

export const BANNER_URL = 'attachment://banner.jpg';
export const LOGO_URL = 'attachment://logo.jpg';
