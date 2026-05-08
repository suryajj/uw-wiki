import "server-only";

import { createClient } from "@/lib/supabase/server";
import { computeLifecycleStatus } from "@/lib/lifecycle";
import { ensureSectionSlugs } from "@/lib/prosemirror/sections";
import type {
  DirectoryOrg,
  ExternalLink,
  LifecycleConfig,
  OrgCategory,
  PageVersionSummary,
  ProseMirrorDoc,
  PulseAggregate,
  PulseMetric,
  WikiPageData,
} from "@/types/domain";

const UW_UNIVERSITY_SLUG = "uw";

async function getDefaultUniversityId(): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("universities")
    .select("id")
    .eq("slug", UW_UNIVERSITY_SLUG)
    .maybeSingle();
  return data?.id ?? null;
}

type OrgRow = {
  id: string;
  org_slug: string;
  org_name: string;
  category: OrgCategory;
  tagline: string | null;
  pages: { slug: string | null }[] | { slug: string | null } | null;
};

export async function listDirectoryOrgs(): Promise<DirectoryOrg[]> {
  const supabase = await createClient();
  const universityId = await getDefaultUniversityId();
  let query = supabase
    .from("organizations")
    .select("id, org_slug, org_name, category, tagline, pages(slug)")
    .order("org_name", { ascending: true });
  if (universityId) {
    query = query.eq("university_id", universityId);
  }
  const { data, error } = await query;

  if (error) throw error;

  return (data as OrgRow[] | null ?? []).map((row) => ({
    id: row.id,
    orgSlug: row.org_slug,
    orgName: row.org_name,
    category: row.category,
    tagline: row.tagline,
    pageSlug: pageSlug(row.pages),
  }));
}

export async function getWikiPage(slug: string): Promise<WikiPageData | null> {
  const supabase = await createClient();

  const { data: pageRow, error } = await supabase
    .from("pages")
    .select(
      `
      id, content_json, current_version_id, last_modified_at, slug,
      organizations:organizations!inner(
        id, university_id, org_slug, org_name, category, tagline,
        external_links(id, label, url, display_order),
        pulse_aggregates(metric, aggregate_value, aggregate_label, total_votes)
      )
    `,
    )
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw error;
  if (!pageRow) return null;

  type OrgJoin = {
    id: string;
    university_id: string;
    org_slug: string;
    org_name: string;
    category: OrgCategory;
    tagline: string | null;
    external_links: Array<{
      id: string;
      label: string;
      url: string;
      display_order: number;
    }>;
    pulse_aggregates: Array<{
      metric: PulseMetric;
      aggregate_value: string;
      aggregate_label: string;
      total_votes: number;
    }>;
  };
  const org = (Array.isArray(pageRow.organizations)
    ? pageRow.organizations[0]
    : pageRow.organizations) as unknown as OrgJoin;

  let isColdStart = false;
  let isAdminSeeded = false;
  let versionContent: ProseMirrorDoc | null = null;

  if (pageRow.current_version_id) {
    const { data: versionRow } = await supabase
      .from("page_versions")
      .select("is_admin_seeded, is_cold_start, content_json")
      .eq("id", pageRow.current_version_id)
      .maybeSingle();
    isColdStart = !!versionRow?.is_cold_start;
    isAdminSeeded = !!versionRow?.is_admin_seeded;
    if (versionRow?.content_json) {
      versionContent = versionRow.content_json as ProseMirrorDoc;
    }
  }

  const lifecycleConfig = await getLifecycleConfig(org.category);
  const lifecycleStatus = lifecycleConfig
    ? computeLifecycleStatus(pageRow.last_modified_at, lifecycleConfig)
    : "active";

  const externalLinks: ExternalLink[] = (org.external_links ?? [])
    .map((link) => ({
      id: link.id,
      label: link.label,
      url: link.url,
      displayOrder: link.display_order,
    }))
    .sort((a, b) => a.displayOrder - b.displayOrder);

  const pulseAggregates: PulseAggregate[] = (org.pulse_aggregates ?? []).map(
    (agg) => ({
      metric: agg.metric,
      aggregateValue: agg.aggregate_value,
      aggregateLabel: agg.aggregate_label,
      totalVotes: agg.total_votes,
    }),
  );

  // FRD-2 §2.5 #1: render the wiki body from the current page_version, not
  // the legacy `pages.content_json` mirror. Fall back to the mirror only when
  // the FK is null (e.g. a freshly seeded page without a version row).
  const sourceDoc = (versionContent ??
    pageRow.content_json ?? { type: "doc", content: [] }) as ProseMirrorDoc;
  const contentJson = ensureSectionSlugs(sourceDoc);

  return {
    pageId: pageRow.id,
    pageSlug: pageRow.slug ?? org.org_slug,
    orgId: org.id,
    universityId: org.university_id,
    orgName: org.org_name,
    orgSlug: org.org_slug,
    category: org.category,
    tagline: org.tagline,
    contentJson,
    currentVersionId: pageRow.current_version_id,
    lastModifiedAt: pageRow.last_modified_at,
    isColdStart,
    isAdminSeeded,
    pulseAggregates,
    externalLinks,
    lifecycleStatus,
    lifecycleConfig,
  };
}

export async function getLifecycleConfig(
  category: string,
): Promise<LifecycleConfig | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("lifecycle_config")
    .select("category, needs_update_days, stale_days, defunct_days")
    .eq("category", category)
    .maybeSingle();

  if (!data) return null;
  return {
    category: data.category,
    needsUpdateDays: data.needs_update_days,
    staleDays: data.stale_days ?? data.needs_update_days * 2,
    defunctDays: data.defunct_days ?? data.needs_update_days * 4,
  };
}

export async function getPageVersionHistory(
  pageId: string,
): Promise<PageVersionSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("page_versions")
    .select(
      "id, version_number, summary, edit_summary, created_at, is_anonymous, is_admin_seeded, is_cold_start, author:users(display_name)",
    )
    .eq("page_id", pageId)
    .order("version_number", { ascending: false });

  if (error) throw error;
  return (data ?? []).map((row) => {
    const authorRaw = row.author as
      | { display_name: string | null }
      | { display_name: string | null }[]
      | null;
    const author = Array.isArray(authorRaw) ? authorRaw[0] ?? null : authorRaw;
    return {
      id: row.id,
      versionNumber: row.version_number ?? 1,
      summary: row.summary ?? row.edit_summary ?? null,
      createdAt: row.created_at,
      isAnonymous: row.is_anonymous ?? true,
      contributorDisplayName:
        row.is_anonymous || !author?.display_name ? null : author.display_name,
      isAdminSeeded: !!row.is_admin_seeded,
      isColdStart: !!row.is_cold_start,
    };
  });
}

function pageSlug(
  pages: OrgRow["pages"],
): string | null {
  if (!pages) return null;
  if (Array.isArray(pages)) return pages[0]?.slug ?? null;
  return pages.slug ?? null;
}
