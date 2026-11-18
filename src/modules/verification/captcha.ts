import { randomInt } from 'node:crypto';
import { Canvas, type RGB } from '../../utils/png.js';

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

export function renderCaptcha(code: string): Buffer {
  const c = new Canvas(W, H);

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

  return c.toPng();
}
