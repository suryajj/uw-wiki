import { requireUser } from "@/lib/auth/guards";

export default async function MyContributionsPage() {
  await requireUser({ returnTo: "/my/contributions" });
  return (
    <main className="mx-auto min-h-screen max-w-3xl p-6 md:p-10">
      <h1 className="text-3xl font-bold">My Contributions</h1>
      <p className="mt-2 text-muted-foreground">
        Contribution history lands with FRD-8. Your attributed proposals will
        appear here once that listing is implemented.
      </p>
    </main>
  );
}
