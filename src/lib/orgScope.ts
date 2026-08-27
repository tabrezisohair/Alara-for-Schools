import { AsyncLocalStorage } from "async_hooks";
import { getOrganizationId } from "@/lib/auth/membership";

const scope = new AsyncLocalStorage<{ organizationId: string }>();

export function runWithOrganization<T>(organizationId: string, fn: () => T): T {
  return scope.run({ organizationId }, fn);
}

export async function resolveOrganizationId() {
  return scope.getStore()?.organizationId ?? (await getOrganizationId());
}
