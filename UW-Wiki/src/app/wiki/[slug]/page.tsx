export default async function WikiPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <h1 className="text-2xl font-semibold">{slug}</h1>
      <p className="mt-2 text-muted-foreground">Coming in FRD-2.</p>
    </main>
  );
}
