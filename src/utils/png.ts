import { deflateSync } from 'node:zlib';

/** Minimalne płótno RGB + koder PNG w czystym JS (bez natywnych bibliotek – działa też na Termuxie). */

export type RGB = [number, number, number];

export class Canvas {
  readonly px: Uint8Array;

  constructor(
    readonly width: number,
    readonly height: number,
  ) {
    this.px = new Uint8Array(width * height * 3);
  }

  set(x: number, y: number, [r, g, b]: RGB, alpha = 1) {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const i = (y * this.width + x) * 3;
    this.px[i] = Math.round(this.px[i]! * (1 - alpha) + r * alpha);
    this.px[i + 1] = Math.round(this.px[i + 1]! * (1 - alpha) + g * alpha);
    this.px[i + 2] = Math.round(this.px[i + 2]! * (1 - alpha) + b * alpha);
  }

  rect(x: number, y: number, w: number, h: number, color: RGB, alpha = 1) {
    for (let yy = Math.round(y); yy < Math.round(y + h); yy++)
      for (let xx = Math.round(x); xx < Math.round(x + w); xx++) this.set(xx, yy, color, alpha);
  }

  line(x0: number, y0: number, x1: number, y1: number, color: RGB, width: number, alpha: number) {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let s = 0; s <= steps; s++) {
      const x = x0 + ((x1 - x0) * s) / steps;
      const y = y0 + ((y1 - y0) * s) / steps;
      for (let dx = 0; dx < width; dx++)
        for (let dy = 0; dy < width; dy++) this.set(x + dx, y + dy, color, alpha);
    }
  }

  toPng(): Buffer {
    return encodePng(this.px, this.width, this.height);
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

export function encodePng(px: Uint8Array, width: number, height: number): Buffer {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 3 + 1)] = 0; // filtr: brak
    Buffer.from(px.buffer, px.byteOffset + y * width * 3, width * 3).copy(raw, y * (width * 3 + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
