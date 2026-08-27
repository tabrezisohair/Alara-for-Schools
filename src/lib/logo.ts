export const FALLBACK_LOGO = "/brand/cedar-mark.svg";

export function brandLogoSrc(url?: string | null) {
  const trimmed = url?.trim();
  return trimmed || FALLBACK_LOGO;
}
