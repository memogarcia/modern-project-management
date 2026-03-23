export default function McpPage() {
  const configSnippet = `{
  "mcpServers": {
    "planview": {
      "command": "npm",
      "args": ["--prefix", "./mcp-server", "run", "dev"],
      "env": {
        "PLANVIEW_DB": "./mcp-server/data/planview.db"
      }
    }
  }
}`;

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
      <div className="flex h-10 items-center border-b border-[var(--border)] px-4 shrink-0">
        <span className="text-sm font-semibold">MCP</span>
      </div>
      <div className="flex-1 overflow-y-auto p-8">
        <div className="mx-auto max-w-4xl space-y-6">
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight">MCP access for diagram troubleshooting memory</h1>
            <p className="max-w-2xl text-sm text-[var(--text-muted)]">
              Point your MCP client at the local server so agents can read diagrams, investigations, patterns, and the same SQLite-backed troubleshooting context as the app.
            </p>
          </div>

          <section className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--panel-bg)] p-5">
            <div className="text-sm font-semibold">Quickstart</div>
            <pre className="overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 text-xs leading-relaxed">
{`npm install --prefix mcp-server
npm --prefix mcp-server run build
npm --prefix mcp-server run dev`}
            </pre>
          </section>

          <section className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--panel-bg)] p-5">
            <div className="text-sm font-semibold">Client config</div>
            <pre className="overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 text-xs leading-relaxed">
              {configSnippet}
            </pre>
            <div className="text-xs text-[var(--text-muted)]">
              Use the same `PLANVIEW_DB` path for the app and MCP server if you override the default database location.
            </div>
          </section>

          <section className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--panel-bg)] p-5">
            <div className="text-sm font-semibold">Core tool surface</div>
            <div className="grid gap-2 text-sm text-[var(--text-muted)]">
              <div>`get_diagram`, `update_diagram_node_metadata`, `update_diagram_edge_metadata`</div>
              <div>`create_troubleshooting_session`, `list_troubleshooting_sessions`, `get_troubleshooting_session`, `update_troubleshooting_session`</div>
              <div>`append_session_timeline_entry`, `append_session_comment`, `append_session_command`, `extract_knowledge_pattern`, `list_knowledge_patterns`</div>
              <div>`search_troubleshooting_memory`, `list_artifacts`, `get_artifact_metadata`, `attach_artifact`</div>
              <div>Resources for diagrams, investigations, patterns, and artifact metadata</div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
