import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Abhaya_Libre, Afacad } from "next/font/google";
import { SiteFrame } from "@/components/layout/site-frame";
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
      className={`${display.variable} ${body.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <ClerkProvider signInUrl="/sign-in" signUpUrl="/sign-up">
          <SiteFrame>{children}</SiteFrame>
        </ClerkProvider>
      </body>
    </html>
  );
}
