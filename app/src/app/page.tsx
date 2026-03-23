"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/diagrams");
  }, [router]);

  return (
    <div className="flex flex-1 items-center justify-center bg-[var(--background)] text-[var(--text-muted)]">
      <div className="h-6 w-6 animate-spin rounded-full border-[3px] border-[var(--accent)] border-r-transparent" />
    </div>
  );
}
