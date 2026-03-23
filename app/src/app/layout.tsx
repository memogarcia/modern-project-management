import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Sidebar } from "@/components/Sidebar";

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
      <body className="antialiased">
        <ThemeProvider>
          <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
            <Suspense>
              <Sidebar />
            </Suspense>
            <main style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column", background: "var(--background)" }}>
              {children}
            </main>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
