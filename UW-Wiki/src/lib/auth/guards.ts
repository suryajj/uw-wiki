import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Role = "user" | "reviewer" | "admin";

export type AuthUser = {
  id: string;
  email: string;
  role: Role;
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

export async function requireUser(): Promise<AuthUser> {
  const user = await getAuthUser();
  if (!user) redirect("/auth/sign-in");
  return user;
}

export async function requireReviewer(): Promise<AuthUser> {
  const user = await requireUser();
  if (user.role !== "reviewer" && user.role !== "admin") {
    redirect("/?error=forbidden");
  }
  return user;
}

export async function requireAdmin(): Promise<AuthUser> {
  const user = await requireUser();
  if (user.role !== "admin") {
    redirect("/?error=forbidden");
  }
  return user;
}
