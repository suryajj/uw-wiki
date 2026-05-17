"use client";

import { useRouter } from "next/navigation";

import { toast } from "@/lib/ui/toast";

type UserRow = { id: string; email: string; display_name: string | null; role: string };
type OrgRow = { id: string; org_name: string; category: string };

export function UsersAdmin({ users, orgs }: { users: UserRow[]; orgs: OrgRow[] }) {
  const router = useRouter();

  async function setRole(userId: string, role: string) {
    const res = await fetch(`/api/admin/users/${userId}/role`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    if (res.ok) {
      toast.success(`Role updated to ${role}.`);
      router.refresh();
    } else {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      toast.error(body.error ?? "Could not update role.");
    }
  }

  async function addAffiliation(userId: string, orgId: string) {
    const res = await fetch(`/api/admin/users/${userId}/affiliations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orgId }),
    });
    if (res.ok) {
      toast.success("Affiliation added.");
      router.refresh();
    } else {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      toast.error(body.error ?? "Could not add affiliation.");
    }
  }

  return (
    <section className="mt-6 space-y-3">
      {users.map((user) => (
        <article key={user.id} className="rounded-lg border border-border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-medium">{user.display_name ?? user.email}</p>
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <select
                defaultValue={user.role}
                onChange={(event) => void setRole(user.id, event.target.value)}
                className="rounded-md border border-border bg-background px-2 py-1"
              >
                <option value="user">user</option>
                <option value="reviewer">reviewer</option>
                <option value="admin">admin</option>
              </select>
              <select
                onChange={(event) => {
                  if (event.target.value) void addAffiliation(user.id, event.target.value);
                  event.target.value = "";
                }}
                className="rounded-md border border-border bg-background px-2 py-1"
                defaultValue=""
              >
                <option value="">Add affiliation...</option>
                {orgs.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.org_name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </article>
      ))}
      {users.length === 0 ? <p className="text-sm text-muted-foreground">No users yet.</p> : null}
    </section>
  );
}
