import type { Metadata } from "next";
import { PendingActionResumer } from "@/components/auth/pending-action-resumer";
import { SiteHeader } from "@/components/layout/site-header";
import { getCurrentUser } from "@/lib/auth/current-user";
import "./globals.css";

export const metadata: Metadata = {
  title: "UW Wiki",
  description: "Honest, student-edited knowledge base for UW extracurriculars.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background text-foreground antialiased">
        <SiteHeader />
        {children}
        <PendingActionResumer isSignedIn={!!user} />
      </body>
    </html>
  );
}
