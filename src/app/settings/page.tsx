"use client";

import { useEffect, useState } from "react";
import { deleteRecord, useAlara, putState } from "@/lib/useAlara";
import { PageHeader } from "@/components/PageHeader";
import { ConfirmDialog } from "@/components/ConfirmDialog";

type MailStatus = {
  googleReady: boolean;
  microsoftReady: boolean;
  connected: boolean;
  provider: "google" | "microsoft" | null;
  fromEmail: string;
};

export default function SettingsPage() {
  const { db, error, setDb, reload } = useAlara();
  const [status, setStatus] = useState<MailStatus | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<
    | { kind: "disconnect" }
    | { kind: "notification"; id: string; subject: string }
    | null
  >(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetch("/api/email/status")
      .then((res) => res.json())
      .then(setStatus)
      .catch(() => setStatus(null));
    const q = new URLSearchParams(window.location.search);
    const result = q.get("email");
    if (result === "connected") setBanner("Mailbox connected. Test emails will go to the Head.");
    if (result === "setup") {
      setBanner("Add that provider’s keys to .env.local, restart the app, then connect again.");
    }
    if (result === "error") {
      setBanner(`Could not connect: ${q.get("reason") || "try again"}.`);
    }
  }, []);

  if (error) return <p>{error}</p>;
  if (!db) return <p>Loading…</p>;
  const data = db;
  const provider = db.email.provider;
  const ready =
    provider === "google"
      ? status?.googleReady
      : provider === "microsoft"
        ? status?.microsoftReady
        : false;
  const queued = db.notifications.filter((item) => item.status === "queued").length;

  async function saveEmail(patch: Partial<typeof data.email>) {
    const next = await putState({ email: { ...data.email, ...patch } });
    setDb(next);
  }

  async function test() {
    setBusy(true);
    try {
      await fetch("/api/email/test", { method: "POST" });
      await reload();
    } finally {
      setBusy(false);
    }
  }

  async function flush() {
    setBusy(true);
    try {
      const res = await fetch("/api/email/flush", { method: "POST" });
      const body = await res.json();
      if (!res.ok) setBanner(body.error || "Could not send queued mail");
      await reload();
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    setBusy(true);
    try {
      await fetch("/api/email/oauth/disconnect", { method: "POST" });
      await reload();
      const next = await fetch("/api/email/status").then((res) => res.json());
      setStatus(next);
      setBanner("Mailbox disconnected. New emails will stay in the outbox.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        kicker="Settings"
        title="Email and publishing"
        description="When a post is live, Alara can email the Head. Voice cannot approve or send."
      />

      {banner ? (
        <p className="rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm">
          {banner}
        </p>
      ) : null}

      <section className="card space-y-3">
        <h2 className="font-medium">Head email</h2>
        <p className="text-sm text-[var(--muted)]">
          When a post is actually live, Alara emails the Head the graphic and caption. Voice cannot send mail. Approval cannot happen by reply.
        </p>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={db.email.enabled}
            onChange={(e) => saveEmail({ enabled: e.target.checked })}
          />
          Email notifications on
        </label>
        <label className="block text-sm">
          Head email
          <input
            className="field mt-1"
            value={db.email.headEmail}
            onChange={(e) => saveEmail({ headEmail: e.target.value })}
            placeholder="principal@cedar.edu.pk"
          />
        </label>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => saveEmail({ provider: "google" })}
          >
            Use Gmail
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => saveEmail({ provider: "microsoft" })}
          >
            Use Outlook
          </button>
        </div>
        <p className="text-xs text-[var(--muted)]">
          {db.email.connected
            ? `Connected as ${db.email.fromEmail || "the school mailbox"} via ${
                db.email.provider === "google" ? "Gmail" : "Outlook"
              }.`
            : provider
              ? `${provider === "google" ? "Gmail" : "Outlook"} selected. Connect the school mailbox to send, or emails stay in the outbox.`
              : "Choose Gmail or Outlook."}
        </p>
        <div className="flex flex-wrap gap-3">
          {provider && !db.email.connected ? (
            <a
              className="btn-primary inline-block"
              href={`/api/email/oauth/start?provider=${provider}`}
            >
              Connect {provider === "google" ? "Gmail" : "Outlook"}
            </a>
          ) : null}
          {db.email.connected ? (
            <button
              type="button"
              className="btn-secondary"
              disabled={busy}
              onClick={() => setPending({ kind: "disconnect" })}
            >
              Disconnect mailbox
            </button>
          ) : null}
        </div>
        {provider && status && !ready && !db.email.connected ? (
          <SetupHelp provider={provider} />
        ) : null}
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={db.email.notifyLive}
            onChange={(e) => saveEmail({ notifyLive: e.target.checked })}
          />
          Email when a post is live
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={db.email.notifyApproval}
            onChange={(e) => saveEmail({ notifyApproval: e.target.checked })}
          />
          Email when a post needs approval
        </label>
        <div className="flex flex-wrap gap-3">
          <button type="button" className="btn-primary" disabled={busy} onClick={test}>
            {db.email.connected ? "Send test to Head" : "Send test email to outbox"}
          </button>
          {queued && db.email.connected ? (
            <button type="button" className="btn-secondary" disabled={busy} onClick={flush}>
              Send {queued} queued
            </button>
          ) : null}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="font-medium">Outbox</h2>
        {db.notifications.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No emails yet.</p>
        ) : (
          db.notifications.map((n) => (
            <article key={n.id} className="card text-sm">
              <div className="flex items-start justify-between gap-3">
                <p className="font-medium">{n.subject}</p>
                {n.status !== "sent" ? (
                  <button
                    type="button"
                    className="btn-delete shrink-0"
                    onClick={() =>
                      setPending({
                        kind: "notification",
                        id: n.id,
                        subject: n.subject,
                      })
                    }
                  >
                    Delete
                  </button>
                ) : null}
              </div>
              <p className="text-[var(--muted)]">
                To {n.to} · {n.status} · {n.type}
              </p>
              {n.error ? <p className="mt-1 text-rose-700">{n.error}</p> : null}
              <pre className="mt-2 whitespace-pre-wrap text-xs">{n.body}</pre>
              {n.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={n.imageUrl} alt="" className="mt-2 max-w-xs rounded" />
              ) : null}
            </article>
          ))
        )}
      </section>

      <ConfirmDialog
        open={Boolean(pending)}
        title={
          pending?.kind === "disconnect"
            ? "Disconnect the mailbox?"
            : "Delete this outbox email?"
        }
        confirmLabel={pending?.kind === "disconnect" ? "Disconnect" : "Delete"}
        busy={deleting || busy}
        onCancel={() => {
          if (!deleting && !busy) setPending(null);
        }}
        onConfirm={async () => {
          if (!pending) return;
          if (pending.kind === "disconnect") {
            setPending(null);
            await disconnect();
            return;
          }
          setDeleting(true);
          try {
            await deleteRecord(`/api/notifications/${pending.id}`);
            setPending(null);
            await reload();
          } catch (err) {
            setBanner(err instanceof Error ? err.message : "Could not delete");
          } finally {
            setDeleting(false);
          }
        }}
      >
        {pending?.kind === "disconnect" ? (
          <p>
            Disconnect the school mailbox? New Head emails will stay in the
            outbox until you connect again.
          </p>
        ) : (
          <p>
            Delete <span className="font-semibold">{pending?.subject}</span> from
            the outbox? Sent emails stay as a record.
          </p>
        )}
      </ConfirmDialog>
    </div>
  );
}

function SetupHelp({ provider }: { provider: "google" | "microsoft" }) {
  const origin =
    typeof window !== "undefined" ? window.location.origin : "http://localhost:3001";
  const redirect = `${origin}/api/email/oauth/callback`;
  return (
    <div className="rounded-md border border-[var(--line)] bg-[var(--paper)] p-3 text-sm">
      <p className="font-medium">
        {provider === "google" ? "Gmail" : "Outlook"} keys are not in this app yet.
      </p>
      <p className="mt-2 text-[var(--muted)]">
        Add them to <code>.env.local</code> in the school-alara folder, then restart{" "}
        <code>npm run dev</code>. Redirect URI to register:
      </p>
      <p className="mt-2 break-all font-mono text-xs">{redirect}</p>
      {provider === "google" ? (
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-[var(--muted)]">
          <li>Google Cloud → enable Gmail API</li>
          <li>OAuth consent screen, then Web client credentials</li>
          <li>
            Put <code>GOOGLE_CLIENT_ID</code> and <code>GOOGLE_CLIENT_SECRET</code> in{" "}
            <code>.env.local</code>
          </li>
        </ol>
      ) : (
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-[var(--muted)]">
          <li>Microsoft Entra → App registration, type Web</li>
          <li>Add a client secret and Mail.Send + User.Read permissions</li>
          <li>
            Put <code>MICROSOFT_CLIENT_ID</code> and <code>MICROSOFT_CLIENT_SECRET</code> in{" "}
            <code>.env.local</code>
          </li>
        </ol>
      )}
    </div>
  );
}
