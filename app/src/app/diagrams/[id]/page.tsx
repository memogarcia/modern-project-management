"use client";

import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { ReactFlowProvider } from "@xyflow/react";

const DiagramEditor = dynamic(() => import("@/components/DiagramEditor"), {
  ssr: false,
  loading: () => (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        background: "var(--background)",
        color: "var(--text-muted)",
      }}
    >
      Loading editor...
    </div>
  ),
});

export default function DiagramPage() {
  const params = useParams();
  const id = params.id as string;

  return (
    <ReactFlowProvider>
      <DiagramEditor diagramId={id} />
    </ReactFlowProvider>
  );
}
