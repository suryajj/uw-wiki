// Pure type definitions for cold-start progress events. Lives in its own file
// (no "server-only" import) so client components can import the type without
// pulling in the full server-side service module.

import type { ProseMirrorDoc } from "@/types/domain";

export type ColdStartProgressEvent =
  | { kind: "phase"; label: string }
  | { kind: "search"; query: string; source: string }
  | { kind: "snippet"; count: number }
  | { kind: "followups"; queries: string[] }
  | {
      kind: "done";
      draftContentJson: ProseMirrorDoc;
      pulseEstimates: unknown;
      sectionSources: Record<string, string[]>;
    }
  | { kind: "error"; message: string };
