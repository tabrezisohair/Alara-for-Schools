import { requireSchoolAdmin, type MembershipRole } from "@/lib/auth/membership";
import { parseRoles } from "@/lib/admin/roles";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function adminOrNull() {
  try {
    return createAdminSupabase();
  } catch {
    return null;
  }
}

export async function GET() {
  const resolved = await requireSchoolAdmin();
  if ("error" in resolved) return resolved.error;
  const { membership } = resolved;
  const supabase = await createServerSupabase();

  const { data: members, error } = await supabase
    .from("organization_memberships")
    .select("user_id, roles, created_at")
    .eq("organization_id", membership.organizationId);

  if (error) return Response.json({ error: error.message }, { status: 400 });

  const userIds = (members ?? []).map((row) => row.user_id);
  const { data: profiles } = userIds.length
    ? await supabase.from("profiles").select("id, full_name, email").in("id", userIds)
    : { data: [] };

  const service = adminOrNull();
  const lastLogin = new Map<string, string | null>();
  if (service) {
    for (const id of userIds) {
      const { data } = await service.auth.admin.getUserById(id);
      lastLogin.set(id, data.user?.last_sign_in_at ?? null);
    }
  }

  return Response.json({
    users: (members ?? []).map((row) => {
      const profile = profiles?.find((item) => item.id === row.user_id);
      return {
        id: row.user_id,
        name: profile?.full_name || profile?.email || "Staff",
        email: profile?.email ?? "",
        roles: row.roles as MembershipRole[],
        status: "active",
        lastLogin: lastLogin.get(row.user_id) ?? null,
        joinedAt: row.created_at,
      };
    }),
    inviteSupported: Boolean(service),
  });
}

export async function POST(request: Request) {
  const resolved = await requireSchoolAdmin();
  if ("error" in resolved) return resolved.error;
  const { membership } = resolved;
  const service = adminOrNull();
  if (!service) {
    return Response.json(
      { error: "Invites need a server service-role key. It is not available here." },
      { status: 503 }
    );
  }

  const body = (await request.json()) as {
    email?: string;
    name?: string;
    roles?: string[];
  };
  const email = body.email?.trim().toLowerCase();
  const roles = parseRoles(body.roles ?? ["creator"]);
  if (!email || !roles) {
    return Response.json({ error: "Email and at least one role are required." }, { status: 400 });
  }

  const { data: listed } = await service.auth.admin.listUsers({ perPage: 200 });
  let user = listed.users.find((item) => item.email?.toLowerCase() === email);

  if (!user) {
    const invited = await service.auth.admin.inviteUserByEmail(email, {
      data: { full_name: body.name || "" },
    });
    if (invited.error || !invited.data.user) {
      return Response.json(
        { error: invited.error?.message || "Could not invite that person." },
        { status: 400 }
      );
    }
    user = invited.data.user;
  }

  const { error } = await service.from("organization_memberships").upsert(
    {
      organization_id: membership.organizationId,
      user_id: user.id,
      roles,
    },
    { onConflict: "organization_id,user_id" }
  );
  if (error) return Response.json({ error: error.message }, { status: 400 });

  return Response.json({ ok: true, userId: user.id });
}

export async function PATCH(request: Request) {
  const resolved = await requireSchoolAdmin();
  if ("error" in resolved) return resolved.error;
  const { membership } = resolved;
  const service = adminOrNull();
  if (!service) {
    return Response.json(
      { error: "Role changes need a server service-role key." },
      { status: 503 }
    );
  }

  const body = (await request.json()) as { userId?: string; roles?: string[] };
  const roles = parseRoles(body.roles);
  if (!body.userId || !roles) {
    return Response.json({ error: "User and roles are required." }, { status: 400 });
  }

  if (body.userId === membership.userId && !roles.includes("admin")) {
    return Response.json(
      { error: "You cannot remove your own School Admin role." },
      { status: 400 }
    );
  }

  const { data: existing } = await service
    .from("organization_memberships")
    .select("user_id")
    .eq("organization_id", membership.organizationId)
    .eq("user_id", body.userId)
    .maybeSingle();
  if (!existing) {
    return Response.json({ error: "That person is not on this school." }, { status: 404 });
  }

  const { error } = await service
    .from("organization_memberships")
    .update({ roles })
    .eq("organization_id", membership.organizationId)
    .eq("user_id", body.userId);
  if (error) return Response.json({ error: error.message }, { status: 400 });

  return Response.json({ ok: true });
}

export async function DELETE(request: Request) {
  const resolved = await requireSchoolAdmin();
  if ("error" in resolved) return resolved.error;
  const { membership } = resolved;
  const service = adminOrNull();
  if (!service) {
    return Response.json(
      { error: "Removing a member needs a server service-role key." },
      { status: 503 }
    );
  }

  const body = (await request.json()) as { userId?: string };
  if (!body.userId) {
    return Response.json({ error: "User is required." }, { status: 400 });
  }
  if (body.userId === membership.userId) {
    return Response.json({ error: "You cannot remove yourself." }, { status: 400 });
  }

  const { error } = await service
    .from("organization_memberships")
    .delete()
    .eq("organization_id", membership.organizationId)
    .eq("user_id", body.userId);
  if (error) return Response.json({ error: error.message }, { status: 400 });

  return Response.json({ ok: true });
}
