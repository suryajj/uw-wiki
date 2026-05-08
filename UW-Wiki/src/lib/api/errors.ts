import { z } from "zod";

export type ApiErrorCode =
  | "INVALID_BODY"
  | "INVALID_CONTENT"
  | "VALIDATION_FAILED"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "INVALID_STATE"
  | "UNEXPECTED";

const STATUS_FOR_CODE: Record<ApiErrorCode, number> = {
  INVALID_BODY: 400,
  INVALID_CONTENT: 422,
  VALIDATION_FAILED: 422,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  INVALID_STATE: 409,
  UNEXPECTED: 500,
};

export function apiError(
  code: ApiErrorCode,
  message: string,
  init?: ResponseInit,
): Response {
  return Response.json(
    { error: message, code },
    { status: STATUS_FOR_CODE[code], ...init },
  );
}

export function apiSuccess<T extends Record<string, unknown> | undefined>(
  payload: T,
  init?: ResponseInit,
): Response {
  return Response.json({ ok: true, ...(payload ?? {}) }, init);
}

export async function readJson<T>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}

/**
 * Parse a JSON body against a Zod schema. Returns either a typed value or a
 * Response that the caller should return immediately. This keeps every
 * mutating route on the same validation contract from CONSTRAINTS.md §7.
 */
export async function parseJson<TSchema extends z.ZodTypeAny>(
  req: Request,
  schema: TSchema,
): Promise<
  | { ok: true; data: z.output<TSchema> }
  | { ok: false; response: Response }
> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return { ok: false, response: apiError("INVALID_BODY", "Request body must be valid JSON.") };
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false,
      response: apiError("VALIDATION_FAILED", zodIssueMessage(parsed.error)),
    };
  }
  return { ok: true, data: parsed.data as z.output<TSchema> };
}

export function zodIssueMessage(error: z.ZodError): string {
  const first = error.issues[0];
  if (!first) return "Validation failed.";
  const path = first.path.length ? `${first.path.join(".")}: ` : "";
  return `${path}${first.message}`;
}

/**
 * Structured server-side log for errors that should never leak details to
 * clients. Console output is plain JSON so production log collectors can
 * parse it; client responses always go through `apiError`.
 */
export function logServerError(scope: string, error: unknown): void {
  const payload = {
    scope,
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    timestamp: new Date().toISOString(),
  };
  console.error(JSON.stringify(payload));
}
