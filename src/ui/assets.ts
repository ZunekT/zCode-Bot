import { AttachmentBuilder } from 'discord.js';
import path from 'node:path';

const brandingDir = path.resolve(process.cwd(), 'assets', 'branding');

export function bannerFile(): AttachmentBuilder {
  return new AttachmentBuilder(path.join(brandingDir, 'banner-panel.jpg'), { name: 'banner.jpg' });
}

export function logoFile(): AttachmentBuilder {
  return new AttachmentBuilder(path.join(brandingDir, 'logo.jpg'), { name: 'logo.jpg' });
}

export const BANNER_URL = 'attachment://banner.jpg';
export const LOGO_URL = 'attachment://logo.jpg';
