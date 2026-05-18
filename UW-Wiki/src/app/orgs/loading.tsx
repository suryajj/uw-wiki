/**
 * Shown by Next.js while `OrgsPage`'s data fetch resolves. Server component,
 * zero runtime cost — Next streams this immediately on navigation, then
 * swaps it for the real page when ready. No router hijacking required.
 *
 * Mirrors the actual page's layout (title block + category sections of
 * rows) so the swap is visually quiet.
 */
export default function LoadingOrgs() {
  return (
    <main className="flex min-h-screen w-full flex-col gap-10 px-6 py-10 md:px-10 lg:px-16">
      <header className="flex flex-col items-center gap-2 pt-4 text-center">
        <div className="h-9 w-40 rounded bg-muted animate-pulse" />
        <div className="h-4 w-72 rounded bg-muted/70 animate-pulse" />
      </header>

      <div className="flex flex-col gap-10">
        <div className="flex items-center justify-end">
          <div className="h-7 w-24 rounded-full bg-muted/60 animate-pulse" />
        </div>
        {[0, 1, 2].map((category) => (
          <section key={category} className="flex flex-col gap-3">
            <div className="h-3 w-40 rounded bg-muted/60 animate-pulse" />
            <div className="flex flex-col border-t border-border">
              {[0, 1, 2, 3].map((row) => (
                <div
                  key={row}
                  className="flex items-baseline justify-between gap-6 border-b border-border py-4"
                >
                  <div className="h-5 w-48 rounded bg-muted animate-pulse" />
                  <div className="hidden h-3 flex-1 max-w-xl rounded bg-muted/60 animate-pulse md:block" />
                  <div className="h-3 w-24 rounded bg-muted/40 animate-pulse" />
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
