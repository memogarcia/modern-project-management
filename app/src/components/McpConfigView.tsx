"use client";

import { useState } from "react";
import { Copy, Check, Terminal } from "lucide-react";
import { Button } from "./ui/button";
import type { KanbanProject } from "@/lib/projectTypes";

interface McpConfigViewProps {
  project: KanbanProject;
}

export default function McpConfigView({ project }: McpConfigViewProps) {
  const [copied, setCopied] = useState<string | null>(null);

  const buildCmd = `npm --prefix mcp-server install
npm --prefix mcp-server run build`;

  const mcpConfig = JSON.stringify(
    {
      mcpServers: {
        planview: {
          command: "node",
          args: ["/absolute/path/to/mcp-server/dist/index.js"],
          env: {
            PLANVIEW_DB: "/absolute/path/to/mcp-server/data/planview.db",
          },
        },
      },
    },
    null,
    2
  );

  const tools = [
    ["list_projects", "List all projects"],
    ["get_project", "Get a project by ID"],
    ["create_project", "Create a new project"],
    ["create_kanban_task", "Add a task to a project"],
    ["update_kanban_task", "Update a task"],
    ["move_kanban_task", "Move a task between columns"],
    ["add_project_session", "Create a focus session"],
    ["create_diagram", "Create a diagram"],
    ["link_diagram_to_project", "Link a diagram to a project"],
  ];

  const handleCopy = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-2xl mx-auto space-y-8">
        <div>
          <h2 className="text-lg font-bold text-[var(--foreground)] mb-1 flex items-center gap-2">
            <Terminal size={18} className="text-[var(--accent)]" />
            MCP Configuration
          </h2>
          <p className="text-sm text-[var(--text-muted)]">
            Connect this workspace to Claude, Copilot, or any MCP-compatible AI.
          </p>
        </div>

        {/* Step 1: Build */}
        <section className="space-y-2">
          <div className="text-[11px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
            1 — Build the server
          </div>
          <div className="relative">
            <pre className="overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 text-sm font-mono text-[var(--foreground)] leading-relaxed">
              {buildCmd}
            </pre>
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 h-7 w-7"
              onClick={() => void handleCopy(buildCmd, "build")}
            >
              {copied === "build" ? <Check size={14} /> : <Copy size={14} />}
            </Button>
          </div>
        </section>

        {/* Step 2: Config */}
        <section className="space-y-2">
          <div className="text-[11px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
            2 — Add to AI config
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            Paste into{" "}
            <code className="rounded bg-[var(--surface)] px-1.5 py-0.5 border border-[var(--border)] text-[11px]">
              claude_desktop_config.json
            </code>
          </p>
          <div className="relative">
            <pre className="overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 text-xs font-mono text-[var(--foreground)] leading-relaxed">
              {mcpConfig}
            </pre>
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 h-7 w-7"
              onClick={() => void handleCopy(mcpConfig, "config")}
            >
              {copied === "config" ? <Check size={14} /> : <Copy size={14} />}
            </Button>
          </div>
        </section>

        {/* Step 3: Tools */}
        <section className="space-y-3">
          <div className="text-[11px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
            3 — Available tools
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {tools.map(([name, desc]) => (
              <div key={name} className="flex flex-col gap-1">
                <code className="w-fit rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 text-xs font-mono text-[var(--foreground)]">
                  {name}
                </code>
                <span className="text-xs text-[var(--text-muted)]">{desc}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
