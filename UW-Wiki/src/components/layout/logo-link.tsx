"use client";

import Link from "next/link";

export function LogoLink() {
  return (
    <Link
      href="/"
      className="flex items-baseline gap-2 text-2xl font-semibold tracking-tight text-foreground transition-colors duration-150 hover:opacity-80"
      onClick={() => {
        window.location.href = "/";
      }}
    >
      <span>UW Wiki</span>
      <span className="text-xs font-normal italic text-muted-foreground">v0.1</span>
    </Link>
  );
}
