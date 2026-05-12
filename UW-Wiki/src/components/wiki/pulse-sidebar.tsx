"use client";

import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";

import { AuthModal } from "@/components/auth/auth-modal";
import { Button } from "@/components/ui/button";
import { savePendingAction } from "@/lib/pending-actions/storage";
import type { OrgCategory, PulseAggregate, PulseMetric } from "@/types/domain";

const METRIC_LABELS: Record<PulseMetric, string> = {
  selectivity: "Selectivity",
  vibe_check: "Vibe Check",
  coop_boost: "Co-op Boost",
};

type PendingPulseVote = {
  votes: Array<{ orgId: string; metric: PulseMetric; value: string }>;
};

export function PulseSidebar({
  orgId,
  aggregates,
  externalLinks,
  category,
  isAdminSeeded,
}: {
  orgId: string;
  aggregates: PulseAggregate[];
  externalLinks: Array<{ label: string; url: string }>;
  category: OrgCategory;
  isAdminSeeded: boolean;
}) {
  const [rateOpen, setRateOpen] = useState(false);
  const [authPrompt, setAuthPrompt] = useState<PendingPulseVote | null>(null);

  const aggregateByMetric = useMemo(
    () => new Map(aggregates.map((agg) => [agg.metric, agg])),
    [aggregates],
  );

  return (
    <div className="flex flex-col gap-0">
      <section className="overflow-hidden rounded-md border border-border bg-[color:var(--surface)]">
        <div className="flex items-baseline justify-between gap-3 border-b border-border px-4 py-3">
          <h2 className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            The Pulse
          </h2>
          <span className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            {category}
            {isAdminSeeded ? " · Admin seeded" : ""}
          </span>
        </div>
        <dl className="flex flex-col">
          <PulseRow
            label={METRIC_LABELS.selectivity}
            value={aggregateByMetric.get("selectivity")?.aggregateLabel ?? "No ratings yet"}
            votes={aggregateByMetric.get("selectivity")?.totalVotes ?? 0}
          />
          <PulseNumericRow
            label={METRIC_LABELS.vibe_check}
            aggregate={aggregateByMetric.get("vibe_check")}
            symbol="●"
            scaleHint="Social → Corporate"
          />
          <PulseNumericRow
            label={METRIC_LABELS.coop_boost}
            aggregate={aggregateByMetric.get("coop_boost")}
            symbol="★"
          />
        </dl>

        <div className="border-t border-border px-4 py-3">
          <h3 className="mb-2 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            External Links
          </h3>
          {externalLinks.length > 0 ? (
            <ul className="space-y-1.5 text-sm">
              {externalLinks.map((link) => (
                <li key={link.url}>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-foreground underline-offset-4 hover:underline"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No links yet.</p>
          )}
        </div>

        <div className="border-t border-border px-4 py-3">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => setRateOpen(true)}
          >
            Rate This Org
          </Button>
        </div>
      </section>

      {rateOpen ? (
        <RateOrgModal
          orgId={orgId}
          onClose={() => setRateOpen(false)}
          onAuthRequired={(payload) => {
            setRateOpen(false);
            setAuthPrompt(payload);
          }}
        />
      ) : null}

      {authPrompt ? (
        <PendingActionModal
          payload={authPrompt}
          onClose={() => setAuthPrompt(null)}
        />
      ) : null}
    </div>
  );
}

function PulseRow({
  label,
  value,
  votes,
}: {
  label: string;
  value: ReactNode;
  votes?: number;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border px-4 py-3 last:border-b-0">
      <dt className="text-sm font-medium text-foreground">{label}</dt>
      <dd className="flex items-center gap-1.5 text-right text-sm text-foreground">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-0.5">
          <span>{value}</span>
          {typeof votes === "number" ? (
            <span className="text-[11px] text-muted-foreground">{votes}</span>
          ) : null}
        </span>
      </dd>
    </div>
  );
}

function PulseNumericRow({
  label,
  aggregate,
  symbol,
  scaleHint,
}: {
  label: string;
  aggregate?: PulseAggregate;
  symbol: string;
  scaleHint?: string;
}) {
  const numericValue = aggregate ? Number.parseFloat(aggregate.aggregateValue) : NaN;
  const filled = Number.isFinite(numericValue)
    ? Math.round(Math.max(0, Math.min(5, numericValue)))
    : 0;
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border px-4 py-3 last:border-b-0">
      <dt className="flex flex-col text-sm font-medium text-foreground">
        <span>{label}</span>
        {scaleHint ? (
          <span className="text-[11px] font-normal text-muted-foreground">
            {scaleHint}
          </span>
        ) : null}
      </dt>
      <dd className="text-right text-sm text-foreground">
        {Number.isFinite(numericValue) ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-0.5 tabular-nums">
            <span aria-hidden="true">
              {Array.from({ length: 5 }).map((_, i) => (
                <span
                  key={i}
                  className={i < filled ? "text-foreground" : "text-muted-foreground"}
                >
                  {symbol}
                </span>
              ))}
            </span>
            <span className="text-[11px] text-muted-foreground">
              {numericValue.toFixed(1)} · {aggregate?.totalVotes ?? 0}
            </span>
          </span>
        ) : (
          <span className="text-muted-foreground">No ratings yet</span>
        )}
      </dd>
    </div>
  );
}

const SELECTIVITY_OPTIONS = [
  "Open Membership",
  "Application-Based",
  "Invite-Only",
] as const;

function RateOrgModal({
  orgId,
  onClose,
  onAuthRequired,
}: {
  orgId: string;
  onClose: () => void;
  onAuthRequired: (payload: PendingPulseVote) => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-md rounded-md border border-border bg-[color:var(--surface)] p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="rate-org-title"
      >
        <div className="mb-4 flex items-baseline justify-between">
          <h3 id="rate-org-title" className="text-lg font-semibold text-foreground">
            Rate This Org
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-muted-foreground hover:text-foreground"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <PulseVoteForm
          orgId={orgId}
          onAuthRequired={onAuthRequired}
          onSuccess={onClose}
        />
      </div>
    </div>
  );
}

function PulseVoteForm({
  orgId,
  onAuthRequired,
  onSuccess,
}: {
  orgId: string;
  onAuthRequired: (payload: PendingPulseVote) => void;
  onSuccess?: () => void;
}) {
  const [selectivity, setSelectivity] = useState<typeof SELECTIVITY_OPTIONS[number]>(
    "Application-Based",
  );
  const [vibe, setVibe] = useState(3);
  const [coop, setCoop] = useState(3);
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
      const intendedVotes: PendingPulseVote["votes"] = [
        { orgId, metric: "selectivity", value: selectivity },
        { orgId, metric: "vibe_check", value: String(vibe) },
        { orgId, metric: "coop_boost", value: String(coop) },
      ];
      const results = await Promise.all(
        intendedVotes.map((vote) => submitOne(vote.metric, vote.value, intendedVotes)),
      );
      const firstError = results.find((result) => !result.ok && !result.alreadyHandled);
      if (firstError && "error" in firstError && firstError.error) {
        setMessage(firstError.error);
      } else if (results.every((result) => result.ok)) {
        setMessage("Ratings submitted. Refresh to see updated aggregates.");
        onSuccess?.();
      } else {
        setMessage("Some ratings need sign-in. Check the prompt and try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 text-sm">
      <FormField label="Selectivity">
        <select
          value={selectivity}
          onChange={(event: ChangeEvent<HTMLSelectElement>) =>
            setSelectivity(event.target.value as typeof SELECTIVITY_OPTIONS[number])
          }
          className="h-9 w-full rounded-md border border-border bg-transparent px-3 text-sm text-foreground outline-none focus:border-foreground"
        >
          {SELECTIVITY_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </FormField>

      <FormField label={`Vibe Check (${vibe})`} hint="Social → Corporate">
        <input
          type="range"
          min={1}
          max={5}
          value={vibe}
          onChange={(event) => setVibe(Number.parseInt(event.target.value, 10))}
          className="w-full accent-[color:var(--foreground)]"
          aria-label="Vibe Check rating"
        />
      </FormField>

      <FormField label={`Co-op Boost (${coop})`}>
        <div className="flex gap-1.5" role="radiogroup" aria-label="Co-op Boost rating">
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
                  ? "text-lg text-foreground"
                  : "text-lg text-muted-foreground hover:text-foreground"
              }
            >
              ★
            </button>
          ))}
        </div>
      </FormField>

      <Button type="submit" disabled={submitting} className="w-full">
        {submitting ? "Submitting…" : "Submit Rating"}
      </Button>
      {message ? (
        <p className="text-xs text-muted-foreground">{message}</p>
      ) : null}
    </form>
  );
}

function FormField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </legend>
      {children}
      {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
    </fieldset>
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
  // useEffect placeholder to silence unused warning if needed in future
  useEffect(() => {
    void payload;
  }, [payload]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="max-w-sm rounded-md border border-border bg-[color:var(--surface)] p-6 text-sm">
        <h3 className="text-lg font-semibold text-foreground">Sign in to rate</h3>
        <p className="mt-2 text-muted-foreground">
          Pulse votes need an account so we can prevent ballot stuffing. Your
          rating is saved and submitted automatically once you sign in.
        </p>
        <div className="mt-5 flex justify-end gap-2">
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
