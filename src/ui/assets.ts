import { AttachmentBuilder } from 'discord.js';
import path from 'node:path';

const brandingDir = path.resolve(process.cwd(), 'assets', 'branding');

/** Baner zxCode jako załącznik – w panelu: .banner('attachment://banner.png') */
export function bannerFile(): AttachmentBuilder {
  return new AttachmentBuilder(path.join(brandingDir, 'banner.png'), { name: 'banner.png' });
}

export function logoFile(): AttachmentBuilder {
  return new AttachmentBuilder(path.join(brandingDir, 'logo.jpg'), { name: 'logo.jpg' });
}

export const BANNER_URL = 'attachment://banner.png';
export const LOGO_URL = 'attachment://logo.jpg';
