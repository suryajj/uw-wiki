"use client";

import { AuthCard } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="relative w-full max-w-md">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="absolute right-2 top-2 z-10"
          onClick={onClose}
          aria-label="Close sign in"
        >
          Close
        </Button>
        <AuthCard
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
