/**
 * Streamed by Next.js the instant a user clicks a link to /wiki/<slug>.
 * Shape mirrors `WikiPage` (TOC sidebar + article + pulse aside) so the
 * eventual hydration swap is visually quiet — users perceive the click as
 * instant even when the org + page + pulse aggregates are still loading.
 *
 * Server component with zero JS payload. Animated via Tailwind's
 * `animate-pulse`, which is pure CSS keyframes.
 */
export default function LoadingWikiArticle() {
  return (
    <main className="flex min-h-screen w-full">
      <div className="grid w-full grid-cols-1 gap-8 px-6 py-10 md:px-10 lg:grid-cols-[200px_1fr] lg:px-16">
        {/* TOC skeleton */}
        <aside className="hidden flex-col gap-3 lg:flex">
          <div className="h-3 w-24 rounded bg-muted/60 animate-pulse" />
          {[0, 1, 2, 3, 4, 5].map((item) => (
            <div
              key={item}
              className="h-3 rounded bg-muted/40 animate-pulse"
              style={{ width: `${60 + ((item * 11) % 35)}%` }}
            />
          ))}
        </aside>

        {/* Article skeleton */}
        <article className="relative flex flex-col gap-6">
          {/* Pulse aside (floats right on lg+) */}
          <aside className="mb-4 w-full lg:float-right lg:ml-8 lg:w-[320px]">
            <div className="overflow-hidden rounded-md border border-border">
              <div className="border-b border-border px-4 py-3">
                <div className="h-3 w-24 rounded bg-muted animate-pulse" />
              </div>
              {[0, 1, 2].map((row) => (
                <div
                  key={row}
                  className="flex items-center justify-between gap-4 border-b border-border px-4 py-3 last:border-b-0"
                >
                  <div className="h-4 w-24 rounded bg-muted animate-pulse" />
                  <div className="h-4 w-16 rounded bg-muted/60 animate-pulse" />
                </div>
              ))}
              <div className="border-t border-border px-4 py-3">
                <div className="h-3 w-28 rounded bg-muted animate-pulse" />
              </div>
            </div>
          </aside>

          {/* Title + actions */}
          <header className="flex flex-wrap items-center justify-between gap-3">
            <div className="h-10 w-72 rounded bg-muted animate-pulse" />
            <div className="flex gap-2">
              {[0, 1, 2].map((b) => (
                <div key={b} className="size-9 rounded-full bg-muted animate-pulse" />
              ))}
            </div>
          </header>

          {/* Body paragraphs */}
          <div className="flex flex-col gap-4">
            {[0, 1, 2, 3, 4, 5].map((para) => (
              <div key={para} className="flex flex-col gap-2">
                {[0, 1, 2].map((line) => (
                  <div
                    key={line}
                    className="h-3 rounded bg-muted/50 animate-pulse"
                    style={{ width: `${80 + ((para * 13 + line * 9) % 18)}%` }}
                  />
                ))}
              </div>
            ))}
          </div>
        </article>
      </div>
    </main>
  );
}
