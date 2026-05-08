import { NextResponse, type NextRequest } from "next/server";

import { sanitizeReturnTo } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const returnTo = sanitizeReturnTo(url.searchParams.get("returnTo"));
  const supabase = await createClient();

  if (code) {
    await supabase.auth.exchangeCodeForSession(code);
  } else if (tokenHash && type) {
    await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as "signup" | "magiclink" | "recovery" | "email_change",
    });
  }

  if (type === "recovery") {
    return NextResponse.redirect(new URL("/auth/reset", url.origin));
  }
  return NextResponse.redirect(new URL(returnTo, url.origin));
}
