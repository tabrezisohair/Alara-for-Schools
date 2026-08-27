import jpeg from "jpeg-js";
import { PNG } from "pngjs";

export const MAX_PALETTE = 8;

export function normalizeHex(value: string): string | null {
  const raw = value.trim();
  const short = raw.match(/^#?([0-9a-f]{3})$/i);
  if (short) {
    const [r, g, b] = short[1].split("");
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  const full = raw.match(/^#?([0-9a-f]{6})$/i);
  if (!full) return null;
  return `#${full[1].toUpperCase()}`;
}

export function uniqueHex(colors: string[]) {
  const seen = new Set<string>();
  const next: string[] = [];
  for (const color of colors) {
    const hex = normalizeHex(color);
    if (!hex || seen.has(hex)) continue;
    seen.add(hex);
    next.push(hex);
  }
  return next;
}

export function workingPalette(brand: {
  primary: string;
  secondary: string;
  accent: string;
  palette?: string[];
}) {
  return uniqueHex(
    brand.palette?.length
      ? brand.palette
      : [brand.primary, brand.secondary, brand.accent]
  ).slice(0, MAX_PALETTE);
}

export function rolesFromPalette(palette: string[]) {
  const colors = uniqueHex(palette);
  const primary = colors[0] ?? "#0D2C54";
  return {
    primary,
    secondary: colors[1] ?? "#E8B923",
    accent: colors[2] ?? "#F7F1DE",
    textOnPrimary: luminance(primary) < 0.55 ? "#FFFFFF" : "#122033",
  };
}

export function extractPaletteFromImage(bytes: Buffer, contentType = "") {
  const pixels = decodeImage(bytes, contentType);
  if (!pixels) return [];
  const buckets = new Map<string, { count: number; r: number; g: number; b: number }>();
  const step = Math.max(1, Math.floor(pixels.length / 4 / 80_000));
  for (let i = 0; i < pixels.length; i += 4 * step) {
    const a = pixels[i + 3];
    if (a < 140) continue;
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    if (nearGray(r, g, b) && (luminanceRgb(r, g, b) > 0.92 || luminanceRgb(r, g, b) < 0.06)) {
      continue;
    }
    const key = `${r >> 4}-${g >> 4}-${b >> 4}`;
    const current = buckets.get(key);
    if (current) {
      current.count += 1;
      current.r += r;
      current.g += g;
      current.b += b;
    } else {
      buckets.set(key, { count: 1, r, g, b });
    }
  }

  const ranked = [...buckets.values()]
    .filter((item) => item.count > 8)
    .map((item) => ({
      count: item.count,
      r: Math.round(item.r / item.count),
      g: Math.round(item.g / item.count),
      b: Math.round(item.b / item.count),
    }))
    .sort((a, b) => b.count - a.count);

  const merged: { hex: string; count: number; sat: number; lum: number }[] = [];
  for (const item of ranked) {
    const hex = rgbToHex(item.r, item.g, item.b);
    const sat = saturation(item.r, item.g, item.b);
    const lum = luminanceRgb(item.r, item.g, item.b);
    const close = merged.find((other) => hexDistance(other.hex, hex) < 28);
    if (close) {
      close.count += item.count;
      continue;
    }
    merged.push({ hex, count: item.count, sat, lum });
  }

  const chromatic = merged.filter((item) => item.sat > 0.12 || item.count > 40);
  const pool = chromatic.length ? chromatic : merged;
  const primary =
    [...pool].sort((a, b) => a.lum - b.lum || b.count - a.count)[0] ?? pool[0];
  const secondary =
    [...pool]
      .filter((item) => item.hex !== primary?.hex)
      .sort((a, b) => b.sat - a.sat || b.count - a.count)[0] ??
    pool[1];
  const accent =
    [...pool]
      .filter((item) => item.hex !== primary?.hex && item.hex !== secondary?.hex)
      .sort((a, b) => b.lum - a.lum || b.count - a.count)[0];
  const extras = pool
    .filter(
      (item) =>
        item.hex !== primary?.hex &&
        item.hex !== secondary?.hex &&
        item.hex !== accent?.hex
    )
    .sort((a, b) => b.count - a.count)
    .map((item) => item.hex);

  return uniqueHex([
    primary?.hex,
    secondary?.hex,
    accent?.hex,
    ...extras,
  ].filter(Boolean) as string[]).slice(0, MAX_PALETTE);
}

function decodeImage(bytes: Buffer, contentType: string) {
  const type = contentType.toLowerCase();
  if (type.includes("jpeg") || type.includes("jpg") || isJpeg(bytes)) {
    try {
      return jpeg.decode(bytes, { maxMemoryUsageInMB: 64 }).data;
    } catch {
      return null;
    }
  }
  if (type.includes("png") || isPng(bytes)) {
    try {
      return PNG.sync.read(bytes).data;
    } catch {
      return null;
    }
  }
  try {
    return PNG.sync.read(bytes).data;
  } catch {
    try {
      return jpeg.decode(bytes, { maxMemoryUsageInMB: 64 }).data;
    } catch {
      return null;
    }
  }
}

function isPng(bytes: Buffer) {
  return bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e;
}

function isJpeg(bytes: Buffer) {
  return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8;
}

function rgbToHex(r: number, g: number, b: number) {
  return `#${[r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

function hexToRgb(hex: string) {
  const value = normalizeHex(hex) ?? "#000000";
  return {
    r: parseInt(value.slice(1, 3), 16),
    g: parseInt(value.slice(3, 5), 16),
    b: parseInt(value.slice(5, 7), 16),
  };
}

function hexDistance(a: string, b: string) {
  const left = hexToRgb(a);
  const right = hexToRgb(b);
  return Math.hypot(left.r - right.r, left.g - right.g, left.b - right.b);
}

function luminance(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  return luminanceRgb(r, g, b);
}

function luminanceRgb(r: number, g: number, b: number) {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

function saturation(r: number, g: number, b: number) {
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  if (max === 0) return 0;
  return (max - min) / max;
}

function nearGray(r: number, g: number, b: number) {
  return Math.max(r, g, b) - Math.min(r, g, b) < 14;
}
