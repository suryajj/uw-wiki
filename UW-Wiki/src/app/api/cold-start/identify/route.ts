import { apiError, apiSuccess, logServerError, parseJson } from "@/lib/api/errors";
import { requireAdminApi } from "@/lib/admin/auth";
import { createIdentificationJob } from "@/lib/cold-start/service";
import { identifyInputSchema } from "@/lib/cold-start/schemas";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const admin = await requireAdminApi();
  if (!admin.ok) return admin.response;
  const parsed = await parseJson(req, identifyInputSchema);
  if (!parsed.ok) return parsed.response;
  try {
    const result = await createIdentificationJob(
      parsed.data.input,
      parsed.data.categoryHint,
      admin.user,
    );
    return apiSuccess(result, { status: 201 });
  } catch (error) {
    logServerError("cold-start.identify", error);
    return apiError("UNEXPECTED", "Could not identify organization.");
  }
}
