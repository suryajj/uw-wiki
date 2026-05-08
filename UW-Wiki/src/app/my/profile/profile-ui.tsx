"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import type { NotificationPreferences } from "@/types/domain";

type Org = {
  id: string;
  org_name: string;
  org_slug: string;
  category: string;
};

type Affiliation = {
  id: string;
  role_label: string | null;
  organizations: Org | Org[] | null;
};

export function AffiliationManager({
  orgs,
  initialAffiliations,
}: {
  orgs: Org[];
  initialAffiliations: Affiliation[];
}) {
  const [filter, setFilter] = useState("");
  const [selectedOrgId, setSelectedOrgId] = useState(orgs[0]?.id ?? "");
  const [roleLabel, setRoleLabel] = useState("");
  const [affiliations, setAffiliations] = useState(initialAffiliations);
  const [message, setMessage] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = filter.toLowerCase().trim();
    if (!q) return orgs;
    return orgs.filter(
      (org) =>
        org.org_name.toLowerCase().includes(q) ||
        org.org_slug.toLowerCase().includes(q),
    );
  }, [orgs, filter]);

  async function add() {
    if (!selectedOrgId) return;
    const res = await fetch("/api/me/affiliations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orgId: selectedOrgId, roleLabel: roleLabel || undefined }),
    });
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setMessage(body.error ?? "Could not add affiliation.");
      return;
    }
    setMessage("Affiliation added.");
    window.location.reload();
  }

  async function remove(orgId: string) {
    const res = await fetch(`/api/me/affiliations/${orgId}`, { method: "DELETE" });
    if (res.ok) {
      setAffiliations((items) =>
        items.filter((item) => normalizeOrg(item.organizations)?.id !== orgId),
      );
      setMessage("Affiliation removed.");
    }
  }

  return (
    <section className="mt-6 space-y-6">
      <div className="rounded-lg border border-border bg-card p-4">
        <h2 className="font-semibold">Add affiliation</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr]">
          <input
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Search organizations..."
            className="rounded-md border border-border bg-background px-3 py-2"
          />
          <select
            value={selectedOrgId}
            onChange={(event) => setSelectedOrgId(event.target.value)}
            className="rounded-md border border-border bg-background px-3 py-2"
          >
            {filtered.map((org) => (
              <option key={org.id} value={org.id}>
                {org.org_name} ({org.category})
              </option>
            ))}
          </select>
          <input
            value={roleLabel}
            onChange={(event) => setRoleLabel(event.target.value)}
            placeholder="Role label (optional)"
            className="rounded-md border border-border bg-background px-3 py-2"
          />
          <Button type="button" onClick={add}>
            Add Affiliation
          </Button>
        </div>
        {message ? <p className="mt-3 text-sm text-muted-foreground">{message}</p> : null}
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <h2 className="font-semibold">Current affiliations</h2>
        <div className="mt-3 space-y-2">
          {affiliations.length === 0 ? (
            <p className="text-sm text-muted-foreground">No affiliations yet.</p>
          ) : (
            affiliations.map((affiliation) => {
              const org = normalizeOrg(affiliation.organizations);
              if (!org) return null;
              return (
                <div
                  key={affiliation.id}
                  className="flex items-center justify-between rounded-md border border-border px-3 py-2"
                >
                  <div>
                    <p className="font-medium">{org.org_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {affiliation.role_label ?? "Member"} · {org.category}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => remove(org.id)}>
                    Remove
                  </Button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
}

function normalizeOrg(org: Org | Org[] | null): Org | null {
  if (!org) return null;
  return Array.isArray(org) ? org[0] ?? null : org;
}

export function NotificationPreferencesForm({
  initialPreferences,
}: {
  initialPreferences: NotificationPreferences;
}) {
  const [prefs, setPrefs] = useState(initialPreferences);
  const [message, setMessage] = useState<string | null>(null);

  async function save(next: NotificationPreferences) {
    setPrefs(next);
    const res = await fetch("/api/me/notification-preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        inAppPrStatus: next.inAppPrStatus,
        emailPrStatus: next.emailPrStatus,
        inAppCommentReply: next.inAppCommentReply,
        emailCommentReply: next.emailCommentReply,
        inAppPageUpdate: next.inAppPageUpdate,
        emailPageUpdateDigest: next.emailPageUpdateDigest,
        pageUpdateDigestFrequency: next.pageUpdateDigestFrequency,
      }),
    });
    setMessage(res.ok ? "Notification preferences saved." : "Could not save preferences.");
  }

  return (
    <section className="mt-6 rounded-lg border border-border bg-card p-4">
      <h2 className="font-semibold">Notifications</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Choose which updates should appear in-app or by email.
      </p>
      <div className="mt-4 grid gap-3">
        <PreferenceToggle
          label="In-app proposal status updates"
          checked={prefs.inAppPrStatus}
          onChange={(checked) => void save({ ...prefs, inAppPrStatus: checked })}
        />
        <PreferenceToggle
          label="Email proposal status updates"
          checked={prefs.emailPrStatus}
          onChange={(checked) => void save({ ...prefs, emailPrStatus: checked })}
        />
        <PreferenceToggle
          label="In-app comment replies"
          checked={prefs.inAppCommentReply}
          onChange={(checked) => void save({ ...prefs, inAppCommentReply: checked })}
        />
        <PreferenceToggle
          label="Email comment replies"
          checked={prefs.emailCommentReply}
          onChange={(checked) => void save({ ...prefs, emailCommentReply: checked })}
        />
        <PreferenceToggle
          label="In-app bookmarked page updates"
          checked={prefs.inAppPageUpdate}
          onChange={(checked) => void save({ ...prefs, inAppPageUpdate: checked })}
        />
        <PreferenceToggle
          label="Bookmarked page update digest email"
          checked={prefs.emailPageUpdateDigest}
          onChange={(checked) => void save({ ...prefs, emailPageUpdateDigest: checked })}
        />
        <label className="text-sm">
          Page update digest frequency
          <select
            value={prefs.pageUpdateDigestFrequency}
            onChange={(event) =>
              void save({
                ...prefs,
                pageUpdateDigestFrequency: event.target.value as "daily" | "weekly" | "never",
              })
            }
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2"
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="never">Never</option>
          </select>
        </label>
      </div>
      {message ? <p className="mt-3 text-sm text-muted-foreground">{message}</p> : null}
    </section>
  );
}

function PreferenceToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="size-4"
      />
    </label>
  );
}
