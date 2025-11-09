"use client";

import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ThirdwebProvider } from "thirdweb/react";
import { useState } from "react";
import { Toaster } from "sonner";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const metadata: Metadata = {
  applicationName: "Zento Markets",
  title: "Zento Markets",
  description: "An AI-powered permissionless prediction markets protocol, built on bnbchain",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icons/Pivot.svg", type: "image/svg+xml" },
      { url: "/icons/Pivot.svg", sizes: "192x192", type: "image/png" },
      { url: "/icons/Pivot.svg", sizes: "512x512", type: "image/png" },
    ],
    apple: { url: "/icons/pivot-200.png", sizes: "192x192", type: "image/png" },
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  return (
    <html lang="en">
      <Analytics />
      <Toaster />
      <QueryClientProvider client={queryClient}>
        <ThirdwebProvider>
          <body className="bg-[#1a1a1e57] text-white min-h-screen flex flex-col">
            {/* Main content wrapper */}
            <div className="flex-1">
              <div id="root">{children}</div>
            </div>

            <footer className="hidden lg:flex bg-[#1a191e] pt-6 border-t border-t-[var(--Stroke-Dark,#2c2c2f)]">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
                <div className="flex items-center justify-center mb-6">
                  <img src="/zento.png" alt="Footer Logo" className="h-12 sm:h-14 w-auto" />
                </div>

                {/* Mobile-first approach with responsive layout */}
                <div className="text-center">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-center gap-2 sm:gap-4 text-sm text-gray-400">
                    <span className="whitespace-nowrap">© 2025 Pivot Markets</span>

                    {/* Hide separators on mobile, show on desktop */}
                    <span className="hidden sm:inline">•</span>

                    <div className="flex flex-row items-center justify-center sm:gap-4 gap-2">
                      <span className="whitespace-nowrap hover:text-gray-300 cursor-pointer transition-colors">
                        Privacy Policy
                      </span>
                      <span className="">•</span>
                      <span className="whitespace-nowrap hover:text-gray-300 cursor-pointer transition-colors">
                        Terms of service
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </footer>

       
            <Toaster />
          </body>
        </ThirdwebProvider>
      </QueryClientProvider>
    </html>
  );
}
