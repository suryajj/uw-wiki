import { apiError, apiSuccess, logServerError, parseJson } from "@/lib/api/errors";
import { requireAdminApi } from "@/lib/admin/auth";
import { generateDraftForJob } from "@/lib/cold-start/service";
import { generateInputSchema } from "@/lib/cold-start/schemas";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const admin = await requireAdminApi();
  if (!admin.ok) return admin.response;
  const parsed = await parseJson(req, generateInputSchema);
  if (!parsed.ok) return parsed.response;
  try {
    const result = await generateDraftForJob(
      parsed.data.jobId,
      parsed.data.orgMetadata,
      admin.user,
    );
    return apiSuccess(result);
  } catch (error) {
    logServerError("cold-start.generate", error);
    return apiError("UNEXPECTED", "Could not generate draft.");
  }
}
