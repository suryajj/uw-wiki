"use client";

import { toast as sonnerToast } from "sonner";

/**
 * Thin wrapper around sonner. All app code imports from here so we can swap
 * implementations later, theme consistently, and add telemetry in one place.
 */
export const toast = {
  success(message: string, opts?: { description?: string }) {
    return sonnerToast.success(message, opts);
  },
  error(message: string, opts?: { description?: string }) {
    return sonnerToast.error(message, opts);
  },
  info(message: string, opts?: { description?: string }) {
    return sonnerToast(message, opts);
  },
  /**
   * Shows a loading toast that automatically transitions to success or error
   * based on the promise outcome. Useful for one-shot mutations where you
   * don't need to drive a button's loading state separately.
   */
  promise<T>(
    promise: Promise<T>,
    opts: {
      loading: string;
      success: string | ((result: T) => string);
      error: string | ((error: unknown) => string);
    },
  ) {
    return sonnerToast.promise(promise, opts);
  },
  /**
   * Convert any thrown value into a human-readable message. Looks at
   * `Error.message`, `{error: string}`, or falls back to a string cast.
   */
  errorFromUnknown(error: unknown, fallback = "Something went wrong."): string {
    if (error instanceof Error && error.message) return error.message;
    if (typeof error === "string") return error;
    if (error && typeof error === "object" && "error" in error) {
      const e = (error as { error: unknown }).error;
      if (typeof e === "string") return e;
    }
    if (error && typeof error === "object" && "message" in error) {
      const m = (error as { message: unknown }).message;
      if (typeof m === "string") return m;
    }
    return fallback;
  },
};
