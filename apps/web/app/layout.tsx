import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import { SiteFrame } from "@/components/layout/site-frame";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { OfflineIdentityReconciler } from "@/features/offline/lifecycle/offline-identity-reconciler";
import { AuthRecoveryRunner } from "@/features/auth/auth-recovery-runner";
import { cyrillicBody, cyrillicDisplay } from "./fonts/cyrillic";
import { display, body, ui, readerSerif } from "./fonts/primary";
import "./globals.css";
import "./modal-surfaces.css";
import "./scrollbars.css";

export const metadata: Metadata = {
  title: "Ava Reader",
  description: "Investigate deeper meaning of books without breaking focus.",
};

// Runs before first paint to set `data-theme` from the device scheme and any
// stored override — so the theme is correct even when the device shifted while
// the app was closed (the cookie baseline may be stale). Mirrors resolveTheme +
// isOverrideActive in components/theme/resolve-theme.ts; keep the two in sync.
const themeBootstrap = `(function(){try{var d=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";var t=d;var raw=window.localStorage.getItem("ava-theme-override");if(raw){var o=JSON.parse(raw);if(o&&(o.theme==="light"||o.theme==="dark")&&o.setAgainst===d){t=o.theme;}}document.documentElement.dataset.theme=t;}catch(e){}})();`;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const serverUserId = await auth()
    .then((session) => session.userId)
    .catch(() => null);
  const cookieStore = await cookies();
  const initialTheme =
    cookieStore.get("ava-theme")?.value === "dark" ? "dark" : "light";
  const locale = await getLocale();

  return (
    <html
      lang={locale}
      data-theme={initialTheme}
      suppressHydrationWarning
      className={`${display.variable} ${body.variable} ${ui.variable} ${readerSerif.variable} ${cyrillicBody.variable} ${cyrillicDisplay.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
        <NextIntlClientProvider>
          <ClerkProvider
            signInUrl="/sign-in"
            signUpUrl="/sign-up"
            afterSignOutUrl="/sign-in"
          >
            <AuthRecoveryRunner />
            <ThemeProvider initialTheme={initialTheme}>
              <OfflineIdentityReconciler serverUserId={serverUserId}>
                <SiteFrame>{children}</SiteFrame>
              </OfflineIdentityReconciler>
            </ThemeProvider>
          </ClerkProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
