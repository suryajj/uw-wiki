"use client";

import Link from "next/link";
import { useRef, useState } from "react";

import { ColdStartProgressStream } from "@/components/cold-start/progress-stream";
import { Button } from "@/components/ui/button";
import type { ColdStartProgressEvent } from "@/lib/cold-start/progress-events";
import { renderProseMirrorDoc } from "@/lib/prosemirror/render";
import type { OrgCategory, ProseMirrorDoc } from "@/types/domain";

type Metadata = {
  name: string;
  slug?: string;
  oneLiner?: string;
  website?: string;
  category: OrgCategory;
  confidence?: string;
  sources?: string[];
};

export function ColdStartClient({ categories }: { categories: OrgCategory[] }) {
  const [input, setInput] = useState("");
  const [categoryHint, setCategoryHint] = useState<OrgCategory>(categories[0]);
  const [jobId, setJobId] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<Metadata | null>(null);
  const [draft, setDraft] = useState<ProseMirrorDoc | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [progressEvents, setProgressEvents] = useState<ColdStartProgressEvent[]>([]);
  const [streaming, setStreaming] = useState(false);
  const inFlight = useRef(false);

  async function identify() {
    setLoading(true);
    setMessage(null);
    const res = await fetch("/api/cold-start/identify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input, categoryHint }),
    });
    const body = (await res.json().catch(() => ({}))) as {
      jobId?: string;
      orgMetadata?: Metadata;
      error?: string;
    };
    setLoading(false);
    if (!res.ok || !body.jobId || !body.orgMetadata) {
      setMessage(body.error ?? "Could not identify org.");
      return;
    }
    setJobId(body.jobId);
    setMetadata(body.orgMetadata);
  }

  async function generate() {
    if (!jobId || !metadata) return;
    // Guard against double-fire (React StrictMode dev double-invoke, accidental
    // double-click). Without this, two concurrent streams race and the second
    // one resets state mid-flight, clobbering the first run's draft.
    if (inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    setStreaming(true);
    setProgressEvents([]);
    setDraft(null);
    setMessage(null);
    let receivedDraft: ProseMirrorDoc | null = null;
    let errorMessage: string | null = null;
    try {
      const res = await fetch("/api/cold-start/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, orgMetadata: metadata }),
      });
      if (!res.ok || !res.body) {
        const fallback = (await res.json().catch(() => ({}))) as { error?: string };
        errorMessage = fallback.error ?? `Generate request failed (status ${res.status}).`;
      } else {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let newline = buffer.indexOf("\n");
          while (newline !== -1) {
            const line = buffer.slice(0, newline).trim();
            buffer = buffer.slice(newline + 1);
            if (line.length > 0) {
              try {
                const event = JSON.parse(line) as ColdStartProgressEvent;
                setProgressEvents((prev) => [...prev, event]);
                if (event.kind === "done") {
                  receivedDraft = event.draftContentJson;
                } else if (event.kind === "error") {
                  errorMessage = event.message;
                }
              } catch {
                // ignore malformed line — but log to console for debugging
                console.warn("cold-start: failed to parse stream line", line);
              }
            }
            newline = buffer.indexOf("\n");
          }
        }
      }
    } catch (error) {
      errorMessage =
        error instanceof Error ? error.message : "Stream failed.";
    } finally {
      setLoading(false);
      setStreaming(false);
      inFlight.current = false;
    }
    // Apply final state AFTER stream is fully consumed. Prefer the draft —
    // if we got one, never surface an error message even if a transient error
    // event came earlier.
    if (receivedDraft) {
      setDraft(receivedDraft);
      setMessage(null);
    } else if (errorMessage) {
      setMessage(errorMessage);
    } else {
      setMessage("Stream ended without a draft. Try again.");
    }
  }

  async function publish() {
    if (!jobId) return;
    setLoading(true);
    const res = await fetch(`/api/cold-start/${jobId}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contentJson: draft ?? undefined }),
    });
    const body = (await res.json().catch(() => ({}))) as {
      orgSlug?: string;
      error?: string;
    };
    setLoading(false);
    if (!res.ok || !body.orgSlug) {
      setMessage(body.error ?? "Could not publish draft.");
      return;
    }
    setMessage(`Published. View /wiki/${body.orgSlug}`);
  }

  return (
    <section className="mt-6 space-y-6">
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_220px_auto]">
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Org name or URL"
            className="rounded-md border border-border bg-background px-3 py-2"
          />
          <select
            value={categoryHint}
            onChange={(event) => setCategoryHint(event.target.value as OrgCategory)}
            className="rounded-md border border-border bg-background px-3 py-2"
          >
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
          <Button disabled={loading || input.trim().length < 2} onClick={identify}>
            Identify
          </Button>
        </div>
      </div>

      {metadata ? (
        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-xl font-semibold">{metadata.name}</h2>
          <p className="mt-2 text-muted-foreground">{metadata.oneLiner}</p>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <label className="text-sm">
              Name
              <input
                value={metadata.name}
                onChange={(event) => setMetadata({ ...metadata, name: event.target.value })}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2"
              />
            </label>
            <label className="text-sm">
              Category
              <select
                value={metadata.category}
                onChange={(event) => setMetadata({ ...metadata, category: event.target.value as OrgCategory })}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2"
              >
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="mt-4 flex gap-2">
            <Button disabled={loading} onClick={generate}>
              Confirm & Research
            </Button>
            {jobId ? (
              <Button asChild variant="outline">
                <Link href={`/admin/cold-start/jobs`}>View Jobs</Link>
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {streaming || progressEvents.length > 0 ? (
        <ColdStartProgressStream events={progressEvents} isStreaming={streaming} />
      ) : null}

      {draft ? (
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xl font-semibold">Draft Preview</h2>
            <Button disabled={loading} onClick={publish}>
              Publish
            </Button>
          </div>
          <article className="rounded-md border border-border bg-background p-4">
            {renderProseMirrorDoc(draft, { decorateSections: true })}
          </article>
        </div>
      ) : null}

      {message ? <p className="rounded-md border border-border bg-card p-3 text-sm">{message}</p> : null}
    </section>
  );
}
