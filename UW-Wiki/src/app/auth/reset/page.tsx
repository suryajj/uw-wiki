"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";

import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sessionReady, setSessionReady] = useState<boolean | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      setSessionReady(!!data.session);
      if (!data.session) {
        setError("This reset link is invalid or expired. Request a new password reset email.");
      }
    });
  }, []);

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
    <div className="grid min-h-screen w-full grid-cols-1 bg-[#141414] text-[#fdfdfd] md:grid-cols-2">
      <div className="flex flex-col justify-between bg-[#141414] px-8 py-10 md:px-16 md:py-14">
        <Link href="/" className="text-base font-semibold tracking-tight text-[#fdfdfd]">
          UW Wiki
        </Link>

        <div className="my-auto flex w-full justify-center py-12">
          <div className="mx-auto w-full max-w-sm">
            <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
              Reset your password
            </h1>
            <p className="mt-2 text-sm text-[#888888]">
              Choose a new password for your UW Wiki account.
            </p>

            <form onSubmit={submit} className="mt-8 flex flex-col gap-3">
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="text-[11px] uppercase tracking-[0.16em] text-[#888888]">
                  New password
                </span>
                <input
                  type="password"
                  minLength={8}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="h-11 w-full rounded-md border border-[#2a2a2a] bg-transparent px-3 text-sm text-[#fdfdfd] outline-none transition-colors duration-150 focus:border-[#fdfdfd]"
                  required
                />
              </label>
              <button
                type="submit"
                disabled={loading || sessionReady !== true}
                className="mt-2 inline-flex h-12 w-full items-center justify-center rounded-full bg-[#fdfdfd] px-5 text-sm font-medium text-[#141414] transition-opacity duration-150 hover:opacity-90 disabled:opacity-50"
              >
                {loading ? "Saving…" : sessionReady === null ? "Checking link…" : "Save password"}
              </button>
            </form>

            {error ? <p className="mt-4 text-sm text-[#ff7a7a]">{error}</p> : null}
            {message ? <p className="mt-4 text-sm text-[#888888]">{message}</p> : null}
          </div>
        </div>

        <p className="text-center text-xs text-[#666666]">
          Need help?{" "}
          <Link href="/" className="underline-offset-4 hover:underline">
            Back to UW Wiki
          </Link>
        </p>
      </div>

      <div
        aria-hidden="true"
        className="relative hidden overflow-hidden bg-[#141414] md:block"
        style={{
          backgroundImage:
            "radial-gradient(circle at 75% 30%, #3a3a3a 0%, #1a1a1a 35%, #141414 70%)",
        }}
      >
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className="select-none text-[28vw] font-semibold leading-none tracking-tighter text-[#fdfdfd]"
            style={{ opacity: 0.04 }}
          >
            UW
          </span>
        </div>
      </div>
    </div>
  );
}
