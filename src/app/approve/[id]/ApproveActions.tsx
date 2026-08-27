"use client";

import { useState } from "react";

export function ApproveActions({
  jobId,
  token,
}: {
  jobId: string;
  token: string;
}) {
  const [asking, setAsking] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<"approve" | "request_edits" | null>(null);

  async function decide(action: "approve" | "request_edits") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/approve/${jobId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, action, note }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || "Could not save that");
      setDone(action);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save that");
    } finally {
      setBusy(false);
    }
  }

  if (done === "approve") {
    return (
      <p className="mt-6 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-900">
        Approved. The school office has been told and will publish it.
      </p>
    );
  }

  if (done === "request_edits") {
    return (
      <p className="mt-6 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">
        Thank you. The office has your note and will send a new version.
      </p>
    );
  }

  return (
    <div className="mt-6 space-y-3">
      {asking ? (
        <div className="space-y-3 rounded-2xl border border-[var(--line)] bg-white p-4">
          <label className="block text-sm">
            What should change?
            <textarea
              className="field mt-1 min-h-24"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Use the Friday date, and the time should be 9am."
            />
          </label>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="btn-primary"
              disabled={busy}
              onClick={() => decide("request_edits")}
            >
              {busy ? "Sending…" : "Send to the office"}
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={busy}
              onClick={() => setAsking(false)}
            >
              Back
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className="btn-primary"
            disabled={busy}
            onClick={() => decide("approve")}
          >
            {busy ? "Saving…" : "Approve"}
          </button>
          <button
            type="button"
            className="btn-secondary"
            disabled={busy}
            onClick={() => setAsking(true)}
          >
            Ask for changes
          </button>
        </div>
      )}
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
    </div>
  );
}
