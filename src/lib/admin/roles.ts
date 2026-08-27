export type MembershipRole = "creator" | "approver" | "admin";

export const MEMBERSHIP_ROLES: {
  id: MembershipRole;
  label: string;
  hint: string;
}[] = [
  { id: "admin", label: "School Admin", hint: "Manages this school’s people, profile, and brand" },
  { id: "creator", label: "Content Creator", hint: "Creates posts in Alara" },
  { id: "approver", label: "Approver", hint: "Approves posts before they go live" },
];

export const PLANNED_ROLES = [
  { id: "marketing_manager", label: "Marketing Manager" },
  { id: "viewer", label: "Viewer" },
] as const;

export function displayRoles(roles: string[]) {
  return MEMBERSHIP_ROLES.filter((role) => roles.includes(role.id)).map(
    (role) => role.label
  );
}

export function parseRoles(input: unknown): MembershipRole[] | null {
  if (!Array.isArray(input) || input.length === 0) return null;
  const allowed: MembershipRole[] = ["admin", "creator", "approver"];
  const next = input.filter((item): item is MembershipRole =>
    allowed.includes(item as MembershipRole)
  );
  return next.length ? [...new Set(next)] : null;
}
