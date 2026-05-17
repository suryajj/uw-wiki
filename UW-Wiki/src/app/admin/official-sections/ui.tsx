"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { useAction } from "@/lib/ui/use-action";

type Org = { id: string; org_name: string; org_slug: string; category: string };

export function OfficialSeeder({ orgs }: { orgs: Org[] }) {
  const router = useRouter();
  const [orgId, setOrgId] = useState(orgs[0]?.id ?? "");
  const [body, setBody] = useState("");

  const seedAction = useAction(
    async () => {
      const res = await fetch(`/api/admin/official-sections/${orgId}/seed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Official", body }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Failed to publish.");
    },
    {
      successMessage: "Official section published.",
      onSuccess: () => router.refresh(),
    },
  );

  return (
    <section className="mt-6 rounded-lg border border-border bg-card p-4">
      <label className="block text-sm">
        Organization
        <select
          value={orgId}
          onChange={(event) => setOrgId(event.target.value)}
          className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2"
        >
          {orgs.map((org) => (
            <option key={org.id} value={org.id}>
              {org.org_name} ({org.category})
            </option>
          ))}
        </select>
      </label>
      <label className="mt-4 block text-sm">
        Official content
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          className="mt-1 min-h-40 w-full rounded-md border border-border bg-background p-3"
        />
      </label>
      <Button
        className="mt-4"
        loading={seedAction.pending}
        disabled={!orgId || body.trim().length === 0}
        onClick={() => seedAction.run()}
      >
        Publish Official Section
      </Button>
    </section>
  );
}
