import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { Footer } from "@/components/Footer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ReviewGuide",
  description: "ReviewGuide internal dashboard",
  icons: {
    // app/favicon.ico (Next.js file convention) already covers the base favicon; these add the
    // sizes it can't (PWA icons + Apple touch), matching reviewguide-marketing's asset set exactly
    // so /signup, /login, /app never show a mismatched mark vs. the landing (ticket 4.6).
    // `?v=6.7` cache-busts the ticket-6.7 brand-mark replacement — see the matching comment in
    // reviewguide-marketing's app/layout.tsx.
    icon: [
      { url: "/icon-192.png?v=6.7", type: "image/png", sizes: "192x192" },
      { url: "/icon-512.png?v=6.7", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/apple-touch-icon.png?v=6.7", sizes: "180x180" }],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-zinc-50 text-zinc-900">
        <div className="flex flex-1 flex-col">{children}</div>
        <Footer />
      </body>
    </html>
  );
}
