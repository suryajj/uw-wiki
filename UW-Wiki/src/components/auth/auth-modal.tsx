"use client";

import { AuthCard } from "@/components/auth/auth-card";

export function AuthModal({
  open,
  returnTo = "/",
  onClose,
  onSuccess,
}: {
  open: boolean;
  returnTo?: string;
  onClose: () => void;
  onSuccess?: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
      <div className="relative w-full max-w-md rounded-md border border-[#2a2a2a] bg-[#141414] p-8 text-[#fdfdfd]">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close sign in"
          className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full text-[#888888] transition-colors duration-150 hover:bg-[#1f1f1f] hover:text-[#fdfdfd]"
        >
          ×
        </button>
        <AuthCard
          embedded
          returnTo={returnTo}
          onSuccess={() => {
            onSuccess?.();
            onClose();
          }}
        />
      </div>
    </div>
  );
}
