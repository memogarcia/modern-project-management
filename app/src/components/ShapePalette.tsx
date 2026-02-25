"use client";

import { useDiagramStore } from "@/store/diagramStore";
import { getAllShapeTypes, getShapeDef } from "@/lib/types";
import ShapeIcon from "@/components/ShapeIcon";

export default function ShapePalette() {
  const addNode = useDiagramStore((s) => s.addNode);
  const addDatabaseSchemaNode = useDiagramStore((s) => s.addDatabaseSchemaNode);
  const addGroupNode = useDiagramStore((s) => s.addGroupNode);
  const shapeTypes = getAllShapeTypes();

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        padding: "12px 6px",
        background: "var(--glass-bg)",
        backdropFilter: "blur(12px)",
        border: "1px solid var(--glass-border)",
        borderRadius: "12px",
        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.18), 0 2px 8px rgba(0, 0, 0, 0.12)",
        overflowY: "auto",
        width: "48px",
        maxHeight: "80vh",
        alignItems: "center",
      }}
    >
      <div
        style={{
          fontSize: "10px",
          color: "var(--text-muted)",
          textAlign: "center",
          marginBottom: "4px",
          fontWeight: 600,
          opacity: 0.7,
        }}
      >
        ADD
      </div>
      {shapeTypes.map((type) => {
        const def = getShapeDef(type);
        return (
          <button
            key={type}
            onClick={() => addNode(type)}
            title={`${def.label}: ${def.description}`}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "2px",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: "6px",
              borderRadius: "8px",
              transition: "all 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
              width: "100%",
              color: "var(--foreground)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--surface)";
              e.currentTarget.style.transform = "scale(1.1)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.transform = "scale(1)";
            }}
          >
            <div
              style={{
                color: "var(--foreground)",
                filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.1))"
              }}
            >
              <ShapeIcon type={type} size={24} />
            </div>
          </button>
        );
      })}

      <div style={{ width: 24, height: 1, background: "var(--border)", margin: "4px 0" }} />

      <button
        onClick={() => addGroupNode()}
        title="Group Container"
        style={{
          background: "transparent",
          border: "none",
          cursor: "pointer",
          padding: "6px",
          borderRadius: "8px",
          width: "100%",
          display: "flex",
          justifyContent: "center",
          transition: "background 0.2s",
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = "var(--surface)"}
        onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
      >
        <div style={{ width: 24, height: 24, border: "2px dashed var(--text-muted)", borderRadius: 4, opacity: 0.7 }} />
      </button>

      <button
        onClick={() => addDatabaseSchemaNode("New Table", [])}
        title="Database Schema"
        style={{
          background: "transparent",
          border: "none",
          cursor: "pointer",
          padding: "6px",
          borderRadius: "8px",
          width: "100%",
          display: "flex",
          justifyContent: "center",
          transition: "background 0.2s",
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = "var(--surface)"}
        onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
      >
        <ShapeIcon type="database" size={24} />
      </button>

    </div>
  );
}
