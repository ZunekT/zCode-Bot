import { randomInt } from 'node:crypto';
import { deflateSync } from 'node:zlib';

/**
 * Captcha jako PNG generowany w czystym JS (bez natywnych bibliotek – działa też na Termuxie).
 * Znaki z czcionki bitmapowej 5×7, każdy obrócony, przesunięty i w innym kolorze, plus szum i linie.
 */

// Bez znaków mylących się ze sobą (0/O, 1/I, 2/Z, 5/S, 8/B).
export const CAPTCHA_CHARSET = 'ACDEFGHJKLMNPRTUVWXY3479';

const GLYPHS: Record<string, string[]> = {
  A: [' ### ', '#   #', '#   #', '#####', '#   #', '#   #', '#   #'],
  C: [' ####', '#    ', '#    ', '#    ', '#    ', '#    ', ' ####'],
  D: ['#### ', '#   #', '#   #', '#   #', '#   #', '#   #', '#### '],
  E: ['#####', '#    ', '#    ', '#### ', '#    ', '#    ', '#####'],
  F: ['#####', '#    ', '#    ', '#### ', '#    ', '#    ', '#    '],
  G: [' ####', '#    ', '#    ', '#  ##', '#   #', '#   #', ' ####'],
  H: ['#   #', '#   #', '#   #', '#####', '#   #', '#   #', '#   #'],
  J: ['  ###', '   # ', '   # ', '   # ', '   # ', '#  # ', ' ##  '],
  K: ['#   #', '#  # ', '# #  ', '##   ', '# #  ', '#  # ', '#   #'],
  L: ['#    ', '#    ', '#    ', '#    ', '#    ', '#    ', '#####'],
  M: ['#   #', '## ##', '# # #', '# # #', '#   #', '#   #', '#   #'],
  N: ['#   #', '##  #', '# # #', '#  ##', '#   #', '#   #', '#   #'],
  P: ['#### ', '#   #', '#   #', '#### ', '#    ', '#    ', '#    '],
  R: ['#### ', '#   #', '#   #', '#### ', '# #  ', '#  # ', '#   #'],
  T: ['#####', '  #  ', '  #  ', '  #  ', '  #  ', '  #  ', '  #  '],
  U: ['#   #', '#   #', '#   #', '#   #', '#   #', '#   #', ' ### '],
  V: ['#   #', '#   #', '#   #', '#   #', '#   #', ' # # ', '  #  '],
  W: ['#   #', '#   #', '#   #', '# # #', '# # #', '## ##', '#   #'],
  X: ['#   #', '#   #', ' # # ', '  #  ', ' # # ', '#   #', '#   #'],
  Y: ['#   #', '#   #', ' # # ', '  #  ', '  #  ', '  #  ', '  #  '],
  '3': ['#### ', '    #', '    #', ' ### ', '    #', '    #', '#### '],
  '4': ['   # ', '  ## ', ' # # ', '#  # ', '#####', '   # ', '   # '],
  '7': ['#####', '    #', '   # ', '  #  ', ' #   ', ' #   ', ' #   '],
  '9': [' ### ', '#   #', '#   #', ' ####', '    #', '    #', ' ### '],
};

const W = 300;
const H = 100;
const SCALE = 7;

type RGB = [number, number, number];
const PALETTE: RGB[] = [
  [26, 159, 255],
  [255, 255, 255],
  [120, 200, 255],
  [190, 190, 200],
  [80, 180, 255],
];

export function randomCode(length = 5): string {
  let code = '';
  for (let i = 0; i < length; i++) code += CAPTCHA_CHARSET[randomInt(CAPTCHA_CHARSET.length)];
  return code;
}

const rand = (min: number, max: number) => min + Math.random() * (max - min);

class Canvas {
  readonly px = new Uint8Array(W * H * 3);

  set(x: number, y: number, [r, g, b]: RGB, alpha = 1) {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = (y * W + x) * 3;
    this.px[i] = Math.round(this.px[i]! * (1 - alpha) + r * alpha);
    this.px[i + 1] = Math.round(this.px[i + 1]! * (1 - alpha) + g * alpha);
    this.px[i + 2] = Math.round(this.px[i + 2]! * (1 - alpha) + b * alpha);
  }

  line(x0: number, y0: number, x1: number, y1: number, color: RGB, width: number, alpha: number) {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let s = 0; s <= steps; s++) {
      const x = x0 + ((x1 - x0) * s) / steps;
      const y = y0 + ((y1 - y0) * s) / steps;
      for (let dx = 0; dx < width; dx++)
        for (let dy = 0; dy < width; dy++) this.set(x + dx, y + dy, color, alpha);
    }
  }
}

function drawGlyph(c: Canvas, ch: string, cx: number, cy: number, angle: number, color: RGB) {
  const glyph = GLYPHS[ch];
  if (!glyph) return;
  const gw = 5 * SCALE;
  const gh = 7 * SCALE;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const half = Math.ceil(Math.hypot(gw, gh) / 2);
  // Odwrotne mapowanie: dla każdego piksela wyniku sprawdzamy, czy po „odkręceniu” trafia w piksel litery.
  for (let y = -half; y <= half; y++) {
    for (let x = -half; x <= half; x++) {
      const gx = (x * cos + y * sin + gw / 2) / SCALE;
      const gy = (-x * sin + y * cos + gh / 2) / SCALE;
      const row = glyph[Math.floor(gy)];
      if (gx >= 0 && gy >= 0 && row?.[Math.floor(gx)] === '#') c.set(cx + x, cy + y, color);
    }
  }
}

function crc32(buf: Buffer): number {
  let c = ~0;
  for (const byte of buf) {
    c ^= byte;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(px: Uint8Array): Buffer {
  const raw = Buffer.alloc((W * 3 + 1) * H);
  for (let y = 0; y < H; y++) {
    raw[y * (W * 3 + 1)] = 0; // filtr: brak
    Buffer.from(px.buffer, px.byteOffset + y * W * 3, W * 3).copy(raw, y * (W * 3 + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Generuje obrazek PNG z kodem. */
export function renderCaptcha(code: string): Buffer {
  const c = new Canvas();

  // Tło: ciemny gradient w barwach zxCode + ziarno
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const t = (x / W + y / H) / 2;
      const n = rand(-6, 6);
      c.set(x, y, [10 + n, 13 + 20 * t + n, 20 + 50 * t + n]);
    }
  }
  // Linie w tle
  for (let i = 0; i < 6; i++) {
    c.line(rand(0, W), rand(0, H), rand(0, W), rand(0, H), PALETTE[randomInt(PALETTE.length)]!, 1, 0.35);
  }

  const step = (W - 40) / code.length;
  [...code].forEach((ch, i) => {
    drawGlyph(
      c,
      ch,
      20 + step * i + step / 2 + rand(-4, 4),
      H / 2 + rand(-10, 10),
      rand(-0.4, 0.4),
      PALETTE[randomInt(PALETTE.length)]!,
    );
  });

  // Linie przecinające znaki i kropki szumu
  for (let i = 0; i < 3; i++) {
    c.line(0, rand(20, H - 20), W, rand(20, H - 20), PALETTE[randomInt(PALETTE.length)]!, 2, 0.55);
  }
  for (let i = 0; i < 700; i++)
    c.set(rand(0, W), rand(0, H), PALETTE[randomInt(PALETTE.length)]!, rand(0.3, 0.8));

  return encodePng(c.px);
}
