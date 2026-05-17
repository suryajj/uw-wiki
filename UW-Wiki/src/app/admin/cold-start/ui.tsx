"use client";

import Link from "next/link";
import { useRef, useState } from "react";

import { ColdStartProgressStream } from "@/components/cold-start/progress-stream";
import { Button } from "@/components/ui/button";
import type { ColdStartProgressEvent } from "@/lib/cold-start/progress-events";
import { renderProseMirrorDoc } from "@/lib/prosemirror/render";
import { toast } from "@/lib/ui/toast";
import { useAction } from "@/lib/ui/use-action";
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
  const [progressEvents, setProgressEvents] = useState<ColdStartProgressEvent[]>([]);
  const [streaming, setStreaming] = useState(false);
  const inFlight = useRef(false);

  const identifyAction = useAction(
    async () => {
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
      if (!res.ok || !body.jobId || !body.orgMetadata) {
        throw new Error(body.error ?? "Could not identify org.");
      }
      return body as { jobId: string; orgMetadata: Metadata };
    },
    {
      successMessage: (r) => `Identified: ${r.orgMetadata.name}`,
      onSuccess: (r) => {
        setJobId(r.jobId);
        setMetadata(r.orgMetadata);
      },
    },
  );

  // The generate action streams NDJSON — we handle the loading state manually
  // and surface errors via toast. useAction doesn't fit the streaming case.
  async function generate() {
    if (!jobId || !metadata) return;
    if (inFlight.current) return;
    inFlight.current = true;
    setStreaming(true);
    setProgressEvents([]);
    setDraft(null);
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
                console.warn("cold-start: failed to parse stream line", line);
              }
            }
            newline = buffer.indexOf("\n");
          }
        }
      }
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : "Stream failed.";
    } finally {
      setStreaming(false);
      inFlight.current = false;
    }
    if (receivedDraft) {
      setDraft(receivedDraft);
      toast.success("Draft generated. Review and publish below.");
    } else if (errorMessage) {
      toast.error(errorMessage);
    } else {
      toast.error("Stream ended without a draft. Try again.");
    }
  }

  const publishAction = useAction(
    async () => {
      if (!jobId) throw new Error("No job to publish.");
      const res = await fetch(`/api/cold-start/${jobId}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentJson: draft ?? undefined }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        orgSlug?: string;
        error?: string;
      };
      if (!res.ok || !body.orgSlug) {
        throw new Error(body.error ?? "Could not publish draft.");
      }
      return body as { orgSlug: string };
    },
    {
      successMessage: (r) => `Published — view at /wiki/${r.orgSlug}`,
    },
  );

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
          <Button
            loading={identifyAction.pending}
            disabled={input.trim().length < 2}
            onClick={() => identifyAction.run()}
          >
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
            <Button loading={streaming} onClick={generate}>
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
            <Button loading={publishAction.pending} onClick={() => publishAction.run()}>
              Publish
            </Button>
          </div>
          <article className="rounded-md border border-border bg-background p-4">
            {renderProseMirrorDoc(draft, { decorateSections: true })}
          </article>
        </div>
      ) : null}
    </section>
  );
}
