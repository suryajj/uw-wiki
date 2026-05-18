import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Source_Serif_4 } from "next/font/google";
import { Toaster } from "sonner";

import { PendingActionResumer } from "@/components/auth/pending-action-resumer";
import { HeaderWrapper } from "@/components/layout/header-wrapper";
import { SiteHeader } from "@/components/layout/site-header";
import { getCurrentUser } from "@/lib/auth/current-user";
import "./globals.css";

const serif = Source_Serif_4({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-serif",
  display: "swap",
});

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
  const cookieStore = await cookies();
  const themeCookie = cookieStore.get("uw-wiki-theme")?.value;
  const theme = themeCookie === "light" ? "light" : "dark";
  return (
    <html lang="en" className={`${serif.variable} ${theme === "dark" ? "dark" : ""}`}>
      <body
        className="min-h-screen bg-background text-foreground antialiased"
        suppressHydrationWarning
      >
        <HeaderWrapper>
          <SiteHeader />
        </HeaderWrapper>
        {children}
        <PendingActionResumer isSignedIn={!!user} />
        <Toaster
          position="bottom-right"
          theme={theme === "dark" ? "dark" : "light"}
          richColors
          closeButton
          duration={4000}
          toastOptions={{
            classNames: {
              toast: "font-serif border border-border",
            },
          }}
        />
      </body>
    </html>
  );
}
