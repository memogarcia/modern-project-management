"use client";

interface DiagramEditorMissingStateProps {
  errorMessage: string;
}

export function DiagramEditorLoadingState() {
  return (
    <div className="workspace-page items-center justify-center text-sm text-[var(--text-muted)]">
      Loading diagram...
    </div>
  );
}

export function DiagramEditorMissingState({ errorMessage }: DiagramEditorMissingStateProps) {
  return (
    <div className="workspace-page items-center justify-center gap-4 text-center text-sm text-[var(--text-muted)]">
      <div>{errorMessage}</div>
      <a
        href="/diagrams"
        className="rounded-full bg-[var(--accent)] px-4 py-2 font-semibold text-[var(--accent-foreground)] no-underline"
      >
        Back to diagrams
      </a>
    </div>
  );
}
