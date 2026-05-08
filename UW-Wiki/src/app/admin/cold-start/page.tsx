import { requireAdmin } from "@/lib/auth/guards";
import { ORG_CATEGORIES } from "@/types/domain";
import { ColdStartClient } from "./ui";

export const dynamic = "force-dynamic";

export default async function ColdStartPage() {
  await requireAdmin({ returnTo: "/admin/cold-start" });
  return (
    <main className="mx-auto min-h-screen max-w-5xl p-6 md:p-10">
      <h1 className="text-3xl font-bold">Cold Start Agent</h1>
      <p className="mt-2 text-muted-foreground">
        Identify a UW organization, research it, synthesize a first draft, then
        publish with an AI-generated banner.
      </p>
      <ColdStartClient categories={[...ORG_CATEGORIES]} />
    </main>
  );
}
