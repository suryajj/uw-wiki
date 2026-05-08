"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

type Row = {
  category: string;
  needs_update_days: number;
  stale_days: number;
  defunct_days: number;
};

export function LifecycleEditor({ rows }: { rows: Row[] }) {
  const [items, setItems] = useState(
    rows.map((row) => ({
      category: row.category,
      needsUpdateMonths: Math.round(row.needs_update_days / 30),
      staleMonths: Math.round((row.stale_days ?? row.needs_update_days * 2) / 30),
      defunctMonths: Math.round((row.defunct_days ?? row.needs_update_days * 4) / 30),
    })),
  );
  const [message, setMessage] = useState<string | null>(null);
  async function save() {
    const invalid = items.some(
      (item) =>
        item.needsUpdateMonths >= item.staleMonths ||
        item.staleMonths >= item.defunctMonths,
    );
    if (invalid) {
      setMessage("Thresholds must be needs-update < stale < defunct.");
      return;
    }
    const res = await fetch("/api/admin/lifecycle/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows: items }),
    });
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    setMessage(res.ok ? "Lifecycle config saved." : body.error ?? "Failed.");
  }
  return (
    <section className="mt-6 space-y-3">
      {items.map((item, index) => (
        <div key={item.category} className="grid gap-3 rounded-lg border border-border bg-card p-4 md:grid-cols-[1fr_repeat(3,120px)]">
          <div className="font-medium">{item.category}</div>
          {(["needsUpdateMonths", "staleMonths", "defunctMonths"] as const).map((key) => (
            <label key={key} className="text-xs text-muted-foreground">
              {key.replace("Months", "")}
              <input
                type="number"
                min={1}
                value={item[key]}
                onChange={(event) => {
                  const value = Number.parseInt(event.target.value, 10);
                  setItems((prev) =>
                    prev.map((row, i) =>
                      i === index ? { ...row, [key]: Number.isFinite(value) ? value : 1 } : row,
                    ),
                  );
                }}
                className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1"
              />
            </label>
          ))}
        </div>
      ))}
      <Button onClick={save}>Save Lifecycle Config</Button>
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
    </section>
  );
}
