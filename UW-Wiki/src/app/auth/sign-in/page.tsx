import { AuthCard } from "@/components/auth/auth-card";
import { sanitizeReturnTo } from "@/lib/auth/guards";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const { returnTo } = await searchParams;
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <AuthCard returnTo={sanitizeReturnTo(returnTo)} />
    </main>
  );
}
