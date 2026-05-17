"use client";

import { useCallback, useRef, useState } from "react";

import { toast } from "@/lib/ui/toast";

export type UseActionOptions<TIn, TOut> = {
  /** Toast on success. Pass false / "" to suppress. */
  successMessage?: string | ((result: TOut, input: TIn) => string) | false;
  /** Toast on error. Default: extract a message from the thrown value. */
  errorMessage?: string | ((error: unknown, input: TIn) => string);
  onSuccess?: (result: TOut, input: TIn) => void | Promise<void>;
  onError?: (error: unknown, input: TIn) => void;
  /**
   * Optimistic update. `apply` runs immediately on `run()`; if the action
   * throws, `revert` runs. Set this for instant interactions like bookmark
   * toggles and vote buttons where the UI should feel immediate.
   */
  optimistic?: { apply: () => void; revert: () => void };
  /** Skip the success toast (errors still toast). */
  quietSuccess?: boolean;
  /** Skip both success AND error toasts. Caller handles all UI feedback. */
  silent?: boolean;
};

export type UseActionReturn<TIn = void> = {
  /**
   * Run the action. Accepts an input argument; pass nothing when TIn is `void`.
   */
  run: (input?: TIn) => Promise<void>;
  pending: boolean;
  error: unknown;
  reset: () => void;
};

/**
 * Wraps an async mutation with a consistent loading + toast + optimistic
 * pattern. Replaces the recurring `setLoading` / `setMessage` / `setSubmitState`
 * boilerplate scattered across the app.
 *
 * Example:
 *   const action = useAction(
 *     async (id: string) => {
 *       const res = await fetch(`/api/foo/${id}`, { method: "POST" });
 *       if (!res.ok) throw new Error("Could not foo.");
 *       return res.json();
 *     },
 *     { successMessage: "Foo'd." },
 *   );
 *   <Button loading={action.pending} onClick={() => action.run("123")}>Foo</Button>
 */
export function useAction<TIn = void, TOut = unknown>(
  perform: (input: TIn) => Promise<TOut>,
  options: UseActionOptions<TIn, TOut> = {},
): UseActionReturn<TIn> {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const run = useCallback(
    async (input?: TIn) => {
      const opts = optionsRef.current;
      // Optimistic: apply immediately so the UI feels instant
      opts.optimistic?.apply();
      setPending(true);
      setError(null);
      try {
        const result = await perform(input as TIn);
        setPending(false);
        // Success toast (unless suppressed)
        if (!opts.silent && !opts.quietSuccess && opts.successMessage !== false) {
          const message =
            typeof opts.successMessage === "function"
              ? opts.successMessage(result, input as TIn)
              : opts.successMessage;
          if (message) toast.success(message);
        }
        await opts.onSuccess?.(result, input as TIn);
      } catch (err) {
        setPending(false);
        setError(err);
        // Revert optimistic state
        opts.optimistic?.revert();
        // Error toast (always shown unless `silent`)
        if (!opts.silent) {
          const fallback = toast.errorFromUnknown(err);
          const message =
            typeof opts.errorMessage === "function"
              ? opts.errorMessage(err, input as TIn)
              : opts.errorMessage ?? fallback;
          toast.error(message);
        }
        opts.onError?.(err, input as TIn);
      }
    },
    [perform],
  );

  const reset = useCallback(() => {
    setPending(false);
    setError(null);
  }, []);

  return { run, pending, error, reset };
}
