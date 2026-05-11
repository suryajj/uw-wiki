"use client";

import { History, PencilLine } from "lucide-react";
import Link from "next/link";

import { Tooltip } from "@/components/ui/tooltip";

const ICON_BUTTON =
  "inline-flex h-8 w-8 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors duration-150 hover:border-foreground hover:text-foreground";

export function ViewHistoryButton({ href }: { href: string }) {
  return (
    <Tooltip label="View edit history">
      <Link href={href} aria-label="View edit history" className={ICON_BUTTON}>
        <History className="size-4" />
      </Link>
    </Tooltip>
  );
}

export function ProposeEditButton() {
  function trigger() {
    window.dispatchEvent(new CustomEvent("wiki:propose-edit"));
  }
  return (
    <Tooltip label="Propose an edit">
      <button
        type="button"
        onClick={trigger}
        aria-label="Propose an edit"
        className={ICON_BUTTON}
      >
        <PencilLine className="size-4" />
      </button>
    </Tooltip>
  );
}
