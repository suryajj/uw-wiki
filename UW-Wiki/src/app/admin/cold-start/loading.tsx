/**
 * Loading state for the Cold Start admin page. Streams immediately on
 * navigation so admins see structure (heading + form fields) instead of a
 * blank screen while the server resolves auth + categories.
 */
export default function LoadingColdStart() {
  return (
    <main className="flex min-h-screen w-full flex-col gap-6 px-6 py-10 md:px-10 lg:px-16">
      <div className="flex flex-col gap-2">
        <div className="h-7 w-44 rounded bg-muted animate-pulse" />
        <div className="h-4 w-96 max-w-full rounded bg-muted/60 animate-pulse" />
      </div>
      <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-6">
        <div className="h-3 w-32 rounded bg-muted/60 animate-pulse" />
        <div className="h-10 w-full rounded-md bg-muted animate-pulse" />
        <div className="h-3 w-24 rounded bg-muted/60 animate-pulse" />
        <div className="h-10 w-full rounded-md bg-muted animate-pulse" />
        <div className="flex gap-2 pt-2">
          <div className="h-9 w-24 rounded-full bg-muted animate-pulse" />
          <div className="h-9 w-28 rounded-full bg-muted/60 animate-pulse" />
        </div>
      </div>
    </main>
  );
}
