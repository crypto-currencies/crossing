import type { ReactNode } from "react";
import type { Metadata } from "next";
import { Inter, Manrope } from "next/font/google";
import { Providers } from "@/components/providers/providers";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-spacious",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "https://crossing.dev"),
  title: "Crossing — Find what holds up",
  description: "Search for a service, place, product, or problem. Compare the options and see the tradeoffs in one place.",
  openGraph: {
    title: "Crossing — Find what holds up",
    description: "Search places, services, products, software, and everything in between.",
    type: "website",
    images: [{ url: "/og-coral.png", width: 1728, height: 907, alt: "Crossing search and discovery interface" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Crossing — Find what holds up",
    description: "Search places, services, products, software, and everything in between.",
    images: ["/og-coral.png"],
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${manrope.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
