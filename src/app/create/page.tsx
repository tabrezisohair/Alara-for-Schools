"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/** Old /create links redirect to Home (create flow lives on /). */
function CreateRedirect() {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    const q = params.toString();
    router.replace(q ? `/?${q}` : "/");
  }, [params, router]);

  return <p className="text-sm text-[var(--muted)]">Opening…</p>;
}

export default function CreatePage() {
  return (
    <Suspense fallback={<p className="text-sm text-[var(--muted)]">Opening…</p>}>
      <CreateRedirect />
    </Suspense>
  );
}
