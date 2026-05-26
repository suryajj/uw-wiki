import Link from "next/link";

import {
  PendingImageReviewRow,
  type PendingImage,
} from "@/components/admin/pending-image-reviews";
import { requireReviewer } from "@/lib/auth/guards";
import { listProposalQueue } from "@/lib/proposals/service";
import { resolveOrgImageUrl } from "@/lib/storage/org-images";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatRelativeTime } from "@/lib/utils/time";

/**
 * Fetch the moderation queue for header-image uploads. We render this
 * above the text-proposal queue because images are a much faster
 * decision (accept/reject + maybe a reason) than per-section text
 * reviews — surfacing them first keeps the moderator's flow snappy.
 */
async function loadPendingImages(): Promise<PendingImage[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("org_images")
    .select(
      `id, alt, caption, storage_path, created_at,
       organizations:organizations!inner(org_name, org_slug),
       uploader:users(display_name)`,
    )
    .eq("status", "pending")
    .eq("kind", "header")
    .order("created_at", { ascending: true });
  if (!data) return [];
  return data.map((row) => {
    const org = Array.isArray(row.organizations)
      ? row.organizations[0]
      : row.organizations;
    const uploader = Array.isArray(row.uploader) ? row.uploader[0] : row.uploader;
    return {
      id: row.id,
      orgName: org?.org_name ?? "Unknown org",
      orgSlug: org?.org_slug ?? "",
      url: resolveOrgImageUrl(row.storage_path),
      alt: row.alt,
      caption: row.caption,
      uploaderDisplayName: uploader?.display_name ?? null,
      createdAt: row.created_at,
    };
  });
}

export default async function ReviewsPage() {
  await requireReviewer({ returnTo: "/admin/reviews" });
  const [proposals, pendingImages] = await Promise.all([
    listProposalQueue(),
    loadPendingImages(),
  ]);

  return (
    <main className="flex min-h-screen w-full flex-col gap-6 px-6 py-10 md:px-10 lg:px-16">
      <h1 className="text-3xl font-bold">Reviewer Queue</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Section-scoped proposals are ordered FIFO with mergeability badges.
      </p>

      {/* Pending header-image uploads. Empty when nothing is in the queue.
          Rendered above text proposals because image accept/reject is a
          one-click decision and clearing them first keeps the page tidy. */}
      {pendingImages.length > 0 ? (
        <section className="mt-4 space-y-3">
          <h2 className="text-lg font-semibold">
            Pending header images
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              ({pendingImages.length})
            </span>
          </h2>
          {pendingImages.map((image) => (
            <PendingImageReviewRow key={image.id} image={image} />
          ))}
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Pending text proposals</h2>
        <div className="space-y-3">
          {proposals.length === 0 ? (
            <p className="text-sm text-muted-foreground">No pending proposals.</p>
          ) : (
            proposals.map((proposal) => (
              <Link
                key={proposal.id}
                href={`/admin/reviews/${proposal.id}`}
                className="block rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/40"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{proposal.orgName}</p>
                    <p className="text-sm text-muted-foreground">
                      Sections: {proposal.sectionSlugs.join(", ")}
                    </p>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    <p>{proposal.status}</p>
                    <p>{proposal.mergeabilityStatus}</p>
                    <p>{formatRelativeTime(proposal.createdAt)}</p>
                  </div>
                </div>
                {proposal.isFromAffiliatedContributor ? (
                  <p className="mt-2 text-xs text-primary">
                    Submitted by affiliated contributor
                  </p>
                ) : null}
              </Link>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
