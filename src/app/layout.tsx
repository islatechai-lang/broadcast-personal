import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Outfit } from "next/font/google";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-primary",
  weight: ["300", "400", "500", "600", "700"],
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["300", "400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Bulk Email Sender | Premium SaaS Dashboard",
  description: "Deduplicate, validate, and broadcast bulk emails securely and sequentially using the Resend SDK. Send up to 100 emails at a time.",
  keywords: ["email", "bulk sender", "resend", "saas", "dashboard", "nextjs"],
  authors: [{ name: "SaaS Dev" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark scroll-smooth">
      <body
        className={`${plusJakarta.variable} ${outfit.variable} antialiased min-h-screen bg-slate-950 text-slate-100`}
      >
        {children}
      </body>
    </html>
  );
}
