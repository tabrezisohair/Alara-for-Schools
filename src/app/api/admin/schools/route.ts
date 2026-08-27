import { requireSchoolAdmin } from "@/lib/auth/membership";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const resolved = await requireSchoolAdmin();
  if ("error" in resolved) return resolved.error;
  const { membership } = resolved;
  const supabase = await createServerSupabase();

  const { data: org, error } = await supabase
    .from("organizations")
    .select("id, name, slug, timezone, created_at")
    .eq("id", membership.organizationId)
    .single();

  if (error || !org) {
    return Response.json({ error: error?.message || "Not found" }, { status: 404 });
  }

  const { count } = await supabase
    .from("organization_memberships")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", membership.organizationId);

  return Response.json({
    platformAdmin: false,
    canAddSchool: false,
    schools: [
      {
        id: org.id,
        name: org.name,
        slug: org.slug,
        status: "active",
        users: count ?? 0,
        createdAt: org.created_at,
        lastActivity: org.created_at,
      },
    ],
  });
}
