import Link from "next/link";

import { getCurrentUser } from "@/lib/auth/current-user";

export async function SiteHeader() {
  const user = await getCurrentUser();
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <Link href="/" className="font-semibold text-primary">
          UW Wiki
        </Link>
        <nav className="flex items-center gap-3 text-sm">
          <Link className="text-muted-foreground hover:text-foreground" href="/search">
            Search
          </Link>
          {user?.role === "reviewer" || user?.role === "admin" ? (
            <Link className="text-muted-foreground hover:text-foreground" href="/admin/reviews">
              Admin
            </Link>
          ) : null}
          {user ? (
            <div className="flex items-center gap-2">
              <Link className="text-muted-foreground hover:text-foreground" href="/my/profile">
                {user.displayName ?? user.email}
              </Link>
              <form action="/api/auth/sign-out" method="post">
                <button className="rounded-md border border-border px-2 py-1 text-xs" type="submit">
                  Sign Out
                </button>
              </form>
            </div>
          ) : (
            <Link
              href="/auth/sign-in"
              className="rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground"
            >
              Sign In
            </Link>
          )}
        </nav>
      </div>
      {user && !user.emailVerifiedAt ? (
        <div className="border-t border-yellow-600 bg-yellow-950/30 px-4 py-2 text-center text-xs text-yellow-200">
          Please verify your email address. You can keep using UW Wiki while
          unverified.
        </div>
      ) : null}
    </header>
  );
}
