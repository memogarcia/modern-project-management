"use client";

import type { MouseEvent as ReactMouseEvent, RefObject } from "react";
import { PanelRightOpen } from "lucide-react";
import MermaidPanel from "@/components/MermaidPanel";
import PerspectivesPanel from "@/components/PerspectivesPanel";
import QualityPanel from "@/components/QualityPanel";
import SequencePanel from "@/components/SequencePanel";
import TroubleshootingPanel from "@/components/TroubleshootingPanel";
import type { DiagramQualityEntityRef } from "@/lib/diagramQuality";
import type { DiagramPerspective, DiagramPerspectiveKind } from "@/lib/diagramPerspectives";
import type { ArchEdge, DiagramNode, TroubleshootingSession } from "@/lib/types";

export type DiagramEditorRightTab = "mermaid" | "investigations" | "quality" | "perspectives" | "sequence";

interface DiagramEditorSidebarProps {
  isMermaidCollapsed: boolean;
  setMermaidCollapsed: (collapsed: boolean) => void;
  resizeHandleRef: RefObject<HTMLDivElement | null>;
  onResizeStart: (event: ReactMouseEvent<HTMLDivElement>) => void;
  isDragging: boolean;
  panelWidth: number;
  activeRightTab: DiagramEditorRightTab;
  onRightTabChange: (tab: DiagramEditorRightTab) => void;
  mermaidError: string | null;
  qualityWarningCount: number;
  currentDiagramId: string;
  nodes: DiagramNode[];
  edges: ArchEdge[];
  selectedNodeIds: string[];
  selectedEdgeIds: string[];
  perspectives: DiagramPerspective[];
  isPerspectivesLoading: boolean;
  perspectiveError: string | null;
  activePerspectiveId: string | null;
  onApplyPerspective: (perspectiveId: string | null) => void;
  onCreateCustomPerspective: (title: string, description: string) => Promise<void>;
  onUpdatePerspectiveFromSelection: (perspectiveId: string) => Promise<void>;
  onUpsertSuggestedPerspective: (
    kind: Exclude<DiagramPerspectiveKind, "custom">,
    sessions: TroubleshootingSession[]
  ) => Promise<void>;
  onDeletePerspective: (perspectiveId: string) => Promise<void>;
  onFocusEntity: (entity: DiagramQualityEntityRef) => void;
}

interface SidebarTabButtonProps {
  active: boolean;
  label: string;
  onClick: () => void;
}

function SidebarTabButton({ active, label, onClick }: SidebarTabButtonProps) {
  return (
    <button
      type="button"
      className={`rounded-[18px] px-3 py-1.5 text-[11px] font-semibold transition-colors md:rounded-2xl md:px-4 md:py-2 md:text-xs ${
        active
          ? "bg-[var(--accent)] text-[var(--accent-foreground)] shadow-[0_12px_24px_rgba(66,98,255,0.18)]"
          : "text-[var(--text-muted)] hover:bg-[var(--surface-hover)]"
      }`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

export default function DiagramEditorSidebar({
  isMermaidCollapsed,
  setMermaidCollapsed,
  resizeHandleRef,
  onResizeStart,
  isDragging,
  panelWidth,
  activeRightTab,
  onRightTabChange,
  mermaidError,
  qualityWarningCount,
  currentDiagramId,
  nodes,
  edges,
  selectedNodeIds,
  selectedEdgeIds,
  perspectives,
  isPerspectivesLoading,
  perspectiveError,
  activePerspectiveId,
  onApplyPerspective,
  onCreateCustomPerspective,
  onUpdatePerspectiveFromSelection,
  onUpsertSuggestedPerspective,
  onDeletePerspective,
  onFocusEntity,
}: DiagramEditorSidebarProps) {
  if (isMermaidCollapsed) {
    return (
      <div className="flex w-[48px] shrink-0 items-center justify-center rounded-[22px] border border-[var(--panel-border)] bg-[var(--panel-bg)] shadow-[var(--card-shadow)] md:w-[58px] md:rounded-[28px]">
        <button
          type="button"
          aria-label="Expand Mermaid panel"
          title="Expand Mermaid panel"
          className="flex h-9 w-9 items-center justify-center rounded-[18px] border border-[var(--border)] text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] md:h-11 md:w-11 md:rounded-2xl"
          onClick={() => setMermaidCollapsed(false)}
        >
          <PanelRightOpen size={16} />
        </button>
      </div>
    );
  }

  return (
    <>
      <div
        ref={resizeHandleRef}
        onMouseDown={onResizeStart}
        className="relative hidden w-3 shrink-0 cursor-col-resize md:block"
      >
        <div
          className="absolute bottom-8 left-1/2 top-8 -translate-x-1/2 rounded-full transition-colors"
          style={{
            width: 4,
            background: isDragging ? "var(--accent)" : "color-mix(in srgb, var(--border) 78%, transparent)",
          }}
        />
      </div>

      <div
        className="flex shrink-0 flex-col overflow-hidden rounded-[22px] border border-[var(--panel-border)] bg-[var(--panel-bg)] shadow-[var(--card-shadow)] md:rounded-[30px]"
        style={{ width: panelWidth, minWidth: 260, maxWidth: "56vw" }}
      >
        <div className="planview-scroll-panel flex items-center gap-2 overflow-x-auto border-b border-[var(--border)] px-2.5 py-2.5 md:px-3 md:py-3">
          <SidebarTabButton
            active={activeRightTab === "mermaid"}
            label={`Mermaid${mermaidError ? " !" : ""}`}
            onClick={() => onRightTabChange("mermaid")}
          />
          <SidebarTabButton
            active={activeRightTab === "investigations"}
            label="Investigations"
            onClick={() => onRightTabChange("investigations")}
          />
          <SidebarTabButton
            active={activeRightTab === "perspectives"}
            label="Perspectives"
            onClick={() => onRightTabChange("perspectives")}
          />
          <SidebarTabButton
            active={activeRightTab === "quality"}
            label={`Quality${qualityWarningCount > 0 ? ` ${qualityWarningCount}` : ""}`}
            onClick={() => onRightTabChange("quality")}
          />
          <SidebarTabButton
            active={activeRightTab === "sequence"}
            label="Sequence"
            onClick={() => onRightTabChange("sequence")}
          />
        </div>

        <div className="min-h-0 flex-1">
          {activeRightTab === "mermaid" ? (
            <MermaidPanel onCollapse={() => setMermaidCollapsed(true)} />
          ) : activeRightTab === "perspectives" ? (
            <PerspectivesPanel
              diagramId={currentDiagramId}
              nodes={nodes}
              edges={edges}
              selectedNodeIds={selectedNodeIds}
              selectedEdgeIds={selectedEdgeIds}
              perspectives={perspectives}
              isLoading={isPerspectivesLoading}
              errorMessage={perspectiveError}
              activePerspectiveId={activePerspectiveId}
              onApplyPerspective={onApplyPerspective}
              onCreateCustomPerspective={onCreateCustomPerspective}
              onUpdatePerspectiveFromSelection={onUpdatePerspectiveFromSelection}
              onUpsertSuggestedPerspective={onUpsertSuggestedPerspective}
              onDeletePerspective={onDeletePerspective}
            />
          ) : activeRightTab === "quality" ? (
            <QualityPanel
              nodes={nodes}
              edges={edges}
              selectedNodeIds={selectedNodeIds}
              selectedEdgeIds={selectedEdgeIds}
              onFocusEntity={onFocusEntity}
            />
          ) : activeRightTab === "sequence" ? (
            <SequencePanel diagramId={currentDiagramId} nodes={nodes} edges={edges} />
          ) : (
            <TroubleshootingPanel
              diagramId={currentDiagramId}
              nodes={nodes as never[]}
              edges={edges as never[]}
              selectedNodeIds={selectedNodeIds}
              selectedEdgeIds={selectedEdgeIds}
            />
          )}
        </div>
      </div>
    </>
  );
}
