"use client";

import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";

import { AuthModal } from "@/components/auth/auth-modal";
import { Button } from "@/components/ui/button";
import { savePendingAction } from "@/lib/pending-actions/storage";
import { toast } from "@/lib/ui/toast";
import {
  getActivePulseMetrics,
  type OrgCategory,
  type PulseAggregate,
  type PulseMetric,
} from "@/types/domain";

const METRIC_LABELS: Record<PulseMetric, string> = {
  selectivity: "Selectivity",
  vibe_check: "Vibe Check",
  coop_boost: "Co-op Boost",
  workload: "Workload",
  employability: "Employability",
  community: "Community",
};

// Scale hints for numeric metrics. Categorical metrics (Selectivity) render as
// a pill instead and don't appear here.
const SCALE_HINTS: Partial<Record<PulseMetric, string>> = {
  vibe_check: "Social → Corporate",
  workload: "Chill → Intense",
  employability: "Niche → In-demand",
  community: "Solo → Tight-knit",
};

const SYMBOLS: Partial<Record<PulseMetric, string>> = {
  vibe_check: "●",
  coop_boost: "★",
  workload: "▰",
  employability: "★",
  community: "●",
};

type PendingPulseVote = {
  votes: Array<{ orgId: string; metric: PulseMetric; value: string }>;
};

export function PulseSidebar({
  orgId,
  category,
  aggregates,
  externalLinks,
  externalLinksLabel = "External Links",
}: {
  orgId: string;
  category: OrgCategory;
  aggregates: PulseAggregate[];
  externalLinks: Array<{ label: string; url: string }>;
  externalLinksLabel?: string;
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
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            The Pulse
          </h2>
        </div>
        <dl className="flex flex-col">
          {getActivePulseMetrics(category).map((metric) =>
            metric === "selectivity" ? (
              <PulseRow
                key={metric}
                label={METRIC_LABELS[metric]}
                value={
                  aggregateByMetric.get(metric)?.aggregateLabel ?? "No ratings yet"
                }
                votes={aggregateByMetric.get(metric)?.totalVotes ?? 0}
              />
            ) : (
              <PulseNumericRow
                key={metric}
                label={METRIC_LABELS[metric]}
                aggregate={aggregateByMetric.get(metric)}
                symbol={SYMBOLS[metric] ?? "●"}
                scaleHint={SCALE_HINTS[metric]}
              />
            ),
          )}
        </dl>

        <div className="border-t border-border px-4 py-3">
          <h3 className="mb-2 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            {externalLinksLabel}
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
          category={category}
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
  category,
  onClose,
  onAuthRequired,
}: {
  orgId: string;
  category: OrgCategory;
  onClose: () => void;
  onAuthRequired: (payload: PendingPulseVote) => void;
}) {
  const isProgram = category === "Academic Programs";
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
            {isProgram ? "Rate This Program" : "Rate This Org"}
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
        {isProgram ? (
          <ProgramVoteForm
            orgId={orgId}
            onAuthRequired={onAuthRequired}
            onSuccess={onClose}
          />
        ) : (
          <PulseVoteForm
            orgId={orgId}
            onAuthRequired={onAuthRequired}
            onSuccess={onClose}
          />
        )}
      </div>
    </div>
  );
}

async function submitVote(
  orgId: string,
  metric: PulseMetric,
  value: string,
  allVotes: PendingPulseVote["votes"],
  onAuthRequired: (payload: PendingPulseVote) => void,
) {
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    try {
      const intendedVotes: PendingPulseVote["votes"] = [
        { orgId, metric: "selectivity", value: selectivity },
        { orgId, metric: "vibe_check", value: String(vibe) },
        { orgId, metric: "coop_boost", value: String(coop) },
      ];
      const results = await Promise.all(
        intendedVotes.map((vote) =>
          submitVote(orgId, vote.metric, vote.value, intendedVotes, onAuthRequired),
        ),
      );
      const firstError = results.find((result) => !result.ok && !result.alreadyHandled);
      if (firstError && "error" in firstError && firstError.error) {
        toast.error(firstError.error);
      } else if (results.every((result) => result.ok)) {
        toast.success("Rating submitted. Refresh to see updated aggregates.");
        onSuccess?.();
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

      <Button type="submit" loading={submitting} className="w-full">
        Submit Rating
      </Button>
    </form>
  );
}

// Programs vote on Workload / Employability / Community — three numeric
// sliders, no categorical selectivity dropdown.
function ProgramVoteForm({
  orgId,
  onAuthRequired,
  onSuccess,
}: {
  orgId: string;
  onAuthRequired: (payload: PendingPulseVote) => void;
  onSuccess?: () => void;
}) {
  const [workload, setWorkload] = useState(3);
  const [employability, setEmployability] = useState(3);
  const [community, setCommunity] = useState(3);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    try {
      const intendedVotes: PendingPulseVote["votes"] = [
        { orgId, metric: "workload", value: String(workload) },
        { orgId, metric: "employability", value: String(employability) },
        { orgId, metric: "community", value: String(community) },
      ];
      const results = await Promise.all(
        intendedVotes.map((vote) =>
          submitVote(orgId, vote.metric, vote.value, intendedVotes, onAuthRequired),
        ),
      );
      const firstError = results.find((result) => !result.ok && !result.alreadyHandled);
      if (firstError && "error" in firstError && firstError.error) {
        toast.error(firstError.error);
      } else if (results.every((result) => result.ok)) {
        toast.success("Rating submitted. Refresh to see updated aggregates.");
        onSuccess?.();
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 text-sm">
      <FormField label={`Workload (${workload})`} hint="Chill → Intense">
        <input
          type="range"
          min={1}
          max={5}
          value={workload}
          onChange={(event) => setWorkload(Number.parseInt(event.target.value, 10))}
          className="w-full accent-[color:var(--foreground)]"
          aria-label="Workload rating"
        />
      </FormField>

      <FormField label={`Employability (${employability})`} hint="Niche → In-demand">
        <input
          type="range"
          min={1}
          max={5}
          value={employability}
          onChange={(event) =>
            setEmployability(Number.parseInt(event.target.value, 10))
          }
          className="w-full accent-[color:var(--foreground)]"
          aria-label="Employability rating"
        />
      </FormField>

      <FormField label={`Community (${community})`} hint="Solo → Tight-knit">
        <input
          type="range"
          min={1}
          max={5}
          value={community}
          onChange={(event) => setCommunity(Number.parseInt(event.target.value, 10))}
          className="w-full accent-[color:var(--foreground)]"
          aria-label="Community rating"
        />
      </FormField>

      <Button type="submit" loading={submitting} className="w-full">
        Submit Rating
      </Button>
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
