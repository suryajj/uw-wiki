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
    <div className="grid min-h-screen w-full grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="border-b border-border px-6 py-8 lg:min-h-screen lg:border-b-0 lg:border-r lg:px-8">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Admin</h1>
        <p className="mt-1 text-xs text-muted-foreground">{user?.email ?? "Not signed in"}</p>
        <nav className="mt-8 flex flex-col gap-3">
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
      <div className="px-6 py-8 md:px-10 lg:px-12">{children}</div>
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
      className="flex items-center justify-between text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground"
    >
      <span>{label}</span>
      {badge ? (
        <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-foreground">
          {badge}
        </span>
      ) : null}
    </Link>
  );
}
