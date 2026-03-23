"use client";

import { Type } from "lucide-react";
import ShapeIcon from "@/components/ShapeIcon";
import { useDiagramStore } from "@/store/diagramStore";
import { getAllShapeTypes, getShapeDef } from "@/lib/types";

function PaletteButton({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="flex h-12 w-12 items-center justify-center rounded-2xl border border-transparent bg-transparent text-[var(--foreground)] transition-all duration-150 hover:-translate-y-0.5 hover:border-[var(--border)] hover:bg-[var(--surface-hover)] hover:text-[var(--accent)]"
    >
      {children}
    </button>
  );
}

export default function ShapePalette() {
  const addNode = useDiagramStore((s) => s.addNode);
  const addDatabaseSchemaNode = useDiagramStore((s) => s.addDatabaseSchemaNode);
  const addGroupNode = useDiagramStore((s) => s.addGroupNode);
  const addTextNode = useDiagramStore((s) => s.addTextNode);
  const shapeTypes = getAllShapeTypes();

  return (
    <div className="floating-panel flex w-[72px] flex-col items-center gap-2 rounded-[28px] px-3 py-4">
      <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--text-muted)]">
        Insert
      </div>

      {shapeTypes.map((type) => {
        const def = getShapeDef(type);
        return (
          <PaletteButton
            key={type}
            title={`${def.label}: ${def.description}`}
            onClick={() => addNode(type)}
          >
            <ShapeIcon type={type} size={23} />
          </PaletteButton>
        );
      })}

      <div className="my-1 h-px w-8 bg-[var(--border)]" />

      <PaletteButton title="Group container" onClick={() => addGroupNode()}>
        <div className="h-6 w-6 rounded-md border-2 border-dashed border-[var(--text-muted)]" />
      </PaletteButton>

      <PaletteButton title="Database schema" onClick={() => addDatabaseSchemaNode("New Table", [])}>
        <ShapeIcon type="database" size={23} />
      </PaletteButton>

      <PaletteButton title="Text" onClick={() => addTextNode("Text")}>
        <Type size={20} strokeWidth={2} />
      </PaletteButton>
    </div>
  );
}
