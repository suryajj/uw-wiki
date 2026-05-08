import { requireEnv, supabaseRest } from "./lib/env.mjs";

const env = requireEnv("NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY");
const [, , identifier, role = "user", orgSlug, roleLabel] = process.argv;

if (!identifier || !["user", "reviewer", "admin"].includes(role)) {
  console.error("Usage: node scripts/ensure-dev-role.mjs <email-or-user-id> <user|reviewer|admin> [org_slug] [role_label]");
  process.exit(1);
}

const field = identifier.includes("@") ? "email" : "id";
const [user] = await supabaseRest(`/users?select=id,email,role&${field}=eq.${encodeURIComponent(identifier)}&limit=1`);
if (!user) {
  console.error(`No public.users row found for ${identifier}. Sign in once or create the auth user first.`);
  process.exit(2);
}

await supabaseRest(`/users?id=eq.${encodeURIComponent(user.id)}`, {
  method: "PATCH",
  prefer: "return=minimal",
  body: JSON.stringify({ role }),
});

if (orgSlug) {
  const [org] = await supabaseRest(`/organizations?select=id,org_name&org_slug=eq.${encodeURIComponent(orgSlug)}&limit=1`);
  if (!org) {
    console.error(`No organization found for slug ${orgSlug}.`);
    process.exit(2);
  }
  await supabaseRest("/user_affiliations?on_conflict=user_id,org_id", {
    method: "POST",
    prefer: "resolution=merge-duplicates,return=minimal",
    body: JSON.stringify({
      user_id: user.id,
      org_id: org.id,
      role_label: roleLabel ?? "Member",
      is_active: true,
    }),
  });
  console.log(`Set ${user.email} to ${role} and affiliated with ${org.org_name}.`);
} else {
  console.log(`Set ${user.email} (${user.id}) to role ${role}.`);
}

void env;
