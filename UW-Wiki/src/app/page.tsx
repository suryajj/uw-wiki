export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-5xl font-bold tracking-tight text-primary">
        UW Wiki
      </h1>
      <p className="max-w-md text-center text-muted-foreground">
        Honest, student-edited knowledge base for UW extracurriculars.
      </p>
      <p className="text-sm text-muted-foreground">
        Foundation scaffolded — features land in FRDs 1-9.
      </p>
    </main>
  );
}
