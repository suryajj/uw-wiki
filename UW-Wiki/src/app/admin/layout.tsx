import Link from "next/link";

import { getCurrentUser } from "@/lib/auth/current-user";
import { getAdminBadgeCounts } from "@/lib/admin/badges";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  const counts = await getAdminBadgeCounts();
  const isAdmin = user?.role === "admin";
  return (
    <div className="mx-auto grid min-h-screen max-w-7xl grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="border-b border-border bg-card p-4 lg:min-h-screen lg:border-b-0 lg:border-r">
        <h1 className="text-lg font-semibold text-primary">Admin</h1>
        <p className="mt-1 text-xs text-muted-foreground">{user?.email ?? "Not signed in"}</p>
        <nav className="mt-6 flex flex-wrap gap-2 lg:flex-col">
          <AdminLink href="/admin/reviews" label="Reviews" badge={counts.proposals} />
          <AdminLink href="/admin/reports" label="Reports" badge={counts.reports} />
          {isAdmin ? (
            <>
              <AdminLink href="/admin/cold-start" label="Cold Start" badge={counts.coldStart} />
              <AdminLink href="/admin/cold-start/jobs" label="Cold Jobs" />
              <AdminLink href="/admin/official-sections" label="Official Sections" />
              <AdminLink href="/admin/lifecycle" label="Lifecycle" />
              <AdminLink href="/admin/users" label="Users" />
              <AdminLink href="/admin/activity" label="Activity" />
            </>
          ) : null}
        </nav>
      </aside>
      <div>{children}</div>
    </div>
  );
}

function AdminLink({
  href,
  label,
  badge,
}: {
  href: string;
  label: string;
  badge?: number;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm hover:border-primary/50"
    >
      <span>{label}</span>
      {badge ? (
        <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
          {badge}
        </span>
      ) : null}
    </Link>
  );
}
