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
        gap: "4px",
        padding: "8px",
        background: "var(--panel-bg)",
        borderRight: "1px solid var(--border)",
        overflowY: "auto",
        width: "64px",
        minWidth: "64px",
      }}
    >
      <div
        style={{
          fontSize: "9px",
          color: "var(--text-muted)",
          textAlign: "center",
          marginBottom: "4px",
          textTransform: "uppercase",
          letterSpacing: "0.5px",
        }}
      >
        Shapes
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
              padding: "6px 4px",
              background: "transparent",
              border: "1px solid transparent",
              borderRadius: "6px",
              cursor: "pointer",
              color: "var(--foreground)",
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--surface)";
              e.currentTarget.style.borderColor = "var(--border)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.borderColor = "transparent";
            }}
          >
            <ShapeIcon
              name={def.lucideIcon}
              fallback={def.icon}
              size={18}
              color={def.borderColor}
              strokeWidth={1.5}
            />
            <span
              style={{
                fontSize: "8px",
                color: "var(--text-muted)",
                lineHeight: 1.1,
                textAlign: "center",
              }}
            >
              {def.label}
            </span>
          </button>
        );
      })}

      {/* Separator */}
      <div
        style={{
          height: "1px",
          background: "var(--border)",
          margin: "4px 0",
        }}
      />

      <div
        style={{
          fontSize: "9px",
          color: "var(--text-muted)",
          textAlign: "center",
          marginBottom: "4px",
          textTransform: "uppercase",
          letterSpacing: "0.5px",
        }}
      >
        Schema
      </div>

      <button
        onClick={() =>
          addDatabaseSchemaNode("new_table", [
            { name: "id", type: "int", constraint: "primary" },
            { name: "created_at", type: "timestamp" },
          ])
        }
        title="Database Schema: Add a table with columns"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "2px",
          padding: "6px 4px",
          background: "transparent",
          border: "1px solid transparent",
          borderRadius: "6px",
          cursor: "pointer",
          color: "var(--foreground)",
          transition: "all 0.15s",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "var(--surface)";
          e.currentTarget.style.borderColor = "var(--border)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.borderColor = "transparent";
        }}
      >
        <ShapeIcon
          name="Table"
          fallback="📊"
          size={18}
          color="#4f46e5"
          strokeWidth={1.5}
        />
        <span
          style={{
            fontSize: "8px",
            color: "var(--text-muted)",
            lineHeight: 1.1,
            textAlign: "center",
          }}
        >
          DB Table
        </span>
      </button>

      {/* Separator */}
      <div
        style={{
          height: "1px",
          background: "var(--border)",
          margin: "4px 0",
        }}
      />

      <div
        style={{
          fontSize: "9px",
          color: "var(--text-muted)",
          textAlign: "center",
          marginBottom: "4px",
          textTransform: "uppercase",
          letterSpacing: "0.5px",
        }}
      >
        Layout
      </div>

      <button
        onClick={() => addGroupNode()}
        title="Group: Add a group to organize nodes"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "2px",
          padding: "6px 4px",
          background: "transparent",
          border: "1px solid transparent",
          borderRadius: "6px",
          cursor: "pointer",
          color: "var(--foreground)",
          transition: "all 0.15s",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "var(--surface)";
          e.currentTarget.style.borderColor = "var(--border)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.borderColor = "transparent";
        }}
      >
        <ShapeIcon
          name="Group"
          fallback="📦"
          size={18}
          color="#6366f1"
          strokeWidth={1.5}
        />
        <span
          style={{
            fontSize: "8px",
            color: "var(--text-muted)",
            lineHeight: 1.1,
            textAlign: "center",
          }}
        >
          Group
        </span>
      </button>
    </div>
  );
}
