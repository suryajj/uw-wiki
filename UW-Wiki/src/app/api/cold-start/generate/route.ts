import { logServerError, parseJson } from "@/lib/api/errors";
import { requireAdminApi } from "@/lib/admin/auth";
import {
  generateDraftForJob,
  type ColdStartProgressEvent,
} from "@/lib/cold-start/service";
import { generateInputSchema } from "@/lib/cold-start/schemas";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Streams cold-start draft generation as newline-delimited JSON events. Each
 * line is a {@link ColdStartProgressEvent}; the final `done` event carries the
 * resulting draft. The client (`/admin/cold-start`) reads this stream with
 * `getReader()` and updates the progress UI live.
 */
export async function POST(req: Request) {
  const admin = await requireAdminApi();
  if (!admin.ok) return admin.response;
  const parsed = await parseJson(req, generateInputSchema);
  if (!parsed.ok) return parsed.response;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const write = (event: ColdStartProgressEvent) => {
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      };
      try {
        const result = await generateDraftForJob(
          parsed.data.jobId,
          parsed.data.orgMetadata,
          admin.user,
          write,
        );
        write({
          kind: "done",
          draftContentJson: result.draftContentJson,
          pulseEstimates: result.pulseEstimates,
          sectionSources: result.sectionSources,
        });
      } catch (error) {
        logServerError("cold-start.generate.stream", error);
        write({
          kind: "error",
          message: error instanceof Error ? error.message : "Could not generate draft.",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
