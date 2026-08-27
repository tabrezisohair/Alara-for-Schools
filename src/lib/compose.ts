import type { BrandProfile, Brief, Database, Intent } from "./types";
import { ctaFor, headlineFor, kickerFor, metaLines } from "./brain";
import { isPosterSafeAsset, resolvePhotoTreatment } from "./schoolRules";
import { FALLBACK_LOGO } from "./logo";

export type PosterFormat = "square" | "story" | "wide";

type Size = { w: number; h: number };

type TypeOpts = {
  kicker: string;
  title: string;
  subtitle?: string;
  meta: string[];
  x: number;
  y: number;
  maxWidth: number;
  titleSize: number;
  maxTitle: number;
  leading: number;
  onDark?: boolean;
  kickerSize?: number;
  metaSize?: number;
};

function sans() {
  if (typeof document !== "undefined") {
    const family = getComputedStyle(document.body).fontFamily;
    if (family) return family;
  }
  return '"Plus Jakarta Sans", system-ui, sans-serif';
}

function serif(brand: BrandProfile) {
  return brand.fonts.heading || "Georgia, 'Times New Roman', serif";
}

async function fontsReady() {
  if (typeof document === "undefined" || !document.fonts) return;
  await document.fonts.ready;
  const family = sans();
  await Promise.allSettled([
    document.fonts.load(`700 72px ${family}`),
    document.fonts.load(`600 24px ${family}`),
    document.fonts.load(`700 72px Georgia`),
  ]);
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

async function loadLogo(url?: string) {
  if (url?.trim()) {
    const img = await loadImage(url.trim());
    if (img) return img;
  }
  return loadImage(FALLBACK_LOGO);
}

function hexAlpha(hex: string, alpha: number) {
  const raw = hex.replace("#", "");
  const full = raw.length === 3 ? raw.split("").map((c) => c + c).join("") : raw;
  const n = Number.parseInt(full.slice(0, 6), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

function contain(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number
) {
  const scale = Math.min(w / img.width, h / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function tracked(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  tracking = 3
) {
  const spaced = ctx as CanvasRenderingContext2D & { letterSpacing: string };
  spaced.letterSpacing = `${tracking}px`;
  ctx.fillText(text, x, y);
  spaced.letterSpacing = "0px";
}

function canvasSize(format: PosterFormat): Size {
  if (format === "wide") return { w: 1200, h: 630 };
  if (format === "story") return { w: 1080, h: 1920 };
  return { w: 1080, h: 1080 };
}

function footerH(format: PosterFormat) {
  if (format === "story") return 148;
  if (format === "wide") return 84;
  return 108;
}

export function pickPosterPhoto(
  db: Database,
  _intent: Intent,
  photoIds?: string[]
) {
  if (!photoIds?.length) return undefined;
  const chosen = photoIds
    .map((id) => db.assets.find((asset) => asset.id === id))
    .find(isPosterSafeAsset);
  return chosen?.url;
}

function drawField(ctx: CanvasRenderingContext2D, brand: BrandProfile, size: Size) {
  const wash = ctx.createLinearGradient(0, 0, size.w * 0.2, size.h);
  wash.addColorStop(0, brand.primary);
  wash.addColorStop(1, hexAlpha(brand.primary, 0.92));
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, size.w, size.h);

  ctx.strokeStyle = hexAlpha(brand.secondary, 0.055);
  ctx.lineWidth = 1;
  for (let x = 40; x < size.w; x += 48) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, size.h);
    ctx.stroke();
  }
  for (let y = 40; y < size.h; y += 48) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size.w, y);
    ctx.stroke();
  }

  for (let y = 72; y < size.h; y += 72) {
    for (let x = 72; x < size.w; x += 72) {
      ctx.fillStyle = hexAlpha(brand.secondary, 0.06);
      ctx.beginPath();
      ctx.moveTo(x, y - 5);
      ctx.lineTo(x + 5, y);
      ctx.lineTo(x, y + 5);
      ctx.lineTo(x - 5, y);
      ctx.closePath();
      ctx.fill();
    }
  }

  const glow = ctx.createRadialGradient(
    size.w * 0.82,
    size.h * 0.12,
    20,
    size.w * 0.75,
    size.h * 0.18,
    size.w * 0.55
  );
  glow.addColorStop(0, hexAlpha(brand.secondary, 0.16));
  glow.addColorStop(1, hexAlpha(brand.primary, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, size.w, size.h);

  ctx.fillStyle = brand.secondary;
  ctx.fillRect(0, 0, 12, size.h);
  ctx.fillStyle = hexAlpha("#ffffff", 0.16);
  ctx.fillRect(12, 0, 4, size.h);
  ctx.fillStyle = brand.secondary;
  ctx.fillRect(16, 0, 3, size.h);
}

function drawCorner(
  ctx: CanvasRenderingContext2D,
  brand: BrandProfile,
  x: number,
  y: number,
  dx: number,
  dy: number,
  arm = 34
) {
  ctx.strokeStyle = hexAlpha(brand.secondary, 0.85);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y + dy * arm);
  ctx.lineTo(x, y);
  ctx.lineTo(x + dx * arm, y);
  ctx.stroke();
}

function drawFrame(
  ctx: CanvasRenderingContext2D,
  brand: BrandProfile,
  size: Size,
  footer: number
) {
  const inset = 28;
  const top = 28;
  const bottom = size.h - footer - 16;
  ctx.strokeStyle = hexAlpha(brand.secondary, 0.28);
  ctx.lineWidth = 1.25;
  ctx.strokeRect(inset, top, size.w - inset * 2, bottom - top);
  drawCorner(ctx, brand, inset, top, 1, 1);
  drawCorner(ctx, brand, size.w - inset, top, -1, 1);
  drawCorner(ctx, brand, inset, bottom, 1, -1);
  drawCorner(ctx, brand, size.w - inset, bottom, -1, -1);
}

function drawCampusHint(
  ctx: CanvasRenderingContext2D,
  brand: BrandProfile,
  x: number,
  y: number,
  w: number
) {
  const h = w * 0.52;
  ctx.strokeStyle = hexAlpha(brand.secondary, 0.7);
  ctx.lineWidth = 4;
  const bay = w / 3;
  for (let i = 0; i < 3; i++) {
    const ax = x + i * bay;
    ctx.beginPath();
    ctx.moveTo(ax + 10, y + h);
    ctx.lineTo(ax + 10, y + h * 0.42);
    ctx.arc(ax + bay / 2, y + h * 0.42, bay / 2 - 10, Math.PI, 0);
    ctx.lineTo(ax + bay - 10, y + h);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  ctx.lineTo(x + w, y + h);
  ctx.stroke();
}

function drawHeader(
  ctx: CanvasRenderingContext2D,
  brand: BrandProfile,
  school: string,
  tagline: string,
  logo: HTMLImageElement | null,
  x: number,
  y: number,
  mark: number,
  onDark = true
) {
  if (logo) {
    const logoH = mark;
    const ratio = logo.width / Math.max(logo.height, 1);
    const logoW = Math.min(logoH * ratio, mark * 5.2);
    const padX = 18;
    const padY = 12;
    if (onDark) {
      ctx.fillStyle = brand.accent || "#F7F1DE";
      roundRect(ctx, x, y, logoW + padX * 2, logoH + padY * 2, 16);
      ctx.fill();
    }
    ctx.drawImage(logo, x + padX, y + padY, logoW, logoH);
    ctx.fillStyle = onDark ? hexAlpha("#ffffff", 0.62) : hexAlpha(brand.primary, 0.5);
    ctx.font = `600 13px ${sans()}`;
    ctx.fillText(tagline, x, y + logoH + padY * 2 + 22);
    return;
  }

  const plate = mark + 14;
  if (onDark) {
    ctx.fillStyle = hexAlpha("#ffffff", 0.08);
    roundRect(ctx, x, y, plate, plate, 16);
    ctx.fill();
    ctx.strokeStyle = hexAlpha(brand.secondary, 0.7);
    ctx.lineWidth = 1.75;
    ctx.stroke();
  }
  ctx.fillStyle = brand.secondary;
  roundRect(ctx, x + 7, y + 7, mark, mark, 12);
  ctx.fill();
  ctx.fillStyle = onDark ? brand.secondary : brand.primary;
  ctx.font = `700 15px ${sans()}`;
  tracked(ctx, school.toUpperCase(), x + plate + 16, y + mark * 0.42, 2.2);
  ctx.fillStyle = onDark ? hexAlpha("#ffffff", 0.58) : hexAlpha(brand.primary, 0.5);
  ctx.font = `600 13px ${sans()}`;
  ctx.fillText(tagline, x + plate + 16, y + mark * 0.72);
}

function drawFooter(
  ctx: CanvasRenderingContext2D,
  brand: BrandProfile,
  size: Size,
  text: string,
  tall: number
) {
  ctx.fillStyle = brand.secondary;
  ctx.fillRect(0, size.h - tall, size.w, tall);
  ctx.fillStyle = brand.primary;
  ctx.fillRect(0, size.h - tall, size.w, 4);
  ctx.fillStyle = brand.primary;
  const sizePx = tall > 130 ? 28 : 22;
  ctx.font = `700 ${sizePx}px ${sans()}`;
  ctx.textAlign = "center";
  ctx.fillText(text, size.w / 2, size.h - tall / 2 + 8);
  ctx.textAlign = "left";
}

function dateParts(iso?: string) {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  return {
    day: String(d),
    month: date
      .toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" })
      .toUpperCase(),
    weekday: date.toLocaleDateString("en-GB", {
      weekday: "long",
      timeZone: "UTC",
    }),
  };
}

function drawDateBadge(
  ctx: CanvasRenderingContext2D,
  brand: BrandProfile,
  brief: Brief,
  x: number,
  y: number,
  scale = 1
) {
  const parts = dateParts(brief.date);
  if (!parts) return 0;
  const w = 158 * scale;
  const h = 176 * scale;
  ctx.fillStyle = brand.secondary;
  roundRect(ctx, x, y, w, h, 22 * scale);
  ctx.fill();
  ctx.fillStyle = brand.primary;
  ctx.textAlign = "center";
  ctx.font = `700 ${16 * scale}px ${sans()}`;
  tracked(ctx, parts.month, x + w / 2, y + 36 * scale, 2.4);
  ctx.font = `800 ${72 * scale}px ${serif(brand)}`;
  ctx.fillText(parts.day, x + w / 2, y + 112 * scale);
  ctx.font = `600 ${14 * scale}px ${sans()}`;
  ctx.fillText(parts.weekday, x + w / 2, y + 148 * scale);
  ctx.textAlign = "left";
  return w;
}

function drawPhotoPanel(
  ctx: CanvasRenderingContext2D,
  brand: BrandProfile,
  photo: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number
) {
  ctx.save();
  roundRect(ctx, x, y, w, h, 26);
  ctx.clip();
  ctx.fillStyle = brand.primary;
  ctx.fillRect(x, y, w, h);
  contain(ctx, photo, x + 10, y + 10, w - 20, h - 20);
  ctx.restore();
  ctx.strokeStyle = hexAlpha(brand.secondary, 0.9);
  ctx.lineWidth = 3;
  roundRect(ctx, x, y, w, h, 26);
  ctx.stroke();
}

function typeBlock(
  ctx: CanvasRenderingContext2D,
  brand: BrandProfile,
  opts: TypeOpts
) {
  const onDark = opts.onDark !== false;
  const kickerSize = opts.kickerSize ?? 16;
  ctx.fillStyle = onDark ? brand.secondary : brand.primary;
  ctx.font = `700 ${kickerSize}px ${sans()}`;
  tracked(ctx, opts.kicker, opts.x, opts.y, 3.1);

  ctx.fillStyle = brand.secondary;
  ctx.fillRect(opts.x, opts.y + 14, 54, 3);

  ctx.fillStyle = onDark ? brand.textOnPrimary : brand.primary;
  ctx.font = `700 ${opts.titleSize}px ${serif(brand)}`;
  const lines = wrap(ctx, opts.title, opts.maxWidth).slice(0, opts.maxTitle);
  lines.forEach((line, i) => {
    ctx.fillText(line, opts.x, opts.y + 76 + i * opts.leading);
  });

  let cursor = opts.y + 76 + lines.length * opts.leading + 18;
  if (opts.subtitle) {
    ctx.fillStyle = onDark ? hexAlpha(brand.secondary, 0.92) : hexAlpha(brand.primary, 0.78);
    ctx.font = `italic 600 26px ${serif(brand)}`;
    wrap(ctx, opts.subtitle, opts.maxWidth)
      .slice(0, 2)
      .forEach((line, i) => {
        ctx.fillText(line, opts.x, cursor + i * 34);
      });
    cursor += 80;
  }

  const metaSize = opts.metaSize ?? 22;
  ctx.font = `600 ${metaSize}px ${sans()}`;
  opts.meta.forEach((line, i) => {
    ctx.fillStyle = brand.secondary;
    ctx.beginPath();
    ctx.arc(opts.x + 5, cursor + i * 40 - 6, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = onDark ? hexAlpha("#ffffff", 0.92) : brand.primary;
    ctx.fillText(line, opts.x + 22, cursor + i * 40);
  });
  return cursor + opts.meta.length * 40;
}

export async function composePoster(opts: {
  format: PosterFormat;
  db: Database;
  intent: Intent;
  brief: Brief;
  beat?: string;
  photoUrl?: string;
}): Promise<string> {
  const { format, db, intent, brief, beat } = opts;
  await fontsReady();
  const brand = db.brand;
  const size = canvasSize(format);
  const canvas = document.createElement("canvas");
  canvas.width = size.w;
  canvas.height = size.h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  const photoSrc = opts.photoUrl ?? pickPosterPhoto(db, intent, brief.photoIds);
  const [photo, logo] = await Promise.all([
    photoSrc ? loadImage(photoSrc) : Promise.resolve(null),
    loadLogo(brand.logoUrl),
  ]);
  const treatment = resolvePhotoTreatment(brief);

  const copy = {
    kicker: kickerFor(intent, brief, beat, db.school.name),
    title: headlineFor(db, intent, brief),
    meta: metaLines(brief),
    cta: ctaFor(intent, brief) || db.school.tagline,
    footer: footerH(format),
  };

  if (intent === "photos_to_post" && (treatment === "as_is" || treatment === "captioned")) {
    drawOriginalPhoto(ctx, brand, db, logo, photo, size, format, copy, treatment);
    return canvas.toDataURL("image/png");
  }

  drawField(ctx, brand, size);

  if (intent === "announcement") {
    drawNotice(ctx, brand, db, logo, size, format, copy, brief);
  } else if (intent === "achievement") {
    drawAchievement(ctx, brand, db, logo, photo, size, format, copy, brief);
  } else if (intent === "admissions") {
    drawAdmissions(ctx, brand, db, logo, photo, size, format, copy, brief);
  } else if (intent === "showcase" || intent === "photos_to_post") {
    drawPhotoForward(ctx, brand, db, logo, photo, size, format, copy);
  } else {
    drawEvent(ctx, brand, db, logo, photo, size, format, copy, brief);
  }

  return canvas.toDataURL("image/png");
}

function drawEvent(
  ctx: CanvasRenderingContext2D,
  brand: BrandProfile,
  db: Database,
  logo: HTMLImageElement | null,
  photo: HTMLImageElement | null,
  size: Size,
  format: PosterFormat,
  copy: { kicker: string; title: string; meta: string[]; cta: string; footer: number },
  brief: Brief
) {
  const pad = format === "story" ? 72 : 56;
  drawFrame(ctx, brand, size, copy.footer);
  drawHeader(
    ctx,
    brand,
    db.school.name,
    db.school.tagline,
    logo,
    pad,
    pad,
    format === "story" ? 88 : 70
  );

  if (format === "story") {
    if (photo) {
      drawPhotoPanel(ctx, brand, photo, pad, 230, size.w - pad * 2, 640);
    } else if (brief.date) {
      drawDateBadge(ctx, brand, brief, size.w / 2 - 96, 300, 1.22);
    }
    typeBlock(ctx, brand, {
      kicker: copy.kicker,
      title: copy.title,
      meta: copy.meta,
      x: pad,
      y: photo ? 940 : brief.date ? 580 : 520,
      maxWidth: size.w - pad * 2,
      titleSize: 70,
      maxTitle: 4,
      leading: 80,
    });
    if (!photo) {
      drawCampusHint(ctx, brand, pad + 40, 1180, size.w - (pad + 40) * 2);
    }
    drawFooter(ctx, brand, size, copy.cta, copy.footer);
    return;
  }

  if (format === "wide") {
    if (photo) {
      drawPhotoPanel(ctx, brand, photo, 760, 96, 380, size.h - copy.footer - 126);
    } else if (brief.date) {
      drawDateBadge(ctx, brand, brief, size.w - 230, 150);
    } else {
      drawCampusHint(ctx, brand, size.w - 430, 190, 340);
    }
    typeBlock(ctx, brand, {
      kicker: copy.kicker,
      title: copy.title,
      meta: copy.meta,
      x: pad,
      y: 196,
      maxWidth: photo || brief.date ? 620 : 820,
      titleSize: 44,
      maxTitle: 2,
      leading: 52,
      metaSize: 20,
    });
    drawFooter(ctx, brand, size, copy.cta, copy.footer);
    return;
  }

  typeBlock(ctx, brand, {
    kicker: copy.kicker,
    title: copy.title,
    meta: copy.meta,
    x: pad,
    y: 220,
    maxWidth: photo ? 500 : 640,
    titleSize: 60,
    maxTitle: 3,
    leading: 70,
  });
  if (photo) {
    drawPhotoPanel(ctx, brand, photo, 620, 216, 400, 640);
  } else {
    if (brief.date) drawDateBadge(ctx, brand, brief, size.w - 236, 216, 1.12);
    drawCampusHint(ctx, brand, 200, 560, 680);
  }
  drawFooter(ctx, brand, size, copy.cta, copy.footer);
}

function drawNotice(
  ctx: CanvasRenderingContext2D,
  brand: BrandProfile,
  db: Database,
  logo: HTMLImageElement | null,
  size: Size,
  format: PosterFormat,
  copy: { kicker: string; title: string; meta: string[]; cta: string; footer: number },
  brief: Brief
) {
  const urgent = brief.severity === "Urgent";
  const pad = format === "wide" ? 44 : 64;
  const cardX = pad;
  const cardY = format === "story" ? 210 : format === "wide" ? 86 : 140;
  const cardW = size.w - pad * 2;
  const cardH = size.h - cardY - copy.footer - 24;

  ctx.fillStyle = brand.accent || "#F7F1DE";
  roundRect(ctx, cardX, cardY, cardW, cardH, 26);
  ctx.fill();
  ctx.strokeStyle = brand.secondary;
  ctx.lineWidth = urgent ? 7 : 2.5;
  ctx.stroke();
  if (urgent) {
    ctx.strokeStyle = brand.primary;
    ctx.lineWidth = 1.5;
    roundRect(ctx, cardX + 10, cardY + 10, cardW - 20, cardH - 20, 18);
    ctx.stroke();
  }

  const inset = 36;
  const mark = format === "wide" ? 52 : 64;
  drawHeader(
    ctx,
    brand,
    db.school.name,
    db.school.tagline,
    logo,
    cardX + inset,
    cardY + 28,
    mark,
    false
  );

  const titleSize = format === "wide" ? 36 : format === "story" ? 56 : 50;
  const leading = format === "wide" ? 44 : 60;
  const y = cardY + 28 + mark + (format === "wide" ? 56 : 78);

  if (format === "wide") {
    typeBlock(ctx, brand, {
      kicker: copy.kicker,
      title: copy.title,
      meta: copy.meta,
      x: cardX + inset,
      y,
      maxWidth: 700,
      titleSize,
      maxTitle: 2,
      leading,
      onDark: false,
      metaSize: 18,
    });
    if (brief.bodyFacts) {
      ctx.fillStyle = hexAlpha(brand.primary, 0.78);
      ctx.font = `500 18px ${sans()}`;
      wrap(ctx, brief.bodyFacts, cardW - inset * 2)
        .slice(0, 2)
        .forEach((line, i) => {
          ctx.fillText(line, cardX + inset, cardY + cardH - 28 + i * 24);
        });
    }
    drawFooter(ctx, brand, size, copy.cta || "Please note", copy.footer);
    return;
  }

  const afterTitle = typeBlock(ctx, brand, {
    kicker: copy.kicker,
    title: copy.title,
    meta: copy.meta,
    x: cardX + inset,
    y,
    maxWidth: cardW - inset * 2,
    titleSize,
    maxTitle: 3,
    leading,
    onDark: false,
  });

  if (brief.bodyFacts) {
    ctx.fillStyle = hexAlpha(brand.primary, 0.8);
    ctx.font = `500 ${format === "story" ? 26 : 22}px ${sans()}`;
    const bodyLead = format === "story" ? 36 : 30;
    wrap(ctx, brief.bodyFacts, cardW - inset * 2)
      .slice(0, format === "story" ? 8 : 5)
      .forEach((line, i) => {
        ctx.fillText(line, cardX + inset, afterTitle + 28 + i * bodyLead);
      });
  }

  drawFooter(ctx, brand, size, copy.cta || "Please note", copy.footer);
}

function drawAchievement(
  ctx: CanvasRenderingContext2D,
  brand: BrandProfile,
  db: Database,
  logo: HTMLImageElement | null,
  photo: HTMLImageElement | null,
  size: Size,
  format: PosterFormat,
  copy: { kicker: string; title: string; meta: string[]; cta: string; footer: number },
  brief: Brief
) {
  const pad = format === "wide" ? 52 : 68;
  drawHeader(ctx, brand, db.school.name, db.school.tagline, logo, pad, pad, 70);
  const frameX = pad;
  const frameY = format === "story" ? 250 : format === "wide" ? 148 : 196;
  const frameW = size.w - pad * 2;
  const frameH =
    format === "story" ? 1180 : format === "wide" ? size.h - copy.footer - 176 : 640;

  ctx.strokeStyle = brand.secondary;
  ctx.lineWidth = 5;
  roundRect(ctx, frameX, frameY, frameW, frameH, 24);
  ctx.stroke();
  ctx.strokeStyle = hexAlpha(brand.secondary, 0.4);
  ctx.lineWidth = 1.25;
  roundRect(ctx, frameX + 12, frameY + 12, frameW - 24, frameH - 24, 16);
  ctx.stroke();

  if (photo && format === "square") {
    drawPhotoPanel(ctx, brand, photo, frameX + 32, frameY + 32, 268, frameH - 64);
  } else if (photo && format === "story") {
    drawPhotoPanel(ctx, brand, photo, frameX + 40, frameY + 36, frameW - 80, 430);
  } else if (photo && format === "wide") {
    drawPhotoPanel(ctx, brand, photo, frameX + frameW - 292, frameY + 24, 260, frameH - 48);
  }

  const textX =
    photo && (format === "square" || format === "wide")
      ? frameX + (format === "wide" ? 36 : 332)
      : frameX + 44;
  const ty =
    format === "story" ? frameY + (photo ? 500 : 80) : format === "wide" ? frameY + 36 : frameY + 56;
  const maxW =
    photo && format === "square"
      ? frameW - 380
      : photo && format === "wide"
        ? frameW - 360
        : frameW - 88;

  typeBlock(ctx, brand, {
    kicker: copy.kicker,
    title: copy.title,
    subtitle: brief.achievement,
    meta: copy.meta,
    x: textX,
    y: ty,
    maxWidth: maxW,
    titleSize: format === "wide" ? 40 : 54,
    maxTitle: 3,
    leading: format === "wide" ? 48 : 64,
  });
  drawFooter(ctx, brand, size, copy.cta || "A proud moment", copy.footer);
}

function drawAdmissions(
  ctx: CanvasRenderingContext2D,
  brand: BrandProfile,
  db: Database,
  logo: HTMLImageElement | null,
  photo: HTMLImageElement | null,
  size: Size,
  format: PosterFormat,
  copy: { kicker: string; title: string; meta: string[]; cta: string; footer: number },
  brief: Brief
) {
  const pad = format === "story" ? 72 : 56;
  drawFrame(ctx, brand, size, copy.footer);
  drawHeader(ctx, brand, db.school.name, db.school.tagline, logo, pad, pad, 70);

  if (photo && format === "wide") {
    drawPhotoPanel(ctx, brand, photo, 760, 96, 380, size.h - copy.footer - 126);
  } else if (photo) {
    const ph = format === "story" ? 620 : 340;
    drawPhotoPanel(ctx, brand, photo, pad, 196, size.w - pad * 2, ph);
  } else if (format !== "wide") {
    drawCampusHint(ctx, brand, pad + 40, format === "story" ? 280 : 210, size.w - pad * 2 - 80);
  }

  const y = photo
    ? format === "square"
      ? 590
      : format === "story"
        ? 900
        : 196
    : format === "story"
      ? 620
      : 360;
  const meta = copy.meta.length
    ? copy.meta
    : [db.school.admissionsLine || db.school.tagline];

  typeBlock(ctx, brand, {
    kicker: copy.kicker,
    title: copy.title,
    subtitle:
      brief.program && brief.program !== "All"
        ? `${brief.program} programme`
        : db.school.admissionsLine,
    meta,
    x: pad,
    y: format === "wide" ? 196 : y,
    maxWidth:
      format === "wide" && photo
        ? 620
        : size.w - pad * 2 - (brief.deadline && format === "square" ? 20 : 0),
    titleSize: format === "wide" ? 40 : 56,
    maxTitle: 3,
    leading: format === "wide" ? 48 : 64,
  });
  drawFooter(ctx, brand, size, copy.cta, copy.footer);
}

function drawOriginalPhoto(
  ctx: CanvasRenderingContext2D,
  brand: BrandProfile,
  db: Database,
  logo: HTMLImageElement | null,
  photo: HTMLImageElement | null,
  size: Size,
  format: PosterFormat,
  copy: { kicker: string; title: string; meta: string[]; cta: string; footer: number },
  treatment: "as_is" | "captioned"
) {
  const band = format === "story" ? 220 : format === "wide" ? 132 : 168;
  ctx.fillStyle = brand.accent || "#F7F1DE";
  ctx.fillRect(0, 0, size.w, size.h);
  ctx.fillStyle = brand.primary;
  ctx.fillRect(0, size.h - band, size.w, band);
  ctx.fillStyle = brand.secondary;
  ctx.fillRect(0, size.h - band, size.w, 6);

  if (photo) {
    contain(ctx, photo, 24, 24, size.w - 48, size.h - band - 36);
  }

  const pad = 36;
  if (logo) {
    const lh = format === "wide" ? 36 : 44;
    const lw = Math.round((logo.width / Math.max(logo.height, 1)) * lh);
    ctx.fillStyle = "#F7F1DE";
    roundRect(ctx, pad, size.h - band + 22, lw + 20, lh + 14, 10);
    ctx.fill();
    ctx.drawImage(logo, pad + 10, size.h - band + 29, lw, lh);
  }

  ctx.fillStyle = brand.secondary;
  ctx.font = `700 13px ${sans()}`;
  tracked(ctx, treatment === "as_is" ? "ORIGINAL PHOTO" : copy.kicker || "CAMPUS LIFE", pad, size.h - 78, 2);
  ctx.fillStyle = brand.textOnPrimary || "#FFFFFF";
  ctx.font = `700 ${format === "wide" ? 22 : 26}px ${serif(brand)}`;
  const title = copy.title || db.school.tagline;
  ctx.fillText(title.slice(0, 42), pad, size.h - 42, size.w - pad * 2);
  ctx.font = `500 14px ${sans()}`;
  ctx.fillStyle = hexAlpha("#ffffff", 0.72);
  ctx.fillText(copy.cta || db.school.name, pad, size.h - 18, size.w - pad * 2);
}

function drawPhotoForward(
  ctx: CanvasRenderingContext2D,
  brand: BrandProfile,
  db: Database,
  logo: HTMLImageElement | null,
  photo: HTMLImageElement | null,
  size: Size,
  format: PosterFormat,
  copy: { kicker: string; title: string; meta: string[]; cta: string; footer: number }
) {
  const pad = format === "story" ? 72 : 56;
  drawFrame(ctx, brand, size, copy.footer);
  drawHeader(
    ctx,
    brand,
    db.school.name,
    db.school.tagline,
    logo,
    pad,
    pad,
    format === "story" ? 88 : 70
  );

  if (photo && format === "wide") {
    drawPhotoPanel(ctx, brand, photo, 760, 96, 380, size.h - copy.footer - 126);
  } else if (photo) {
    const top = format === "story" ? 230 : 200;
    const ph = format === "story" ? 640 : 420;
    drawPhotoPanel(ctx, brand, photo, pad, top, size.w - pad * 2, ph);
  } else {
    drawCampusHint(
      ctx,
      brand,
      size.w * 0.18,
      format === "story" ? 420 : 220,
      size.w * 0.64
    );
  }

  typeBlock(ctx, brand, {
    kicker: copy.kicker,
    title: copy.title,
    meta: copy.meta,
    x: pad,
    y: photo
      ? format === "story"
        ? 940
        : format === "wide"
          ? 196
          : 660
      : format === "story"
        ? 900
        : format === "wide"
          ? 196
          : 420,
    maxWidth: photo && format === "wide" ? 620 : size.w - pad * 2,
    titleSize: format === "wide" ? 40 : 54,
    maxTitle: 3,
    leading: 62,
  });
  drawFooter(ctx, brand, size, copy.cta || db.school.tagline, copy.footer);
}

/**
 * Stamps the school's real logo onto a generated poster.
 * The image model is told to leave the top-left corner clear, and the plate
 * behind the mark keeps it readable if the model fills that corner anyway.
 */
export async function stampLogo(opts: {
  dataUrl: string;
  brand: BrandProfile;
}): Promise<string> {
  const { dataUrl, brand } = opts;
  const [poster, logo] = await Promise.all([
    loadImage(dataUrl),
    loadLogo(brand.logoUrl),
  ]);
  if (!poster || !logo || !logo.width || !logo.height) return dataUrl;

  const canvas = document.createElement("canvas");
  canvas.width = poster.width;
  canvas.height = poster.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(poster, 0, 0);

  const unit = Math.min(poster.width, poster.height);
  // Keep the plate inside the reserved Gemini patch (~22% × 14%).
  // Wide wordmarks used to balloon to 40% of the canvas and cover the title.
  const mark = unit * 0.055;
  const gap = unit * 0.018;
  const logoW = Math.min(mark * (logo.width / logo.height), unit * 0.18);
  const plateW = logoW + gap * 1.4;
  const plateH = mark + gap;

  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.22)";
  ctx.shadowBlur = unit * 0.02;
  ctx.shadowOffsetY = unit * 0.004;
  ctx.fillStyle = brand.accent || "#F7F1DE";
  roundRect(ctx, gap, gap, plateW, plateH, unit * 0.016);
  ctx.fill();
  ctx.restore();

  ctx.drawImage(logo, gap + gap * 0.75, gap + gap * 0.5, logoW, mark);
  // Generated posters are photographic, so PNG would triple the size for no
  // visible gain and makes the save request slow enough to time out.
  return canvas.toDataURL("image/jpeg", 0.92);
}

export async function finishPhoto(opts: {
  src: string;
  logoUrl?: string;
  corner?: "tr" | "tl";
  keepOriginal?: boolean;
}): Promise<string> {
  return opts.src;
}
