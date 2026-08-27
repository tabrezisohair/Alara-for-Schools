"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/client";
import { AlaraProvider, useAlara } from "@/lib/useAlara";
import { initials, roleLabel } from "@/lib/ui";
import { SchoolLogo } from "./SchoolLogo";
import { AndroidBackHandler } from "./AndroidBackHandler";
import {
  IconBell,
  IconBrain,
  IconCalendar,
  IconCampaigns,
  IconHelp,
  IconHome,
  IconLibrary,
  IconMore,
  IconPerformance,
  IconSettings,
  IconShield,
} from "./icons";

const NAV = [
  { href: "/", label: "Home", Icon: IconHome },
  { href: "/library", label: "Library", Icon: IconLibrary },
  { href: "/calendar", label: "Calendar", Icon: IconCalendar },
  { href: "/campaigns", label: "Campaigns", Icon: IconCampaigns },
  { href: "/performance", label: "Performance", Icon: IconPerformance },
  { href: "/brain", label: "School Brain", Icon: IconBrain },
  { href: "/admin", label: "Admin", Icon: IconShield, adminOnly: true },
  { href: "/settings", label: "Settings", Icon: IconSettings },
];

const MOBILE_TABS = [
  {
    href: "/",
    label: "Home",
    Icon: IconHome,
    accent: "#102a56",
    soft: "rgba(16, 42, 86, 0.12)",
  },
  {
    href: "/library",
    label: "Library",
    Icon: IconLibrary,
    accent: "#6D28D9",
    soft: "rgba(109, 40, 217, 0.12)",
  },
  {
    href: "/calendar",
    label: "Calendar",
    Icon: IconCalendar,
    accent: "#0F766E",
    soft: "rgba(15, 118, 110, 0.12)",
  },
];

const MORE_ACCENT = "#B45309";
const MORE_SOFT = "rgba(180, 83, 9, 0.12)";

function navActive(path: string, href: string) {
  return href === "/" ? path === "/" : path.startsWith(href);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  if (path === "/login") {
    return (
      <div className="min-h-dvh bg-[linear-gradient(180deg,#102a56_0%,#1b3d74_42%,#f4f6fb_42%)] text-[var(--ink)]">
        <main className="mx-auto max-w-md px-4 py-16">{children}</main>
      </div>
    );
  }

  // The approver arrives from a link with no Alara account, so no workspace
  // chrome and no state fetch that would bounce them to the login page.
  if (path.startsWith("/approve/")) {
    return (
      <div className="min-h-dvh bg-[var(--paper)] text-[var(--ink)]">
        <main className="mx-auto max-w-xl px-4 py-8">{children}</main>
      </div>
    );
  }

  return (
    <AlaraProvider>
      <AndroidBackHandler />
      <AppChrome>{children}</AppChrome>
    </AlaraProvider>
  );
}

function AppChrome({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const { db, workspace, noOrganization } = useAlara();
  const [helpOpen, setHelpOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  const orgName = workspace?.organization.name ?? db?.school.name ?? "";
  const campus = db?.school.campuses[0] ? `${db.school.campuses[0]} Campus` : "School workspace";
  const logo = db?.brand.logoUrl;
  const staffName =
    workspace?.membership.email?.split("@")[0] ||
    db?.users.creatorName ||
    "Staff";
  const prettyName = staffName
    .replace(/[._]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
  const role = roleLabel(workspace?.roles);
  const unread = db?.notifications.filter((n) => n.status === "queued").length ?? 0;
  const canAdmin = workspace?.roles.includes("admin") ?? false;
  const navItems = NAV.filter((item) => !item.adminOnly || canAdmin);
  const moreItems = navItems.filter(
    (item) => !MOBILE_TABS.some((tab) => tab.href === item.href)
  );
  const moreActive = moreItems.some((item) => navActive(path, item.href));

  function closeMenus() {
    setNotesOpen(false);
    setUserOpen(false);
    setMoreOpen(false);
  }

  function openHelp() {
    closeMenus();
    setHelpOpen((v) => !v);
  }

  async function signOut() {
    const supabase = createBrowserSupabase();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  // After 2 minutes idle, refresh once to Home (phone / desk).
  const idleArmed = useRef(true);
  useEffect(() => {
    const IDLE_MS = 2 * 60 * 1000;
    let timer: ReturnType<typeof setTimeout> | undefined;

    function goHome() {
      if (!idleArmed.current) return;
      idleArmed.current = false;
      window.location.assign("/");
    }

    function bump() {
      if (timer) clearTimeout(timer);
      timer = setTimeout(goHome, IDLE_MS);
    }

    const events = [
      "pointerdown",
      "pointermove",
      "keydown",
      "touchstart",
      "scroll",
      "visibilitychange",
    ] as const;
    for (const name of events) {
      window.addEventListener(name, bump, { passive: true });
    }
    bump();

    return () => {
      if (timer) clearTimeout(timer);
      for (const name of events) {
        window.removeEventListener(name, bump);
      }
    };
  }, []);

  const sidebar = useMemo(
    () => (
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-[var(--navy)] text-white md:flex">
        <div className="px-6 py-7">
          <p className="text-[11px] font-bold tracking-[0.22em] text-[var(--gold)]">ALARA</p>
          <p className="mt-1 text-xl font-semibold">for Schools</p>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3">
          {navItems.map((item) => {
            const active = navActive(path, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm ${
                  active
                    ? "bg-white/12 text-white shadow-[inset_3px_0_0_#e8b923]"
                    : "text-white/70 hover:bg-white/6 hover:text-white"
                }`}
              >
                <item.Icon className="h-[18px] w-[18px]" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="space-y-3 px-4 pb-5">
          <div className="rounded-2xl bg-white px-3 py-3">
            <SchoolLogo
              src={logo}
              alt={orgName || "School logo"}
              className="h-9 w-auto max-w-full object-contain"
            />
            <p className="mt-2 truncate text-xs text-[var(--navy)]/55">{campus}</p>
          </div>
          <button
            type="button"
            className="flex w-full items-center gap-3 rounded-2xl bg-[#163666] px-3 py-3 text-left text-sm text-white/90"
            onClick={openHelp}
          >
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--gold)] text-[var(--navy)]">
              <IconHelp className="h-4 w-4" />
            </span>
            Need help? Chat with Alara
          </button>
        </div>
      </aside>
    ),
    [campus, logo, navItems, orgName, path]
  );

  if (noOrganization) {
    return (
      <div className="min-h-dvh bg-[var(--paper)] text-[var(--ink)]">
        <main className="mx-auto max-w-md px-4 py-16">
          <p className="kicker">Alara for Schools</p>
          <h1 className="page-title">No organization assigned</h1>
          <p className="mt-3 text-sm text-[var(--muted)]">
            This account is signed in, but it is not linked to a school yet. Ask an
            admin to add you.
          </p>
          <button className="btn-primary mt-6" type="button" onClick={signOut}>
            Sign out
          </button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-[var(--paper)] text-[var(--ink)]">
      {sidebar}
      <div className="md:pl-64">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-[var(--line)] bg-[var(--paper)]/90 px-4 pb-3 backdrop-blur pt-[max(0.75rem,env(safe-area-inset-top))] md:px-8 md:pt-3 xl:px-10">
          <div className="md:hidden">
            <p className="text-xs font-bold tracking-[0.18em] text-[var(--navy)]">ALARA</p>
            <p className="text-sm font-semibold">{orgName}</p>
          </div>
          <div className="ml-auto flex items-center gap-2 md:gap-3">
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--gold)] text-[var(--navy)] md:hidden"
              onClick={openHelp}
              aria-label="Need help"
            >
              <IconHelp className="h-5 w-5" />
            </button>
            <div className="relative">
              <button
                type="button"
                className="relative rounded-full border border-[var(--line)] bg-white p-2"
                onClick={() => {
                  setNotesOpen((v) => !v);
                  setUserOpen(false);
                  setMoreOpen(false);
                }}
                aria-label="Notifications"
              >
                <IconBell className="h-5 w-5 text-[var(--navy)]" />
                {unread ? (
                  <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] text-white">
                    {unread}
                  </span>
                ) : null}
              </button>
              {notesOpen ? (
                <div className="absolute right-0 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-2xl border border-[var(--line)] bg-white p-3 shadow-xl">
                  <p className="text-sm font-semibold">Notifications</p>
                  <div className="mt-2 space-y-2">
                    {(db?.notifications.slice(0, 5) ?? []).length ? (
                      db?.notifications.slice(0, 5).map((note) => (
                        <p key={note.id} className="text-xs text-[var(--muted)]">
                          {note.subject}
                        </p>
                      ))
                    ) : (
                      <p className="text-xs text-[var(--muted)]">Nothing waiting right now.</p>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
            <div className="relative">
              <button
                type="button"
                className="flex items-center gap-2 rounded-full border border-[var(--line)] bg-white py-1 pl-1 pr-1 sm:pr-3"
                onClick={() => {
                  setUserOpen((v) => !v);
                  setNotesOpen(false);
                  setMoreOpen(false);
                }}
              >
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--navy)] text-xs font-semibold text-white">
                  {initials(prettyName) || "A"}
                </span>
                <span className="hidden text-left sm:block">
                  <span className="block text-sm font-semibold leading-tight">{prettyName}</span>
                  <span className="block text-[11px] text-[var(--muted)]">{role}</span>
                </span>
              </button>
              {userOpen ? (
                <div className="absolute right-0 mt-2 w-48 rounded-2xl border border-[var(--line)] bg-white p-2 shadow-xl">
                  {canAdmin ? (
                    <Link
                      href="/admin"
                      className="block rounded-xl px-3 py-2 text-sm hover:bg-slate-50"
                      onClick={() => setUserOpen(false)}
                    >
                      Admin
                    </Link>
                  ) : null}
                  <Link
                    href="/settings"
                    className="block rounded-xl px-3 py-2 text-sm hover:bg-slate-50"
                    onClick={() => setUserOpen(false)}
                  >
                    Settings
                  </Link>
                  <button
                    type="button"
                    className="block w-full rounded-xl px-3 py-2 text-left text-sm text-rose-700 hover:bg-rose-50"
                    onClick={signOut}
                  >
                    Log out
                  </button>
                </div>
              ) : null}
            </div>
            <button
              type="button"
              className="btn-secondary hidden md:inline-flex"
              onClick={signOut}
            >
              Log out
            </button>
          </div>
        </header>
        <main className="w-full px-4 py-6 pb-[calc(5.75rem+env(safe-area-inset-bottom))] md:px-8 md:py-8 md:pb-8 xl:px-10">
          {children}
        </main>
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--line)] bg-white/95 px-1.5 pt-1.5 backdrop-blur touch-manipulation md:hidden"
        style={{ paddingBottom: "max(0.35rem, env(safe-area-inset-bottom))" }}
        aria-label="Main"
      >
        <div className="grid grid-cols-4 gap-0.5">
          {MOBILE_TABS.map((item) => {
            const active = navActive(path, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={closeMenus}
                className="flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-semibold transition-colors"
                style={{
                  color: active ? item.accent : "var(--muted)",
                  background: active ? item.soft : "transparent",
                }}
              >
                <span style={{ color: item.accent }}>
                  <item.Icon className="h-5 w-5" />
                </span>
                {item.label}
              </Link>
            );
          })}
          <button
            type="button"
            className="flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-semibold transition-colors"
            style={{
              color: moreOpen || moreActive ? MORE_ACCENT : "var(--muted)",
              background: moreOpen || moreActive ? MORE_SOFT : "transparent",
            }}
            onClick={() => {
              setMoreOpen((v) => !v);
              setNotesOpen(false);
              setUserOpen(false);
              setHelpOpen(false);
            }}
          >
            <span style={{ color: MORE_ACCENT }}>
              <IconMore className="h-5 w-5" />
            </span>
            More
          </button>
        </div>
      </nav>

      {moreOpen ? (
        <div className="fixed inset-0 z-40 md:hidden" role="presentation">
          <button
            type="button"
            className="absolute inset-0 bg-[var(--navy)]/40"
            aria-label="Close menu"
            onClick={() => setMoreOpen(false)}
          />
          <div
            role="dialog"
            aria-label="More"
            className="absolute inset-x-0 bottom-0 rounded-t-3xl border border-[var(--line)] bg-white p-4 shadow-2xl"
            style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
          >
            <p className="mb-3 text-sm font-semibold text-[var(--navy)]">More</p>
            <div className="grid grid-cols-2 gap-2">
              {moreItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMoreOpen(false)}
                  className={`flex items-center gap-2 rounded-2xl border px-3 py-3 text-sm font-semibold ${
                    navActive(path, item.href)
                      ? "border-[var(--navy)] bg-[var(--paper)] text-[var(--navy)]"
                      : "border-[var(--line)] text-[var(--navy)]"
                  }`}
                >
                  <item.Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              ))}
              <button
                type="button"
                className="flex items-center gap-2 rounded-2xl border border-[var(--line)] px-3 py-3 text-left text-sm font-semibold text-[var(--navy)]"
                onClick={() => {
                  setMoreOpen(false);
                  setHelpOpen(true);
                }}
              >
                <IconHelp className="h-4 w-4" />
                Need help
              </button>
            </div>
            <p className="mt-4 text-xs text-[var(--muted)]">
              Add to Home Screen for the full-screen app: on iPhone, Share then
              Add to Home Screen. On Android, the browser menu then Install app
              or Add to Home screen.
            </p>
          </div>
        </div>
      ) : null}

      {helpOpen ? (
        <div
          className="fixed z-40 mx-4 rounded-2xl border border-[var(--line)] bg-white p-4 shadow-2xl left-4 right-4 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] md:left-72 md:right-auto md:bottom-6 md:w-80"
        >
          <p className="font-semibold text-[var(--navy)]">How Alara works</p>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Pick what you want to communicate. Alara drafts the post. Nothing goes
            out until someone approves it.
          </p>
          <div className="mt-3 flex gap-2">
            <Link href="/" className="btn-primary" onClick={() => setHelpOpen(false)}>
              Create a post
            </Link>
            <button type="button" className="btn-secondary" onClick={() => setHelpOpen(false)}>
              Close
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
