import { Button } from "@/components/ui/button";
import { bannerForStatus } from "@/lib/lifecycle";
import { cn } from "@/lib/utils";
import type { LifecycleConfig, LifecycleStatus } from "@/types/domain";

export function LifecycleBanner({
  status,
  config,
  onProposeHref,
}: {
  status: LifecycleStatus;
  config: LifecycleConfig | null;
  onProposeHref: string;
}) {
  if (status === "active" || !config) return null;

  const banner = bannerForStatus(status, config);
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-lg border p-4 md:flex-row md:items-center md:justify-between",
        banner.tone === "warn" && "border-yellow-600 bg-yellow-950/30",
        banner.tone === "alert" && "border-orange-600 bg-orange-950/30",
        banner.tone === "danger" && "border-red-600 bg-red-950/30",
      )}
    >
      <div>
        <p className="font-medium">{banner.label}</p>
        <p className="text-sm text-muted-foreground">{banner.message}</p>
      </div>
      <Button asChild size="sm" variant="outline">
        <a href={onProposeHref}>Propose Edit</a>
      </Button>
    </div>
  );
}
