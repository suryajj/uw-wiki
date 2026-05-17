"use client";

import { Button } from "@/components/ui/button";
import type { UseActionReturn } from "@/lib/ui/use-action";

type SubmitButtonProps = React.ComponentProps<typeof Button> & {
  /**
   * If provided, wires `loading` and disables the button from the action's
   * pending state. The button still fires its own `onClick` — pair with the
   * action's `run()` inside that handler.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  action?: UseActionReturn<any>;
};

/**
 * Convenience submit button: pass a `useAction` result and the loading state
 * is wired automatically. Behaves like a regular Button otherwise.
 */
export function SubmitButton({ action, loading, disabled, ...props }: SubmitButtonProps) {
  return (
    <Button
      type={props.type ?? "submit"}
      loading={loading || action?.pending}
      disabled={disabled || action?.pending}
      {...props}
    />
  );
}
