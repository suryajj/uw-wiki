import Link from "next/link";

import { AuthCard } from "@/components/auth/auth-card";
import { sanitizeReturnTo } from "@/lib/auth/guards";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const { returnTo } = await searchParams;
  return (
    <div className="grid min-h-screen w-full grid-cols-1 bg-[#141414] text-[#fdfdfd] md:grid-cols-2">
      {/* Left: form */}
      <div className="relative flex flex-col justify-between bg-[#141414] px-8 py-10 md:px-16 md:py-14">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-base font-semibold tracking-tight text-[#fdfdfd]">
            UW Wiki
          </Link>
        </div>

        <div className="my-auto flex w-full justify-center py-12">
          <AuthCard returnTo={sanitizeReturnTo(returnTo)} />
        </div>
      </div>

      {/* Right: ambient panel */}
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
