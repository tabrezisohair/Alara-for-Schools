"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Database } from "@/lib/types";
import type { WorkspacePayload } from "@/lib/auth/workspace";

type AlaraValue = {
  db: Database | null;
  workspace: WorkspacePayload | null;
  noOrganization: boolean;
  error: string | null;
  reload: () => Promise<void>;
  setDb: (db: Database | null) => void;
};

const AlaraContext = createContext<AlaraValue | null>(null);

export function AlaraProvider({ children }: { children: ReactNode }) {
  const value = useAlaraState();
  return <AlaraContext.Provider value={value}>{children}</AlaraContext.Provider>;
}

export function useAlara() {
  const ctx = useContext(AlaraContext);
  if (!ctx) {
    throw new Error("useAlara must be used inside AlaraProvider");
  }
  return ctx;
}

function useAlaraState(): AlaraValue {
  const [db, setDb] = useState<Database | null>(null);
  const [workspace, setWorkspace] = useState<WorkspacePayload | null>(null);
  const [noOrganization, setNoOrganization] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    const stateRes = await fetch("/api/state", { cache: "no-store" });
    if (stateRes.status === 401) {
      window.location.href = "/login";
      return;
    }
    if (!stateRes.ok) throw new Error("Could not load Alara");
    const state = (await stateRes.json()) as Database;

    const wsRes = await fetch("/api/workspace", { cache: "no-store" });
    if (wsRes.status === 401) {
      window.location.href = "/login";
      return;
    }
    if (wsRes.status === 403) {
      setWorkspace(null);
      setDb(null);
      setNoOrganization(true);
      setError(null);
      return;
    }
    if (wsRes.ok) {
      const next = (await wsRes.json()) as WorkspacePayload;
      setWorkspace(next);
      setDb(applyWorkspace(state, next));
      setNoOrganization(false);
      setError(null);
      return;
    }

    setWorkspace(null);
    setDb(state);
    setNoOrganization(false);
    setError(null);
  }

  useEffect(() => {
    reload().catch((err: Error) => setError(err.message));
  }, []);

  return { db, workspace, noOrganization, error, reload, setDb };
}

function applyWorkspace(db: Database, workspace: WorkspacePayload): Database {
  return {
    ...db,
    school: workspace.school,
    brand: workspace.brand,
    tone: workspace.tone,
    vocab: workspace.vocab,
    captionLanguageDefault: workspace.captionLanguageDefault,
    posterLanguageDefault: workspace.posterLanguageDefault,
    whatsappBilingual: workspace.whatsappBilingual,
  };
}

export async function deleteRecord(url: string) {
  const res = await fetch(url, { method: "DELETE" });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || "Could not delete");
  return body;
}

export async function putState(patch: Partial<Database>) {
  const res = await fetch("/api/state", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error("Save failed");
  return res.json() as Promise<Database>;
}

export async function patchWorkspace(body: {
  school?: Partial<Database["school"]>;
  brand?: Partial<Database["brand"]>;
  tone?: Partial<Database["tone"]>;
  captionLanguageDefault?: Database["captionLanguageDefault"];
  posterLanguageDefault?: Database["posterLanguageDefault"];
  whatsappBilingual?: boolean;
}) {
  const res = await fetch("/api/workspace", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    throw new Error(payload.error || "Could not save school Brain");
  }
  return res.json() as Promise<WorkspacePayload>;
}
