import { Button } from "@/components/ui/button";
import { bannerForStatus } from "@/lib/lifecycle";
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
    <div className="flex flex-col gap-3 border-y border-border bg-[color:var(--surface-2)] px-4 py-3 md:flex-row md:items-center md:justify-between">
      <div className="flex flex-col">
        <span className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          {banner.label}
        </span>
        <p className="text-sm text-foreground">{banner.message}</p>
      </div>
      <Button asChild size="sm" variant="outline">
        <a href={onProposeHref}>Propose Edit</a>
      </Button>
    </div>
  );
}
