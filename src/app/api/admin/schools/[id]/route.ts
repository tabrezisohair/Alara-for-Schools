import { requireSchoolAdmin } from "@/lib/auth/membership";
import { createServerSupabase } from "@/lib/supabase/server";
import { readDb } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const resolved = await requireSchoolAdmin();
  if ("error" in resolved) return resolved.error;
  const { membership } = resolved;
  const { id } = await context.params;

  if (id !== membership.organizationId) {
    return Response.json(
      { error: "You can only view your own school." },
      { status: 403 }
    );
  }

  const supabase = await createServerSupabase();
  const [{ data: org }, { data: school }, { data: brand }, { data: members }] =
    await Promise.all([
      supabase
        .from("organizations")
        .select("id, name, slug, timezone, created_at")
        .eq("id", membership.organizationId)
        .single(),
      supabase
        .from("school_profiles")
        .select("*")
        .eq("organization_id", membership.organizationId)
        .maybeSingle(),
      supabase
        .from("brand_profiles")
        .select("*")
        .eq("organization_id", membership.organizationId)
        .maybeSingle(),
      supabase
        .from("organization_memberships")
        .select("user_id, roles, created_at")
        .eq("organization_id", membership.organizationId),
    ]);

  if (!org) {
    return Response.json({ error: "Organization not found" }, { status: 404 });
  }

  const userIds = (members ?? []).map((row) => row.user_id);
  const { data: profiles } = userIds.length
    ? await supabase.from("profiles").select("id, full_name, email").in("id", userIds)
    : { data: [] };

  let logoUrl: string | undefined;
  if (brand?.logo_path) {
    const signed = await supabase.storage
      .from("organization-files")
      .createSignedUrl(brand.logo_path, 60 * 60);
    logoUrl = signed.data?.signedUrl;
  }

  const db = await readDb();
  const jobs = db.jobs ?? [];

  return Response.json({
    organization: org,
    status: "active",
    school,
    brand: brand ? { ...brand, logoUrl } : null,
    users: (members ?? []).map((row) => {
      const profile = profiles?.find((item) => item.id === row.user_id);
      return {
        id: row.user_id,
        name: profile?.full_name || profile?.email || "Staff",
        email: profile?.email ?? "",
        roles: row.roles,
        status: "active",
        joinedAt: row.created_at,
      };
    }),
    usage: {
      contentCreated: jobs.length,
      pendingApprovals: jobs.filter((job) => job.status === "review").length,
      publishedContent: jobs.filter((job) => job.status === "published").length,
      contentSource: "workspace_file",
    },
  });
}
