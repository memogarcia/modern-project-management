"use client";

import { useState } from "react";
import { Copy, Check, Terminal } from "lucide-react";
import { Button } from "./ui/button";
import type { KanbanProject } from "@/lib/projectTypes";

interface McpConfigViewProps {
  project: KanbanProject;
}

type ClientType = "claude" | "gemini" | "vscode" | "cursor";

const CLIENT_LABELS: Record<ClientType, { name: string; file: string }> = {
  claude: { name: "Claude Desktop", file: "claude_desktop_config.json" },
  gemini: { name: "Gemini CLI", file: "settings.json" },
  vscode: { name: "VS Code / Copilot", file: ".vscode/mcp.json" },
  cursor: { name: "Cursor", file: ".cursor/mcp.json" },
};

function buildConfig(client: ClientType): string {
  const serverBlock = {
    command: "npm",
    args: ["--prefix", "./mcp-server", "run", "dev"],
    env: {
      PLANVIEW_DB: "./mcp-server/data/planview.db",
    },
  };

  switch (client) {
    case "claude":
      return JSON.stringify({ mcpServers: { planview: serverBlock } }, null, 2);
    case "gemini":
      return JSON.stringify({ mcpServers: { planview: { ...serverBlock, cwd: "." } } }, null, 2);
    case "vscode":
      return JSON.stringify({
        servers: {
          planview: {
            type: "stdio",
            ...serverBlock,
          },
        },
      }, null, 2);
    case "cursor":
      return JSON.stringify({
        mcpServers: {
          planview: {
            ...serverBlock,
          },
        },
      }, null, 2);
  }
}

export default function McpConfigView({ project }: McpConfigViewProps) {
  const [copied, setCopied] = useState<string | null>(null);
  const [activeClient, setActiveClient] = useState<ClientType>("claude");

  const buildCmd = `npm install --prefix mcp-server
npm --prefix mcp-server run build`;

  const mcpConfig = buildConfig(activeClient);
  const clientMeta = CLIENT_LABELS[activeClient];

  const tools = [
    ["get_diagram", "Read the full diagram graph and metadata"],
    ["update_diagram_node_metadata", "Update rich node metadata safely"],
    ["update_diagram_edge_metadata", "Update dependency metadata safely"],
    ["create_troubleshooting_session", "Create an investigation linked to a diagram"],
    ["update_troubleshooting_session", "Update status, notes, and linked entities"],
    ["append_session_command", "Record commands and outputs"],
    ["extract_knowledge_pattern", "Publish a reusable troubleshooting pattern"],
    ["search_troubleshooting_memory", "Search sessions and patterns"],
  ];

  const resources = [
    ["planview://diagrams", "Diagram summaries"],
    ["planview://diagrams/{id}", "Full diagram document"],
    ["planview://investigations", "Investigation summaries"],
    ["planview://patterns", "Reusable troubleshooting patterns"],
  ];

  const prompts: Array<[string, string]> = [];

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
            Connect this workspace to Claude, Gemini CLI, VS Code, Cursor, or any MCP-compatible client so agents can operate on the same diagrams, investigations, and patterns as the app.
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

          {/* Client tabs */}
          <div className="flex gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-1">
            {(Object.keys(CLIENT_LABELS) as ClientType[]).map((key) => (
              <button
                key={key}
                onClick={() => setActiveClient(key)}
                className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                  activeClient === key
                    ? "bg-[var(--accent)] text-white shadow-sm"
                    : "text-[var(--text-muted)] hover:text-[var(--foreground)]"
                }`}
              >
                {CLIENT_LABELS[key].name}
              </button>
            ))}
          </div>

          <p className="text-xs text-[var(--text-muted)]">
            Paste into{" "}
            <code className="rounded bg-[var(--surface)] px-1.5 py-0.5 border border-[var(--border)] text-[11px]">
              {clientMeta.file}
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

        {/* Step 4: Resources */}
        <section className="space-y-3">
          <div className="text-[11px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
            4 — Resources
          </div>
          <div className="grid grid-cols-1 gap-3">
            {resources.map(([uri, desc]) => (
              <div key={uri} className="flex flex-col gap-1">
                <code className="w-fit rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 text-xs font-mono text-[var(--foreground)]">
                  {uri}
                </code>
                <span className="text-xs text-[var(--text-muted)]">{desc}</span>
              </div>
            ))}
          </div>
        </section>

        {prompts.length > 0 && (
          <section className="space-y-3">
            <div className="text-[11px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
              5 — Prompts
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {prompts.map(([name, desc]) => (
                <div key={name} className="flex flex-col gap-1">
                  <code className="w-fit rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 text-xs font-mono text-[var(--foreground)]">
                    {name}
                  </code>
                  <span className="text-xs text-[var(--text-muted)]">{desc}</span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
