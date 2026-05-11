import { tool } from "ai";
import { z } from "zod";

import { searchWikiTool } from "@/lib/ai/rag";
import { eq, inList, supabaseRest } from "@/lib/supabase/rest";
import { ORG_CATEGORIES, PULSE_METRICS, type PulseMetric } from "@/types/domain";

type PulseAggregateRow = {
  metric: PulseMetric;
  aggregate_value: string;
  aggregate_label: string;
  total_votes: number;
};

type OrgWithPulseRow = {
  org_slug: string;
  org_name: string;
  category: string;
  claimed_status?: string | null;
  pages?: { last_modified_at: string | null } | null;
  pulse_aggregates?: PulseAggregateRow[] | null;
};

type RankedPulseRow = {
  aggregate_value: string;
  aggregate_label: string;
  total_votes: number;
  organizations: {
    org_name: string;
    org_slug: string;
    category: string;
  };
};

type OrgListRow = {
  org_name: string;
  org_slug: string;
  category: string;
  pages?: { last_modified_at: string | null } | null;
};

export const getOrgDataTool = tool({
  description:
    "Fetch structured data about one or more UW organizations: Pulse ratings, org category, and page health. Always call this for any named org mentioned in the query; combine with search_wiki for opinions or experiences.",
  inputSchema: z.object({
    orgs: z
      .array(
        z
          .object({
            slug: z.string().optional(),
            name: z.string().optional(),
          })
          .refine((org) => org.slug || org.name, {
            message: "Each org entry must have either a slug or a name",
          }),
      )
      .min(1)
      .max(5),
  }),
  execute: async ({ orgs }) => {
    const resolvedSlugs: string[] = [];
    const unresolvedNames: string[] = [];

    for (const org of orgs) {
      if (org.slug) {
        resolvedSlugs.push(org.slug);
        continue;
      }

      if (!org.name) continue;
      const matches = await supabaseRest<Array<{ org_slug: string }>>(
        `/organizations?select=org_slug&org_name=ilike.${encodeURIComponent(org.name)}&limit=1`,
      );

      if (matches[0]?.org_slug) resolvedSlugs.push(matches[0].org_slug);
      else unresolvedNames.push(org.name);
    }

    if (resolvedSlugs.length === 0) {
      return {
        found: false,
        unresolvedNames,
        message:
          "Could not resolve org name(s). Call search_wiki with the org name as a keyword query to find matching pages and the correct slug.",
      };
    }

    const select = encodeURIComponent(
      "org_slug,org_name,category,claimed_status,pages(last_modified_at),pulse_aggregates(metric,aggregate_value,aggregate_label,total_votes)",
    );
    const rows = await supabaseRest<OrgWithPulseRow[]>(
      `/organizations?select=${select}&org_slug=${inList(resolvedSlugs)}`,
    );

    if (rows.length === 0) {
      return {
        found: false,
        message: `No organizations found for slug(s): ${resolvedSlugs.join(", ")}.`,
      };
    }

    return {
      found: true,
      orgs: rows.map(formatOrgData),
    };
  },
});

export const listOrgsTool = tool({
  description:
    "List UW organizations ranked by a Pulse metric, or filtered by category. Use this for discovery and ranking questions across many orgs. Do not use for questions about a specific named org; use get_org_data for those.",
  inputSchema: z.object({
    metric: z.enum(PULSE_METRICS).optional(),
    order: z.enum(["desc", "asc"]).default("desc"),
    category: z.enum(ORG_CATEGORIES).optional(),
    limit: z.number().int().min(1).max(10).default(5),
  }),
  execute: async ({ metric, order, category, limit }) => {
    if (metric) {
      const select = encodeURIComponent(
        "aggregate_value,aggregate_label,total_votes,organizations!inner(org_name,org_slug,category)",
      );
      const categoryFilter = category
        ? `&organizations.category=${eq(category)}`
        : "";
      // Pull all candidates (the table is small) and sort in app code so
      // numeric metrics aren't compared lexicographically — FRD-1 §13 #25.
      const rows = await supabaseRest<RankedPulseRow[]>(
        `/pulse_aggregates?select=${select}&metric=${eq(metric)}&total_votes=gte.3${categoryFilter}`,
      );

      if (rows.length === 0) {
        return {
          found: false,
          message: `No orgs found with sufficient votes for metric '${metric}'${category ? ` in category '${category}'` : ""}.`,
        };
      }

      const sorted = sortRankedRows(rows, metric, order).slice(0, limit);

      return {
        found: true,
        metric,
        order,
        orgs: sorted.map((row) => ({
          orgName: row.organizations.org_name,
          orgSlug: row.organizations.org_slug,
          category: row.organizations.category,
          value: row.aggregate_value,
          label: row.aggregate_label,
          totalVotes: row.total_votes,
        })),
      };
    }

    const select = encodeURIComponent("org_name,org_slug,category,pages(last_modified_at)");
    const categoryFilter = category ? `&category=${eq(category)}` : "";
    const rows = await supabaseRest<OrgListRow[]>(
      `/organizations?select=${select}${categoryFilter}&order=org_name.asc&limit=${limit}`,
    );

    if (rows.length === 0) {
      return {
        found: false,
        message: `No orgs found${category ? ` in category '${category}'` : ""}.`,
      };
    }

    return {
      found: true,
      metric: metric ?? null,
      orgs: rows.map((row) => ({
        orgName: row.org_name,
        orgSlug: row.org_slug,
        category: row.category,
        lastModifiedAt: row.pages?.last_modified_at ?? null,
      })),
    };
  },
});

const SELECTIVITY_RANK: Record<string, number> = {
  // Higher rank = "more selective". Used so `order: desc` (most selective
  // first) and `order: asc` (most open first) both behave per FRD-1 §5.2c.
  "Invite-Only": 3,
  "Application-Based": 2,
  "Open Membership": 1,
};

function sortRankedRows(
  rows: RankedPulseRow[],
  metric: PulseMetric,
  order: "asc" | "desc",
): RankedPulseRow[] {
  const direction = order === "asc" ? 1 : -1;
  const cloned = [...rows];
  if (metric === "selectivity") {
    cloned.sort((a, b) => {
      const left = SELECTIVITY_RANK[a.aggregate_value] ?? 0;
      const right = SELECTIVITY_RANK[b.aggregate_value] ?? 0;
      return (left - right) * direction;
    });
    return cloned;
  }
  cloned.sort((a, b) => {
    const left = Number.parseFloat(a.aggregate_value);
    const right = Number.parseFloat(b.aggregate_value);
    if (Number.isNaN(left) && Number.isNaN(right)) return 0;
    if (Number.isNaN(left)) return 1;
    if (Number.isNaN(right)) return -1;
    return (left - right) * direction;
  });
  return cloned;
}

export const ragTools = {
  search_wiki: searchWikiTool,
  get_org_data: getOrgDataTool,
  list_orgs: listOrgsTool,
};

function formatOrgData(row: OrgWithPulseRow) {
  const lastModifiedAt = row.pages?.last_modified_at ?? null;

  const pulse = Object.fromEntries(
    (row.pulse_aggregates ?? []).map((aggregate) => [
      aggregate.metric,
      {
        value: aggregate.aggregate_value,
        label: aggregate.aggregate_label,
        totalVotes: aggregate.total_votes,
      },
    ]),
  );

  return {
    orgName: row.org_name,
    orgSlug: row.org_slug,
    category: row.category,
    claimedStatus: row.claimed_status ?? "unclaimed",
    lastModifiedAt,
    pulse: {
      selectivity: pulse.selectivity ?? null,
      vibeCheck: pulse.vibe_check ?? null,
      coopBoost: pulse.coop_boost ?? null,
    },
  };
}
