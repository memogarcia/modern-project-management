import type { Metadata } from "next";
import { Noto_Sans } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Sidebar } from "@/components/Sidebar";

const notoSans = Noto_Sans({
  subsets: ["latin"],
  variable: "--font-ui",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "PlanView — Diagram-First Troubleshooting Memory",
  description:
    "Private troubleshooting memory for engineers and MCP clients: diagrams, investigations, evidence, and reusable patterns backed by shared SQLite storage.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${notoSans.variable} antialiased`}>
        <ThemeProvider>
          <div className="planview-shell">
            <Suspense>
              <Sidebar />
            </Suspense>
            <main className="planview-main">
              {children}
            </main>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
