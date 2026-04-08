import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { cookies } from "next/headers";
import { Abhaya_Libre, Afacad, Inter, Noto_Serif } from "next/font/google";
import { SiteFrame } from "@/components/layout/site-frame";
import { ThemeProvider } from "@/components/theme/theme-provider";
import "./globals.css";

const display = Abhaya_Libre({
  variable: "--font-abhaya",
  subsets: ["latin"],
  weight: ["400", "700", "800"],
});

const body = Afacad({
  variable: "--font-afacad",
  subsets: ["latin"],
});

const ui = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const readerSerif = Noto_Serif({
  variable: "--font-reader-serif",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "Ava Reader",
  description: "Investigate deeper meaning of books without breaking focus.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const initialTheme =
    cookieStore.get("ava-theme")?.value === "dark" ? "dark" : "light";

  return (
    <html
      lang="en"
      data-theme={initialTheme}
      suppressHydrationWarning
      className={`${display.variable} ${body.variable} ${ui.variable} ${readerSerif.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <ClerkProvider signInUrl="/sign-in" signUpUrl="/sign-up">
          <ThemeProvider initialTheme={initialTheme}>
            <SiteFrame>{children}</SiteFrame>
          </ThemeProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
