import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import localFont from "next/font/local";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import { SiteFrame } from "@/components/layout/site-frame";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { OfflineIdentityReconciler } from "@/features/offline/lifecycle/offline-identity-reconciler";
import { AuthRecoveryRunner } from "@/features/auth/auth-recovery-runner";
import { cyrillicBody, cyrillicDisplay } from "./fonts/cyrillic";
import "./globals.css";
import "./fonts/fallbacks.css";
import "./modal-surfaces.css";

// Committed official faces keep builds independent of Google's CSS response shape.
// Full Unicode maps and the original nonweight-axis defaults are retained; see fonts/README.md.
const display = localFont({
  src: [
    { path: "./fonts/abhaya-libre-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/abhaya-libre-700.woff2", weight: "700", style: "normal" },
    { path: "./fonts/abhaya-libre-800.woff2", weight: "800", style: "normal" },
  ],
  variable: "--font-abhaya",
  fallback: ["Abhaya Libre Fallback"],
  declarations: [{ prop: "font-family", value: "'Abhaya Libre'" }],
  display: "swap",
  preload: false,
  adjustFontFallback: false,
});

const body = localFont({
  src: "./fonts/afacad-normal.woff2",
  variable: "--font-afacad",
  fallback: ["Afacad Fallback"],
  declarations: [{ prop: "font-family", value: "'Afacad'" }],
  weight: "400 700",
  style: "normal",
  display: "swap",
  preload: false,
  adjustFontFallback: false,
});

const ui = localFont({
  src: "./fonts/inter-normal.woff2",
  variable: "--font-inter",
  fallback: ["Inter Fallback"],
  declarations: [{ prop: "font-family", value: "'Inter'" }],
  weight: "100 900",
  style: "normal",
  display: "swap",
  preload: false,
  adjustFontFallback: false,
});

const readerSerif = localFont({
  src: [
    { path: "./fonts/noto-serif-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/noto-serif-normal.woff2", weight: "700", style: "normal" },
    { path: "./fonts/noto-serif-italic.woff2", weight: "400", style: "italic" },
    { path: "./fonts/noto-serif-italic.woff2", weight: "700", style: "italic" },
  ],
  variable: "--font-reader-serif",
  fallback: ["Noto Serif Fallback"],
  declarations: [{ prop: "font-family", value: "'Noto Serif'" }],
  display: "swap",
  preload: false,
  adjustFontFallback: false,
});

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
            <OfflineIdentityReconciler serverUserId={serverUserId}>
              <ThemeProvider initialTheme={initialTheme}>
                <SiteFrame>{children}</SiteFrame>
              </ThemeProvider>
            </OfflineIdentityReconciler>
          </ClerkProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
