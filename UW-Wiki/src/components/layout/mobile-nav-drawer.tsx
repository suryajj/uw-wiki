"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Dialog as DialogPrimitive } from "radix-ui";

/**
 * Slide-in right-side panel for the mobile header. Only rendered below the
 * `md` breakpoint; desktop continues to use the inline link cluster in
 * `SiteHeader`.
 *
 * Built directly on the Radix Dialog primitive (rather than our project's
 * centered `DialogContent`) because we need a sheet-style layout — full
 * viewport height, anchored to the right edge, slide animation — that the
 * default modal styling doesn't provide.
 */
export type MobileNavDrawerProps = {
  isAuthenticated: boolean;
  displayName: string | null;
  email: string | null;
  showAdmin: boolean;
};

export function MobileNavDrawer({
  isAuthenticated,
  displayName,
  email,
  showAdmin,
}: MobileNavDrawerProps) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger asChild>
        <button
          type="button"
          aria-label="Open menu"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors duration-150 hover:bg-[color:var(--surface-2)] hover:text-foreground md:hidden"
        >
          <Menu className="size-5" aria-hidden="true" />
        </button>
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className="fixed inset-0 z-50 bg-black/50 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0 md:hidden"
        />
        <DialogPrimitive.Content
          className="fixed inset-y-0 right-0 z-50 flex h-full w-[min(320px,80vw)] flex-col gap-0 border-l border-border bg-background shadow-xl outline-none data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:animate-in data-[state=open]:slide-in-from-right md:hidden"
          aria-describedby={undefined}
        >
          <DialogPrimitive.Title className="sr-only">
            Navigation menu
          </DialogPrimitive.Title>

          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <span className="text-base font-semibold tracking-tight text-foreground">
              UW Wiki
            </span>
            <DialogPrimitive.Close asChild>
              <button
                type="button"
                aria-label="Close menu"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors duration-150 hover:bg-[color:var(--surface-2)] hover:text-foreground"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </DialogPrimitive.Close>
          </div>

          <nav className="flex flex-1 flex-col overflow-y-auto px-2 py-3 text-base">
            <DrawerLink href="/orgs" onSelect={close}>
              Articles
            </DrawerLink>
            {showAdmin ? (
              <DrawerLink href="/admin/reviews" onSelect={close}>
                Admin
              </DrawerLink>
            ) : null}
            {isAuthenticated ? (
              <>
                <DrawerLink href="/my/bookmarks" onSelect={close}>
                  Bookmarks
                </DrawerLink>
                <DrawerLink href="/my/contributions" onSelect={close}>
                  Contributions
                </DrawerLink>
                <DrawerLink href="/my/profile" onSelect={close}>
                  {displayName ?? email ?? "Profile"}
                </DrawerLink>

                <div className="my-3 border-t border-border" />

                <form action="/api/auth/sign-out" method="post" className="px-3">
                  <button
                    type="submit"
                    className="w-full rounded-full border border-border px-3 py-2 text-sm text-muted-foreground transition-colors duration-150 hover:border-foreground hover:text-foreground"
                  >
                    Sign Out
                  </button>
                </form>
              </>
            ) : (
              <>
                <div className="my-3 border-t border-border" />
                <DrawerLink href="/auth/sign-in" onSelect={close}>
                  Sign In
                </DrawerLink>
              </>
            )}
          </nav>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function DrawerLink({
  href,
  onSelect,
  children,
}: {
  href: string;
  onSelect: () => void;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={onSelect}
      className="rounded-md px-3 py-3 text-foreground transition-colors duration-150 hover:bg-[color:var(--surface-2)]"
    >
      {children}
    </Link>
  );
}
