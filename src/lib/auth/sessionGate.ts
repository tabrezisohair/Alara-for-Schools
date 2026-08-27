import { requireSession } from "./membership";

export async function denyIfSignedOut() {
  const user = await requireSession();
  if (user instanceof Response) return user;
  return null;
}
