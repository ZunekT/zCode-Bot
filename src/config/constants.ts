export const BOT_VERSION = '0.1.0';
export const BRAND_NAME = 'zxCode';

export const Colors = {
  brand: 0x1a9fff,
  info: 0x1a9fff,
  success: 0x2ecc71,
  client: 0x2ecc71,
  warning: 0xf1c40f,
  error: 0xe74c3c,
  neutral: 0x2b2d31,
} as const;

export type ColorName = keyof typeof Colors;

export const DiscordLimits = {
  channelsPerCategory: 50,
  textDisplayLength: 4000,
  componentsPerMessage: 40,
  modalLabels: 5,
} as const;

export const ORDER_PREFIX = 'ZX';

export const TIMEZONE = 'Europe/Warsaw';
