import Link from "next/link";

import { NotificationBell } from "@/components/notifications/notification-bell";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { LogoLink } from "@/components/layout/logo-link";
import { getCurrentUser } from "@/lib/auth/current-user";

export async function SiteHeader() {
  const user = await getCurrentUser();
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
      <div className="flex w-full items-center justify-between px-6 py-4 md:px-10">
        <LogoLink />

        <nav className="flex items-center gap-1 text-sm">
          <Link
            className="hidden rounded-full px-3 py-1.5 text-muted-foreground transition-colors duration-150 hover:text-foreground hover:bg-[color:var(--surface-2)] md:inline-flex"
            href="/orgs"
          >
            Orgs
          </Link>
          {user?.role === "reviewer" || user?.role === "admin" ? (
            <Link
              className="rounded-full px-3 py-1.5 text-muted-foreground transition-colors duration-150 hover:text-foreground hover:bg-[color:var(--surface-2)]"
              href="/admin/reviews"
            >
              Admin
            </Link>
          ) : null}
          {user ? (
            <div className="flex items-center gap-1">
              <Link
                className="hidden rounded-full px-3 py-1.5 text-muted-foreground transition-colors duration-150 hover:text-foreground hover:bg-[color:var(--surface-2)] md:inline-flex"
                href="/my/bookmarks"
              >
                Bookmarks
              </Link>
              <Link
                className="hidden rounded-full px-3 py-1.5 text-muted-foreground transition-colors duration-150 hover:text-foreground hover:bg-[color:var(--surface-2)] lg:inline-flex"
                href="/my/contributions"
              >
                Contributions
              </Link>
              <Link
                className="rounded-full px-3 py-1.5 text-muted-foreground transition-colors duration-150 hover:text-foreground hover:bg-[color:var(--surface-2)]"
                href="/my/profile"
              >
                {user.displayName ?? user.email}
              </Link>
              <form action="/api/auth/sign-out" method="post">
                <button
                  className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors duration-150 hover:border-foreground hover:text-foreground"
                  type="submit"
                >
                  Sign Out
                </button>
              </form>
              <ThemeToggle />
              <NotificationBell />
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Link
                href="/auth/sign-in"
                className="rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors duration-150 hover:bg-[color:var(--surface-2)] hover:text-foreground"
              >
                Sign In
              </Link>
            </div>
          )}
        </nav>
      </div>
      {user && !user.emailVerifiedAt ? (
        <div className="border-t border-border bg-[color:var(--surface-2)] px-6 py-2 text-center text-xs text-muted-foreground md:px-10">
          Please verify your email address. You can keep using UW Wiki while
          unverified.
        </div>
      ) : null}
    </header>
  );
}
