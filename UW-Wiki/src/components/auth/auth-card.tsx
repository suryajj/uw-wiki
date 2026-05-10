"use client";

import { useMemo, useState, type FormEvent } from "react";

import { clientEnv } from "@/lib/config/env-client";
import { createClient } from "@/lib/supabase/client";

type Mode = "signIn" | "signUp" | "magic" | "reset";

const MODE_TITLES: Record<Mode, string> = {
  signIn: "Log into your account",
  signUp: "Create your account",
  magic: "Email sign-in link",
  reset: "Reset your password",
};

const MODE_SUBMIT: Record<Mode, string> = {
  signIn: "Continue with email",
  signUp: "Create account",
  magic: "Send sign-in link",
  reset: "Send reset link",
};

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
  const [showEmailForm, setShowEmailForm] = useState(false);
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

  function pickMode(next: Mode) {
    setMode(next);
    setShowEmailForm(true);
    setError(null);
    setMessage(null);
  }

  return (
    <div className={embedded ? "w-full" : "mx-auto w-full max-w-sm"}>
      <h1 className="text-3xl font-semibold tracking-tight text-[#fdfdfd] md:text-4xl">
        {MODE_TITLES[mode]}
      </h1>
      <p className="mt-2 text-sm text-[#888888]">
        Continue to UW Wiki. You can still browse anonymously.
      </p>

      <div className="mt-8 flex flex-col gap-3">
        <button
          type="button"
          disabled={loading}
          onClick={google}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#fdfdfd] px-5 text-sm font-medium text-[#141414] transition-opacity duration-150 hover:opacity-90 disabled:opacity-50"
        >
          <GoogleGlyph />
          Continue with Google
        </button>

        <div className="relative my-2 flex items-center">
          <span className="h-px flex-1 bg-[#2a2a2a]" />
        </div>

        <button
          type="button"
          onClick={() => pickMode("signIn")}
          className={authPillClass(mode === "signIn" && showEmailForm)}
        >
          <MailGlyph />
          Sign in with email
        </button>
        <button
          type="button"
          onClick={() => pickMode("magic")}
          className={authPillClass(mode === "magic" && showEmailForm)}
        >
          <SparkGlyph />
          Email me a sign-in link
        </button>
        <button
          type="button"
          onClick={() => pickMode("signUp")}
          className={authPillClass(mode === "signUp" && showEmailForm)}
        >
          <UserGlyph />
          Create a new account
        </button>
        <button
          type="button"
          onClick={() => pickMode("reset")}
          className="self-start pt-1 text-xs text-[#888888] transition-colors duration-150 hover:text-[#fdfdfd]"
        >
          Forgot your password?
        </button>
      </div>

      {showEmailForm ? (
        <form onSubmit={submit} className="mt-6 flex flex-col gap-3 border-t border-[#2a2a2a] pt-6">
          {mode === "signUp" ? (
            <AuthInput
              label="Display name"
              value={displayName}
              onChange={setDisplayName}
              required
              minLength={2}
              maxLength={50}
            />
          ) : null}
          <AuthInput
            label="Email"
            type="email"
            value={email}
            onChange={setEmail}
            required
          />
          {mode === "signIn" || mode === "signUp" ? (
            <AuthInput
              label="Password"
              type="password"
              value={password}
              onChange={setPassword}
              required
              minLength={8}
            />
          ) : null}
          <button
            type="submit"
            disabled={loading}
            className="mt-2 inline-flex h-12 w-full items-center justify-center rounded-full bg-[#fdfdfd] px-5 text-sm font-medium text-[#141414] transition-opacity duration-150 hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Working…" : MODE_SUBMIT[mode]}
          </button>
        </form>
      ) : null}

      {error ? <p className="mt-4 text-sm text-[#ff7a7a]">{error}</p> : null}
      {message ? <p className="mt-4 text-sm text-[#888888]">{message}</p> : null}
    </div>
  );
}

function authPillClass(active: boolean): string {
  const base =
    "inline-flex h-12 w-full items-center justify-center gap-2 rounded-full border px-5 text-sm font-medium transition-colors duration-150";
  return active
    ? `${base} border-[#fdfdfd] bg-[#1f1f1f] text-[#fdfdfd]`
    : `${base} border-[#2a2a2a] bg-transparent text-[#fdfdfd] hover:border-[#fdfdfd]`;
}

function AuthInput({
  label,
  value,
  onChange,
  type = "text",
  required,
  minLength,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  type?: string;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm text-[#fdfdfd]">
      <span className="text-[11px] uppercase tracking-[0.16em] text-[#888888]">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        minLength={minLength}
        maxLength={maxLength}
        className="h-11 w-full rounded-md border border-[#2a2a2a] bg-transparent px-3 text-sm text-[#fdfdfd] outline-none transition-colors duration-150 placeholder:text-[#666666] focus:border-[#fdfdfd]"
      />
    </label>
  );
}

function GoogleGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  );
}

function MailGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </svg>
  );
}

function SparkGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.5 5.5l2.8 2.8M15.7 15.7l2.8 2.8M5.5 18.5l2.8-2.8M15.7 8.3l2.8-2.8" />
    </svg>
  );
}

function UserGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
    </svg>
  );
}
