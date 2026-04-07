import type { Metadata } from "next";
import Script from "next/script";
import { ClerkProvider } from "@clerk/nextjs";
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

const themeInitScript = `
  try {
    const theme = localStorage.getItem("ava-theme");
    document.documentElement.dataset.theme = theme === "dark" ? "dark" : "light";
  } catch (error) {
    document.documentElement.dataset.theme = "light";
  }
`;

export const metadata: Metadata = {
  title: "Ava Reader",
  description: "Investigate deeper meaning of books without breaking focus.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${display.variable} ${body.variable} ${ui.variable} ${readerSerif.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <Script id="theme-init" strategy="beforeInteractive">
          {themeInitScript}
        </Script>
        <ClerkProvider signInUrl="/sign-in" signUpUrl="/sign-up">
          <ThemeProvider>
            <SiteFrame>{children}</SiteFrame>
          </ThemeProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
