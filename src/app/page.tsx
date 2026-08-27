"use client";

import { Suspense } from "react";
import { CreateWizard } from "@/components/CreateWizard";
import { useAlara } from "@/lib/useAlara";

function HomeInner() {
  const { db, error } = useAlara();
  if (error) return <p>{error}</p>;
  if (!db) return <p className="text-sm text-[var(--muted)]">Loading workspace…</p>;
  return <CreateWizard db={db} />;
}

export default function HomePage() {
  return (
    <Suspense fallback={<p className="text-sm text-[var(--muted)]">Loading…</p>}>
      <HomeInner />
    </Suspense>
  );
}
