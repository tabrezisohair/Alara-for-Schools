export function greetingForNow(now = new Date()) {
  const hour = now.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function timeAgo(iso: string, now = new Date()) {
  const then = new Date(iso).getTime();
  const mins = Math.max(0, Math.round((now.getTime() - then) / 60000));
  if (mins < 60) return mins <= 1 ? "Just now" : `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "1 day ago" : `${days} days ago`;
}

export function formatLongDate(iso: string) {
  return formatPosterDate(iso);
}

/** One line, e.g. 2 Sep 2026 */
export function formatCompactDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** One line with weekday, e.g. Sun 6 Dec 2026 */
export function formatPosterDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function roleLabel(roles: string[] | undefined) {
  if (roles?.includes("admin")) return "School Admin";
  if (roles?.includes("approver")) return "Approver";
  if (roles?.includes("creator")) return "Content Creator";
  return "Staff";
}
