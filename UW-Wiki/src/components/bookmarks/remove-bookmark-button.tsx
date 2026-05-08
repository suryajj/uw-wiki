"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";

export function RemoveBookmarkButton({ pageId }: { pageId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function remove() {
    setLoading(true);
    await fetch("/api/bookmarks/toggle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ page_id: pageId, desired_state: "unbookmarked" }),
    });
    setLoading(false);
    router.refresh();
  }

  return (
    <Button type="button" variant="outline" size="sm" disabled={loading} onClick={remove}>
      {loading ? "Removing..." : "Remove"}
    </Button>
  );
}
