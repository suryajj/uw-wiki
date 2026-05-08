"use client";

import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";

import { AuthModal } from "@/components/auth/auth-modal";
import { Button } from "@/components/ui/button";
import { savePendingAction } from "@/lib/pending-actions/storage";
import type { LifecycleStatus, PulseAggregate, PulseMetric } from "@/types/domain";

const METRIC_LABELS: Record<PulseMetric, string> = {
  selectivity: "Selectivity",
  vibe_check: "Vibe Check",
  coop_boost: "Co-op Boost",
  tech_stack: "Tech Stack",
};

const HEALTH_LABELS: Record<LifecycleStatus, string> = {
  active: "Active",
  needs_update: "Needs Update",
  stale: "Stale",
  potentially_defunct: "Potentially Defunct",
};

const COLLAPSED_KEY_PREFIX = "uw-wiki-pulse-collapsed:";

type PendingPulseVote = {
  votes: Array<{ orgId: string; metric: PulseMetric; value: string }>;
};

export function PulseSidebar({
  orgId,
  aggregates,
  healthStatus,
  externalLinks,
}: {
  orgId: string;
  aggregates: PulseAggregate[];
  healthStatus: LifecycleStatus;
  externalLinks: Array<{ label: string; url: string }>;
}) {
  const [expanded, setExpanded] = useState(true);
  const [authPrompt, setAuthPrompt] = useState<PendingPulseVote | null>(null);

  const aggregateByMetric = useMemo(
    () => new Map(aggregates.map((agg) => [agg.metric, agg])),
    [aggregates],
  );

  // First-visit-expanded behaviour per FRD-2 §3.3: the localStorage flag is
  // set after the first close, so subsequent visits start collapsed.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(`${COLLAPSED_KEY_PREFIX}${orgId}`);
    if (stored === "1") setExpanded(false);
  }, [orgId]);

  function toggleExpanded(next: boolean) {
    setExpanded(next);
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      `${COLLAPSED_KEY_PREFIX}${orgId}`,
      next ? "0" : "1",
    );
  }

  return (
    <aside className="flex flex-col gap-4 lg:sticky lg:top-8">
      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-primary">
          The Pulse
        </h2>
        <div className="space-y-4">
          <PulseMetricRow
            metric="selectivity"
            aggregate={aggregateByMetric.get("selectivity")}
          />
          <PulseMetricRow
            metric="vibe_check"
            aggregate={aggregateByMetric.get("vibe_check")}
            scaleHint="Social ←→ Corporate"
          />
          <PulseMetricRow
            metric="coop_boost"
            aggregate={aggregateByMetric.get("coop_boost")}
          />
          <PulseTechStackRow aggregate={aggregateByMetric.get("tech_stack")} />
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Health Status
            </p>
            <p className="mt-1 font-medium">{HEALTH_LABELS[healthStatus]}</p>
          </div>
        </div>
        <Button
          className="mt-4 w-full"
          type="button"
          variant="outline"
          aria-expanded={expanded}
          onClick={() => toggleExpanded(!expanded)}
        >
          {expanded ? "Hide Rating Form" : "Rate This Org"}
        </Button>
        {expanded ? (
          <PulseVoteForm
            orgId={orgId}
            onAuthRequired={(payload) => setAuthPrompt(payload)}
          />
        ) : null}
      </section>

      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          External Links
        </h2>
        {externalLinks.length > 0 ? (
          <ul className="space-y-2 text-sm">
            {externalLinks.map((link) => (
              <li key={link.url}>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary hover:underline"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No structured links yet.</p>
        )}
      </section>

      {authPrompt ? (
        <PendingActionModal
          payload={authPrompt}
          onClose={() => setAuthPrompt(null)}
        />
      ) : null}
    </aside>
  );
}

function PulseMetricRow({
  metric,
  aggregate,
  scaleHint,
}: {
  metric: PulseMetric;
  aggregate?: PulseAggregate;
  scaleHint?: string;
}) {
  const isNumeric = metric === "vibe_check" || metric === "coop_boost";
  const numericValue = aggregate ? Number.parseFloat(aggregate.aggregateValue) : NaN;
  return (
    <div className="border-b border-border pb-3 last:border-0">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        {METRIC_LABELS[metric]}
      </p>
      {isNumeric && Number.isFinite(numericValue) ? (
        <NumericMetricBar
          value={numericValue}
          symbol={metric === "coop_boost" ? "★" : "●"}
        />
      ) : (
        <p className="mt-1 font-medium">
          {aggregate?.aggregateLabel ?? "No ratings yet"}
        </p>
      )}
      {scaleHint ? (
        <p className="text-[11px] text-muted-foreground">{scaleHint}</p>
      ) : null}
      <p className="text-xs text-muted-foreground">
        {aggregate?.totalVotes ?? 0} votes
      </p>
    </div>
  );
}

function NumericMetricBar({ value, symbol }: { value: number; symbol: string }) {
  const filled = Math.round(Math.max(0, Math.min(5, value)));
  return (
    <p className="mt-1 font-medium tracking-wide" aria-label={`${value.toFixed(1)} out of 5`}>
      {Array.from({ length: 5 }).map((_, index) => (
        <span
          key={index}
          className={index < filled ? "text-primary" : "text-muted-foreground"}
        >
          {symbol}
        </span>
      ))}{" "}
      <span className="text-sm text-muted-foreground">{value.toFixed(1)} / 5</span>
    </p>
  );
}

function PulseTechStackRow({ aggregate }: { aggregate?: PulseAggregate }) {
  const tags = aggregate?.aggregateValue
    ? aggregate.aggregateValue
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean)
    : [];
  const visible = tags.slice(0, 6);
  const overflow = Math.max(0, tags.length - visible.length);
  return (
    <div className="border-b border-border pb-3 last:border-0">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        Tech Stack
      </p>
      <div className="mt-1 flex flex-wrap gap-1">
        {visible.length === 0 ? (
          <p className="font-medium">No tech tags yet</p>
        ) : (
          visible.map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-border bg-background px-2 py-0.5 text-xs"
            >
              {tag}
            </span>
          ))
        )}
        {overflow > 0 ? (
          <span className="rounded-full border border-border bg-background px-2 py-0.5 text-xs text-muted-foreground">
            +{overflow} more
          </span>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">
        {aggregate?.totalVotes ?? 0} votes
      </p>
    </div>
  );
}

const SELECTIVITY_OPTIONS = [
  "Open Membership",
  "Application-Based",
  "Invite-Only",
] as const;

function PulseVoteForm({
  orgId,
  onAuthRequired,
}: {
  orgId: string;
  onAuthRequired: (payload: PendingPulseVote) => void;
}) {
  const [selectivity, setSelectivity] = useState<typeof SELECTIVITY_OPTIONS[number]>(
    "Application-Based",
  );
  const [vibe, setVibe] = useState(3);
  const [coop, setCoop] = useState(3);
  const [techInput, setTechInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submitOne(metric: PulseMetric, value: string, allVotes: PendingPulseVote["votes"]) {
    const res = await fetch("/api/pulse/vote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orgId, metric, value }),
    });
    if (res.status === 401) {
      onAuthRequired({ votes: allVotes });
      return { ok: false, alreadyHandled: true } as const;
    }
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      return { ok: false, alreadyHandled: false, error: body.error } as const;
    }
    return { ok: true } as const;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);
    try {
      const tags = techInput
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean)
        .join(", ");
      const intendedVotes: PendingPulseVote["votes"] = [
        { orgId, metric: "selectivity", value: selectivity },
        { orgId, metric: "vibe_check", value: String(vibe) },
        { orgId, metric: "coop_boost", value: String(coop) },
        ...(tags ? [{ orgId, metric: "tech_stack" as PulseMetric, value: tags }] : []),
      ];
      const callsWithPayload = intendedVotes.map((vote) =>
        submitOne(vote.metric, vote.value, intendedVotes),
      );
      const results = await Promise.all(callsWithPayload);
      const firstError = results.find((result) => !result.ok && !result.alreadyHandled);
      if (firstError && "error" in firstError && firstError.error) {
        setMessage(firstError.error);
      } else if (results.every((result) => result.ok)) {
        setMessage("Ratings submitted. Refresh to see updated aggregates.");
      } else {
        setMessage("Some ratings need sign-in. Check the prompt and try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-4 space-y-3 rounded-md border border-border bg-background p-3 text-sm"
    >
      <fieldset className="space-y-1">
        <legend className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Selectivity
        </legend>
        <select
          value={selectivity}
          onChange={(event: ChangeEvent<HTMLSelectElement>) =>
            setSelectivity(event.target.value as typeof SELECTIVITY_OPTIONS[number])
          }
          className="w-full rounded-md border border-border bg-card px-2 py-1"
        >
          {SELECTIVITY_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </fieldset>

      <fieldset className="space-y-1">
        <legend className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Vibe Check ({vibe})
        </legend>
        <input
          type="range"
          min={1}
          max={5}
          value={vibe}
          onChange={(event) => setVibe(Number.parseInt(event.target.value, 10))}
          className="w-full"
          aria-label="Vibe Check rating"
        />
        <div className="flex justify-between text-[11px] text-muted-foreground">
          <span>Social</span>
          <span>Corporate</span>
        </div>
      </fieldset>

      <fieldset className="space-y-1">
        <legend className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Co-op Boost ({coop})
        </legend>
        <div className="flex gap-1" role="radiogroup" aria-label="Co-op Boost rating">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setCoop(star)}
              role="radio"
              aria-checked={coop === star}
              aria-label={`${star} out of 5`}
              className={
                star <= coop
                  ? "text-primary text-lg"
                  : "text-muted-foreground text-lg"
              }
            >
              ★
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-1">
        <legend className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Tech Stack (optional, comma separated)
        </legend>
        <input
          value={techInput}
          onChange={(event) => setTechInput(event.target.value)}
          placeholder="ROS2, C++, Python"
          className="w-full rounded-md border border-border bg-card px-2 py-1"
        />
      </fieldset>

      <Button type="submit" disabled={submitting}>
        {submitting ? "Submitting..." : "Submit Rating"}
      </Button>
      {message ? (
        <p className="text-xs text-muted-foreground">{message}</p>
      ) : null}
    </form>
  );
}

function PendingActionModal({
  payload,
  onClose,
}: {
  payload: PendingPulseVote;
  onClose: () => void;
}) {
  function persistPending() {
    savePendingAction("pulse.vote", payload, window.location.pathname);
  }
  const [authOpen, setAuthOpen] = useState(false);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-w-sm rounded-lg border border-border bg-card p-5 text-sm">
        <h3 className="text-base font-semibold">Sign in to rate</h3>
        <p className="mt-2 text-muted-foreground">
          Pulse votes need an account so we can prevent ballot stuffing. Sign-in
          UI lands with FRD-6; this stub will save your rating and submit it
          automatically once you sign in.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => {
              persistPending();
              setAuthOpen(true);
            }}
          >
            Save and Sign In
          </Button>
        </div>
      </div>
      <AuthModal
        open={authOpen}
        returnTo={typeof window === "undefined" ? "/" : window.location.pathname}
        onClose={() => {
          setAuthOpen(false);
          onClose();
        }}
      />
    </div>
  );
}
