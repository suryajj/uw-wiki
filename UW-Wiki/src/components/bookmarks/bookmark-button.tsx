"use client";

import { Bookmark, BookmarkCheck } from "lucide-react";
import { useState } from "react";

import { AuthModal } from "@/components/auth/auth-modal";
import { Button } from "@/components/ui/button";
import { savePendingAction } from "@/lib/pending-actions/storage";

export function BookmarkButton({
  pageId,
  initialState,
  isSignedIn,
  returnTo,
}: {
  pageId: string;
  initialState: "bookmarked" | "unbookmarked";
  isSignedIn: boolean;
  returnTo: string;
}) {
  const [state, setState] = useState(initialState);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const bookmarked = state === "bookmarked";

  async function toggle() {
    const desiredState = bookmarked ? "unbookmarked" : "bookmarked";
    setMessage(null);
    if (!isSignedIn) {
      savePendingAction("bookmark.toggle", { pageId, desiredState }, returnTo);
      setAuthOpen(true);
      return;
    }
    const previous = state;
    setState(desiredState);
    setLoading(true);
    const res = await fetch("/api/bookmarks/toggle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ page_id: pageId, desired_state: desiredState }),
    });
    const body = (await res.json().catch(() => ({}))) as {
      state?: "bookmarked" | "unbookmarked";
      error?: string;
    };
    setLoading(false);
    if (!res.ok || !body.state) {
      setState(previous);
      setMessage(body.error ?? "Could not update bookmark.");
      return;
    }
    setState(body.state);
    setMessage(body.state === "bookmarked" ? "Page bookmarked." : "Bookmark removed.");
  }

  return (
    <div className="relative">
      <Button
        type="button"
        variant={bookmarked ? "default" : "outline"}
        onClick={toggle}
        disabled={loading}
        title={bookmarked ? "Remove bookmark" : "Bookmark page"}
        aria-label={bookmarked ? "Remove bookmark" : "Bookmark page"}
      >
        {bookmarked ? <BookmarkCheck className="mr-2 size-5" /> : <Bookmark className="mr-2 size-5" />}
        {bookmarked ? "Bookmarked" : "Bookmark"}
      </Button>
      {message ? (
        <p className="absolute right-0 mt-2 w-48 text-right text-xs text-muted-foreground">
          {message}
        </p>
      ) : null}
      <AuthModal
        open={authOpen}
        returnTo={returnTo}
        onClose={() => setAuthOpen(false)}
      />
    </div>
  );
}
