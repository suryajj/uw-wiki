import { requireUser } from "@/lib/auth/guards";

export default async function MyBookmarksPage() {
  await requireUser({ returnTo: "/my/bookmarks" });
  return (
    <main className="mx-auto min-h-screen max-w-3xl p-6 md:p-10">
      <h1 className="text-3xl font-bold">My Bookmarks</h1>
      <p className="mt-2 text-muted-foreground">
        Bookmark listing lands in FRD-8. The toggle API exists now so FRD-6
        pending actions can replay.
      </p>
    </main>
  );
}
