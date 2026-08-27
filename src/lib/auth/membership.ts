import { createServerSupabase } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/supabase/env";
import type { MembershipRole } from "@/lib/admin/roles";

export type { MembershipRole };

export type Membership = {
  userId: string;
  email: string | undefined;
  organizationId: string;
  roles: MembershipRole[];
};

export async function getSessionUser() {
  if (!supabaseConfigured()) return null;
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** Signed-in school id, or null when there is no session/membership. */
export async function getOrganizationId() {
  const resolved = await getMembership();
  if ("error" in resolved) return null;
  return resolved.membership.organizationId;
}

export async function requireSession() {
  const user = await getSessionUser();
  if (!supabaseConfigured()) return null;
  if (!user) {
    return Response.json({ error: "Sign in required" }, { status: 401 });
  }
  return user;
}

export async function getMembership(): Promise<
  | { membership: Membership }
  | { error: Response }
> {
  if (!supabaseConfigured()) {
    return {
      error: Response.json(
        { error: "Supabase is not configured" },
        { status: 503 }
      ),
    };
  }

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      error: Response.json({ error: "Sign in required" }, { status: 401 }),
    };
  }

  const { data, error } = await supabase
    .from("organization_memberships")
    .select("organization_id, roles")
    .eq("user_id", user.id);

  if (error) {
    return {
      error: Response.json({ error: error.message }, { status: 500 }),
    };
  }

  if (!data?.length) {
    return {
      error: Response.json(
        { error: "No organization assigned" },
        { status: 403 }
      ),
    };
  }

  if (data.length > 1) {
    return {
      error: Response.json(
        { error: "This account has more than one organization. Phase 1 allows one." },
        { status: 500 }
      ),
    };
  }

  return {
    membership: {
      userId: user.id,
      email: user.email,
      organizationId: data[0].organization_id as string,
      roles: data[0].roles as MembershipRole[],
    },
  };
}

export function isAdmin(roles: MembershipRole[]) {
  return roles.includes("admin");
}

export async function requireSchoolAdmin(): Promise<
  { membership: Membership } | { error: Response }
> {
  const resolved = await getMembership();
  if ("error" in resolved) return resolved;
  if (!isAdmin(resolved.membership.roles)) {
    return {
      error: Response.json({ error: "School admin required" }, { status: 403 }),
    };
  }
  return resolved;
}
