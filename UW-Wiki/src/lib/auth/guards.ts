import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Role = "user" | "reviewer" | "admin";

export type AuthUser = {
  id: string;
  email: string;
  role: Role;
};

export type GuardOptions = {
  returnTo?: string;
};

async function getAuthUser(): Promise<AuthUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("users")
    .select("role, email")
    .eq("id", user.id)
    .single();

  if (!profile) return null;

  return {
    id: user.id,
    email: profile.email,
    role: profile.role as Role,
  };
}

export function sanitizeReturnTo(value?: string | null): string {
  if (!value) return "/";
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  if (value.includes("://")) return "/";
  return value;
}

export async function requireUser(options: GuardOptions = {}): Promise<AuthUser> {
  const user = await getAuthUser();
  if (!user) {
    const returnTo = encodeURIComponent(sanitizeReturnTo(options.returnTo));
    redirect(`/auth/sign-in?returnTo=${returnTo}`);
  }
  return user;
}

export async function requireReviewer(options: GuardOptions = {}): Promise<AuthUser> {
  const user = await requireUser(options);
  if (user.role !== "reviewer" && user.role !== "admin") {
    redirect("/?error=not_authorized");
  }
  return user;
}

export async function requireAdmin(options: GuardOptions = {}): Promise<AuthUser> {
  const user = await requireUser(options);
  if (user.role !== "admin") {
    redirect("/?error=not_authorized");
  }
  return user;
}
