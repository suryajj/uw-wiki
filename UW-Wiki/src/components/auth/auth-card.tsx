"use client";

import { useMemo, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { clientEnv } from "@/lib/config/env-client";
import { createClient } from "@/lib/supabase/client";

type Mode = "signIn" | "signUp" | "magic" | "reset";

export function AuthCard({
  returnTo = "/",
  embedded = false,
  onSuccess,
}: {
  returnTo?: string;
  embedded?: boolean;
  onSuccess?: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [mode, setMode] = useState<Mode>("signIn");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const callbackUrl = `${clientEnv.NEXT_PUBLIC_APP_URL}/auth/callback?returnTo=${encodeURIComponent(returnTo)}`;
  const resetUrl = `${clientEnv.NEXT_PUBLIC_APP_URL}/auth/callback?type=recovery&returnTo=${encodeURIComponent("/auth/reset")}`;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      if (mode === "signIn") {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
        setMessage("Signed in.");
        onSuccess?.();
        window.location.assign(returnTo);
      } else if (mode === "signUp") {
        if (displayName.trim().length < 2 || displayName.trim().length > 50) {
          throw new Error("Display name must be 2-50 characters.");
        }
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: callbackUrl,
            data: { display_name: displayName.trim() },
          },
        });
        if (signUpError) throw signUpError;
        setMessage("Account created. Check your email to verify your address.");
        onSuccess?.();
      } else if (mode === "magic") {
        const { error: magicError } = await supabase.auth.signInWithOtp({
          email,
          options: {
            shouldCreateUser: false,
            emailRedirectTo: callbackUrl,
          },
        });
        if (magicError) {
          // Non-enumeration: always show success.
          setMessage("If that email exists, a sign-in link has been sent.");
        } else {
          setMessage("Check your email for a sign-in link.");
        }
      } else {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(
          email,
          { redirectTo: resetUrl },
        );
        if (resetError) {
          setMessage("If that email exists, a reset link has been sent.");
        } else {
          setMessage("Check your email for a password reset link.");
        }
      }
    } catch {
      setError("Authentication failed. Check your details and try again.");
    } finally {
      setLoading(false);
    }
  }

  async function google() {
    setLoading(true);
    setError(null);
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callbackUrl },
    });
    if (oauthError) {
      setLoading(false);
      setError("Could not start Google sign-in.");
    }
  }

  return (
    <section
      className={
        embedded
          ? "w-full rounded-lg border border-border bg-card p-6"
          : "w-full max-w-md rounded-lg border border-border bg-card p-6"
      }
    >
      <div className="mb-5">
        <h1 className="text-2xl font-semibold">
          {mode === "signUp"
            ? "Create account"
            : mode === "magic"
              ? "Email sign-in link"
              : mode === "reset"
                ? "Reset password"
                : "Sign in"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Continue to UW Wiki. You can still browse anonymously.
        </p>
      </div>

      <form onSubmit={submit} className="space-y-3">
        {mode === "signUp" ? (
          <label className="block text-sm">
            Display name
            <input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              minLength={2}
              maxLength={50}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2"
              required
            />
          </label>
        ) : null}
        <label className="block text-sm">
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2"
            required
          />
        </label>
        {mode === "signIn" || mode === "signUp" ? (
          <label className="block text-sm">
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={8}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2"
              required
            />
          </label>
        ) : null}
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Working..." : mode === "signUp" ? "Create account" : mode === "magic" ? "Send link" : mode === "reset" ? "Send reset link" : "Sign in"}
        </Button>
      </form>

      <Button
        type="button"
        variant="outline"
        className="mt-3 w-full"
        disabled={loading}
        onClick={google}
      >
        Continue with Google
      </Button>

      {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
      {message ? <p className="mt-3 text-sm text-muted-foreground">{message}</p> : null}

      <div className="mt-5 flex flex-wrap gap-3 text-sm">
        <button type="button" className="text-primary hover:underline" onClick={() => setMode("signIn")}>
          Password sign in
        </button>
        <button type="button" className="text-primary hover:underline" onClick={() => setMode("magic")}>
          Magic link
        </button>
        <button type="button" className="text-primary hover:underline" onClick={() => setMode("signUp")}>
          Sign up
        </button>
        <button type="button" className="text-primary hover:underline" onClick={() => setMode("reset")}>
          Forgot password?
        </button>
      </div>
    </section>
  );
}
