import type { LifecycleConfig, LifecycleStatus } from "@/types/domain";

export function computeLifecycleStatus(
  lastModifiedAt: string | Date,
  config: LifecycleConfig,
): LifecycleStatus {
  const lastModified =
    typeof lastModifiedAt === "string" ? new Date(lastModifiedAt) : lastModifiedAt;
  const daysSince = Math.floor(
    (Date.now() - lastModified.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (daysSince >= config.defunctDays) return "potentially_defunct";
  if (daysSince >= config.staleDays) return "stale";
  if (daysSince >= config.needsUpdateDays) return "needs_update";
  return "active";
}

export type LifecycleBannerCopy = {
  label: string;
  message: string;
  tone: "ok" | "warn" | "alert" | "danger";
};

/**
 * FRD-2 §9.4 banner copy. The defunct case interpolates the configured
 * threshold so readers see "over [N] months", which matches the spec.
 */
export function bannerForStatus(
  status: LifecycleStatus,
  config: LifecycleConfig,
): LifecycleBannerCopy {
  const months = Math.max(1, Math.round(config.defunctDays / 30.44));
  switch (status) {
    case "active":
      return { label: "Active", message: "This page is up to date.", tone: "ok" };
    case "needs_update":
      return {
        label: "Needs Update",
        message:
          "This page hasn't been updated in a while. Information may be outdated.",
        tone: "warn",
      };
    case "stale":
      return {
        label: "Stale",
        message: "This page is stale. The information here may no longer be accurate.",
        tone: "alert",
      };
    case "potentially_defunct":
      return {
        label: "Potentially Defunct",
        message: `This organization may be defunct. This page has not been updated in over ${months} months.`,
        tone: "danger",
      };
  }
}
