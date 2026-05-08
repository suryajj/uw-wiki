export default function LoadingContributions() {
  return (
    <main className="mx-auto min-h-screen max-w-5xl p-6 md:p-10">
      <div className="h-9 w-56 rounded bg-muted" />
      <div className="mt-6 space-y-3">
        {[0, 1, 2].map((item) => (
          <div key={item} className="h-32 rounded-lg border border-border bg-card" />
        ))}
      </div>
    </main>
  );
}
