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
      className="flex h-9 w-9 items-center justify-center rounded-[16px] border border-transparent bg-transparent text-[var(--foreground)] transition-all duration-150 hover:-translate-y-0.5 hover:border-[var(--border)] hover:bg-[var(--surface-hover)] hover:text-[var(--accent)] md:h-11 md:w-11 md:rounded-[20px]"
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
    <div className="floating-panel flex w-[54px] flex-col items-center gap-1.5 rounded-[20px] px-1.5 py-2.5 md:w-[68px] md:gap-2 md:rounded-[26px] md:px-2.5 md:py-3.5">
      <div className="text-[9px] font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">
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
            <ShapeIcon type={type} size={18} />
          </PaletteButton>
        );
      })}

      <div className="my-1 h-px w-8 bg-[var(--border)]" />

      <PaletteButton title="Group container" onClick={() => addGroupNode()}>
        <div className="h-[18px] w-[18px] rounded-md border-2 border-dashed border-[var(--text-muted)]" />
      </PaletteButton>

      <PaletteButton title="Database schema" onClick={() => addDatabaseSchemaNode("New Table", [])}>
        <ShapeIcon type="database" size={18} />
      </PaletteButton>

      <PaletteButton title="Text" onClick={() => addTextNode("Text")}>
        <Type size={16} strokeWidth={2} />
      </PaletteButton>
    </div>
  );
}
