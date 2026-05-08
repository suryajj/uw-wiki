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
  const authError = url.searchParams.get("error");

  if (authError) {
    return NextResponse.redirect(new URL("/auth/sign-in?error=oauth_failed", url.origin));
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(new URL("/auth/sign-in?error=callback_failed", url.origin));
    }
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as "signup" | "magiclink" | "recovery" | "email_change",
    });
    if (error) {
      return NextResponse.redirect(new URL("/auth/sign-in?error=callback_failed", url.origin));
    }
  } else {
    return NextResponse.redirect(new URL("/auth/sign-in?error=callback_failed", url.origin));
  }

  if (type === "recovery") {
    return NextResponse.redirect(new URL("/auth/reset", url.origin));
  }
  return NextResponse.redirect(new URL(returnTo, url.origin));
}
