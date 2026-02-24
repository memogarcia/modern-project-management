"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { DiagramMeta } from "@/lib/types";
import { loadDiagrams, deleteDiagram } from "@/lib/storage";
import { useDiagramStore } from "@/store/diagramStore";

export default function DiagramsListPage() {
  const router = useRouter();
  const [diagrams, setDiagrams] = useState<DiagramMeta[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const initNewDiagram = useDiagramStore((s) => s.initNewDiagram);

  useEffect(() => {
    loadDiagrams().then(setDiagrams);
  }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const id = await initNewDiagram(newName.trim(), newDesc.trim());
    router.push(`/diagrams/${id}`);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this diagram?")) return;
    await deleteDiagram(id);
    const updated = await loadDiagrams();
    setDiagrams(updated);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--background)",
        color: "var(--foreground)",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "24px 32px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: "24px", fontWeight: 700 }}>
            ArchDiagram
          </h1>
          <p
            style={{
              margin: "4px 0 0",
              fontSize: "13px",
              color: "var(--text-muted)",
            }}
          >
            Architecture diagrams with React Flow &amp; Mermaid
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          style={{
            padding: "8px 16px",
            background: "var(--accent)",
            color: "#fff",
            border: "none",
            borderRadius: "6px",
            fontSize: "13px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          + New Diagram
        </button>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
          }}
          onClick={() => setShowCreate(false)}
        >
          <div
            style={{
              background: "var(--panel-bg)",
              border: "1px solid var(--border)",
              borderRadius: "12px",
              padding: "24px",
              width: "420px",
              maxWidth: "90vw",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: "0 0 16px", fontSize: "18px" }}>
              New Diagram
            </h2>
            <div style={{ marginBottom: "12px" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "12px",
                  color: "var(--text-muted)",
                  marginBottom: "4px",
                }}
              >
                Name
              </label>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Microservices Architecture"
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: "6px",
                  color: "var(--foreground)",
                  fontSize: "14px",
                  outline: "none",
                }}
              />
            </div>
            <div style={{ marginBottom: "16px" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "12px",
                  color: "var(--text-muted)",
                  marginBottom: "4px",
                }}
              >
                Description (optional)
              </label>
              <input
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Brief description..."
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: "6px",
                  color: "var(--foreground)",
                  fontSize: "14px",
                  outline: "none",
                }}
              />
            </div>
            <div
              style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}
            >
              <button
                onClick={() => setShowCreate(false)}
                style={{
                  padding: "8px 16px",
                  background: "var(--surface)",
                  color: "var(--foreground)",
                  border: "1px solid var(--border)",
                  borderRadius: "6px",
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                style={{
                  padding: "8px 16px",
                  background: "var(--accent)",
                  color: "#fff",
                  border: "none",
                  borderRadius: "6px",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Diagram list */}
      <div style={{ padding: "24px 32px" }}>
        {diagrams.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "80px 20px",
              color: "var(--text-muted)",
            }}
          >
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>📐</div>
            <div style={{ fontSize: "16px", marginBottom: "8px" }}>
              No diagrams yet
            </div>
            <div style={{ fontSize: "13px" }}>
              Click &quot;+ New Diagram&quot; to get started
            </div>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
              gap: "16px",
            }}
          >
            {diagrams.map((d) => (
              <div
                key={d.id}
                style={{
                  background: "var(--panel-bg)",
                  border: "1px solid var(--border)",
                  borderRadius: "10px",
                  padding: "20px",
                  cursor: "pointer",
                  transition: "border-color 0.15s",
                }}
                onClick={() => router.push(`/diagrams/${d.id}`)}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.borderColor = "var(--accent)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.borderColor = "var(--border)")
                }
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: "8px",
                  }}
                >
                  <h3
                    style={{
                      margin: 0,
                      fontSize: "15px",
                      fontWeight: 600,
                    }}
                  >
                    {d.name}
                  </h3>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(d.id);
                    }}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "var(--text-muted)",
                      cursor: "pointer",
                      fontSize: "14px",
                      padding: "2px 6px",
                      borderRadius: "4px",
                    }}
                    title="Delete"
                  >
                    🗑️
                  </button>
                </div>
                {d.description && (
                  <p
                    style={{
                      margin: "0 0 12px",
                      fontSize: "12px",
                      color: "var(--text-muted)",
                      lineHeight: 1.4,
                    }}
                  >
                    {d.description}
                  </p>
                )}
                <div
                  style={{
                    fontSize: "11px",
                    color: "var(--text-muted)",
                  }}
                >
                  Updated{" "}
                  {new Date(d.updatedAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
