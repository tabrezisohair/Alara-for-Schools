import { requireSchoolAdmin } from "@/lib/auth/membership";
import { createServerSupabase } from "@/lib/supabase/server";
import { readDb } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const resolved = await requireSchoolAdmin();
  if ("error" in resolved) return resolved.error;
  const { membership } = resolved;
  const supabase = await createServerSupabase();

  const [{ data: org }, { count: userCount }] = await Promise.all([
    supabase
      .from("organizations")
      .select("id, name, slug, timezone, created_at")
      .eq("id", membership.organizationId)
      .single(),
    supabase
      .from("organization_memberships")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", membership.organizationId),
  ]);

  if (!org) {
    return Response.json({ error: "Organization not found" }, { status: 404 });
  }

  const db = await readDb();
  const jobs = db.jobs ?? [];

  return Response.json({
    scope: "school",
    platformAdmin: false,
    organization: org,
    metrics: {
      totalSchools: 1,
      activeSchools: 1,
      totalUsers: userCount ?? 0,
      contentCreated: jobs.length,
      pendingApprovals: jobs.filter((job) => job.status === "review").length,
      publishedContent: jobs.filter((job) => job.status === "published").length,
      contentSource: "workspace_file",
    },
    activity: [],
  });
}
