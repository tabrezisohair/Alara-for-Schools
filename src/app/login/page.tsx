"use client";

import { useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
        throw new Error("Supabase is not configured on this server.");
      }
      const supabase = createBrowserSupabase();
      const loginEmail =
        email.trim().toLowerCase() === "admin"
          ? "admin@cedar.local"
          : email.trim();
      const { error: signError } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password,
      });
      if (signError) throw signError;
      // Full navigation so middleware reads the new session cookies (needed on phone WebView).
      window.location.assign("/");
      return;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="text-white">
        <p className="text-[11px] font-bold tracking-[0.22em] text-[var(--gold)]">ALARA</p>
        <h1 className="mt-2 text-4xl font-extrabold">for Schools</h1>
        <p className="mt-3 text-sm text-white/75">
          Staff accounts belong to one school. Ask an admin if you do not have access.
        </p>
      </div>
      <form className="card space-y-4" onSubmit={submit}>
        <label className="block text-sm font-medium">
          Email
          <input
            className="field mt-1"
            type="text"
            inputMode="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label className="block text-sm font-medium">
          Password
          <input
            className="field mt-1"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {error ? <p className="text-sm text-rose-700">{error}</p> : null}
        <button className="btn-primary w-full" type="submit" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
