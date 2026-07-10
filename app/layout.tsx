import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers/providers";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: {
    default: "Crossing.dev",
    template: "%s - Crossing.dev",
  },
  description: "Find the products, services, tools, and communities worth your time.",
  keywords: ["discovery", "products", "tools", "communities", "directory"],
  openGraph: {
    title: "Crossing.dev",
    description: "Find the products, services, tools, and communities worth your time.",
    type: "website",
    siteName: "Crossing.dev",
  },
  twitter: {
    card: "summary",
    title: "Crossing.dev",
    description: "Find the products, services, tools, and communities worth your time.",
  },
};

export const viewport: Viewport = {
  themeColor: "#050506",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
