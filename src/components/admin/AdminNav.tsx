"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/schools", label: "Schools" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/school-profile", label: "School Profile" },
  { href: "/admin/brand", label: "Brand" },
  { href: "/admin/content-settings", label: "Content Settings" },
  { href: "/admin/audit-log", label: "Audit Log" },
  { href: "/admin/settings", label: "Settings" },
];

export function AdminNav() {
  const path = usePathname();
  return (
    <nav className="flex flex-wrap gap-2">
      {ITEMS.map((item) => {
        const active =
          item.href === "/admin" ? path === "/admin" : path.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-full px-3 py-1.5 text-sm font-semibold ${
              active
                ? "bg-[var(--navy)] text-white"
                : "bg-white text-[var(--navy)] shadow-[var(--shadow)]"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
