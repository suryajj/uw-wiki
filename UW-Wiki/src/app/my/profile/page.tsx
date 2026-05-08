import { requireUser } from "@/lib/auth/guards";
import { ensureNotificationPreferences } from "@/lib/notifications/service";
import { createAdminClient } from "@/lib/supabase/admin";
import { AffiliationManager, NotificationPreferencesForm } from "./profile-ui";

export default async function ProfilePage() {
  const user = await requireUser({ returnTo: "/my/profile" });
  const admin = createAdminClient();
  const [{ data: orgs }, { data: affiliations }, notificationPreferences] = await Promise.all([
    admin
      .from("organizations")
      .select("id,org_name,org_slug,category")
      .order("org_name", { ascending: true }),
    admin
      .from("user_affiliations")
      .select("id,role_label,is_active,organizations(id,org_name,org_slug,category)")
      .eq("user_id", user.id)
      .eq("is_active", true),
    ensureNotificationPreferences(user.id),
  ]);
  return (
    <main className="mx-auto min-h-screen max-w-3xl p-6 md:p-10">
      <h1 className="text-3xl font-bold">My Profile</h1>
      <p className="mt-2 text-muted-foreground">
        Manage self-declared affiliations. Admins can also add or revoke
        affiliations from the admin dashboard.
      </p>
      <AffiliationManager orgs={orgs ?? []} initialAffiliations={affiliations ?? []} />
      <NotificationPreferencesForm initialPreferences={notificationPreferences} />
    </main>
  );
}
