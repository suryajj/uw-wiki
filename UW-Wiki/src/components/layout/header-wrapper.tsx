"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const HIDDEN_ON = ["/auth/sign-in", "/auth/sign-up", "/auth/reset", "/auth/verify"];

export function HeaderWrapper({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const hidden = HIDDEN_ON.some((p) => pathname.startsWith(p));
  if (hidden) return null;
  return <>{children}</>;
}
