import type { Metadata } from "next";
import type { ReactNode } from "react";
import ClientLayout from "./client-layout";
import { Analytics } from "@vercel/analytics/next"
import "./globals.css";

export const metadata: Metadata = {
  applicationName: "Zento Markets",
  title: "Zento Markets",
  description: "An AI-powered permissionless prediction markets protocol, built on bnbchain",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icons/Zento.svg", type: "image/svg+xml" },
      { url: "/icons/Zento.svg", sizes: "192x192", type: "image/png" },
      { url: "/icons/Zento.svg", sizes: "512x512", type: "image/png" },
    ],
    apple: { url: "/icons/Zento.svg", sizes: "192x192", type: "image/png" },
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-[#1a1a1e57] text-white min-h-screen flex flex-col">
      <Analytics/>
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}