"use client";

import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (updateError) {
      setError("Could not update password. Open the reset link again and retry.");
      return;
    }
    setMessage("Password updated. You can close this page or return home.");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center p-8">
      <section className="rounded-lg border border-border bg-card p-6">
        <h1 className="text-2xl font-semibold">Reset password</h1>
        <form onSubmit={submit} className="mt-5 space-y-3">
          <label className="block text-sm">
            New password
            <input
              type="password"
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2"
              required
            />
          </label>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Saving..." : "Save password"}
          </Button>
        </form>
        {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
        {message ? <p className="mt-3 text-sm text-muted-foreground">{message}</p> : null}
      </section>
    </main>
  );
}
