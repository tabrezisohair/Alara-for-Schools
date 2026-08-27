import { requireSchoolAdmin } from "@/lib/auth/membership";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  const resolved = await requireSchoolAdmin();
  if ("error" in resolved) return resolved.error;
  const { membership } = resolved;
  const body = (await request.json()) as { timezone?: string; name?: string };
  const supabase = await createServerSupabase();

  const patch: Record<string, string> = {};
  if (body.timezone?.trim()) patch.timezone = body.timezone.trim();
  if (body.name?.trim()) patch.name = body.name.trim();
  if (!Object.keys(patch).length) {
    return Response.json({ error: "Nothing to save." }, { status: 400 });
  }

  const { error } = await supabase
    .from("organizations")
    .update(patch)
    .eq("id", membership.organizationId);
  if (error) return Response.json({ error: error.message }, { status: 400 });

  return Response.json({ ok: true });
}
