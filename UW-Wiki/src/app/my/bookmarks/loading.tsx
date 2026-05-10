export default function LoadingBookmarks() {
  return (
    <main className="flex min-h-screen w-full flex-col gap-6 px-6 py-10 md:px-10 lg:px-16">
      <div className="h-9 w-48 rounded bg-muted" />
      <div className="mt-6 space-y-3">
        {[0, 1, 2].map((item) => (
          <div key={item} className="h-32 rounded-lg border border-border bg-card" />
        ))}
      </div>
    </main>
  );
}
