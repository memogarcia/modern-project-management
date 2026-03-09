# Diagrams Workspace (Web App + MCP Server)

## TL;DR

- This repo includes a Next.js app for architecture diagrams, Gantt charts, and calendar views, plus an MCP server that can create and edit the same data over stdio.
- Both components share the same JSON storage directory, so changes made in the app are visible to the MCP server (and vice versa).
- Start the app with `npm --prefix app run dev` and the MCP server with `npm --prefix mcp-server run dev`.

## Quickstart

Time to complete: ~5-10 minutes

What you need:

- Node.js 20+ (recommended)
- `npm`
- Two terminal tabs (one for the app, one for the MCP server)

1. Install dependencies.

```bash
npm install --prefix app
npm install --prefix mcp-server
```

2. Start the web app.

```bash
npm --prefix app run dev
```

3. Start the MCP server (stdio transport).

```bash
npm --prefix mcp-server run dev
```

4. Open `http://localhost:3000`.

5. (Optional) Force both processes to use the same explicit data directory.

```bash
DIAGRAMS_DIR="$PWD/mcp-server/diagrams-data" npm --prefix app run dev
DIAGRAMS_DIR="$PWD/mcp-server/diagrams-data" npm --prefix mcp-server run dev
```

## What This Repo Does

This project is a local-first planning and visualization workspace with two interfaces:

- Web UI (`app/`)
  - Architecture diagram editor (React Flow + Mermaid)
  - Gantt chart editor
  - Calendar view for Gantt tasks
- MCP server (`mcp-server/`)
  - MCP tools for diagram and Gantt CRUD
  - Database schema / ER-diagram helpers
  - Resource listings for diagrams and Gantt charts

## Features

### Architecture Diagrams

- Node-based editor built with React Flow
- Live Mermaid code panel (Monaco editor)
- Mermaid <-> canvas sync
- Auto-layout support (ELK-based layout utilities)
- Undo/redo, copy/cut/paste, grouping, z-order actions
- PNG export from the canvas
- Shape palette for service, database, gateway, queue, client, cloud, cache, storage, function, container, custom
- Database schema nodes and Mermaid `erDiagram` generation support

### Gantt + Calendar

- Create and edit Gantt charts with task metadata
- Task status, priority, progress, assignee, grouping
- Task links (Jira, GitHub PR/issue, Confluence, Slack, other)
- Calendar view for the same chart data
- Auto-persisted file-backed storage

### MCP Server

- Stdio MCP server using `@modelcontextprotocol/sdk`
- Tooling for architecture diagrams, ER diagrams, and Gantt charts
- Resource URIs for listing stored diagrams/charts

## Repo Structure

```text
.
├── app/                 # Next.js web app (UI + REST API)
├── mcp-server/          # MCP stdio server (TypeScript)
├── AGENTS.md            # Repo-specific contributor/agent guidance
└── README.md
```

Key files:

- `app/src/app/api/diagrams/route.ts` and `app/src/app/api/diagrams/[id]/route.ts`
- `app/src/app/api/gantt/route.ts` and `app/src/app/api/gantt/[id]/route.ts`
- `app/src/lib/diagramsDir.server.ts` (shared data dir resolution in app)
- `app/src/lib/converters.ts` (Mermaid <-> React Flow conversion)
- `app/src/store/diagramStore.ts` / `app/src/store/ganttStore.ts`
- `mcp-server/src/index.ts` (tool + resource registrations)
- `mcp-server/src/storage.ts` (shared storage + atomic writes)

## Architecture and Data Flow

### Shared Storage (Important)

The app and MCP server both read/write JSON files in the same directory.

Default behavior:

- Prefers `DIAGRAMS_DIR` when set
- Otherwise falls back to `mcp-server/diagrams-data` (depending on launch cwd)

Data layout:

- Diagrams: `mcp-server/diagrams-data/<diagram-id>.json`
- Gantt charts: `mcp-server/diagrams-data/gantt/<chart-id>.json`

The generated storage directory is gitignored (`mcp-server/diagrams-data/`).

### Web App Data Flow

- UI components call client storage helpers (`app/src/lib/storage.ts`, `app/src/lib/ganttStorage.ts`)
- Helpers call Next.js API routes under `/api/diagrams` and `/api/gantt`
- API routes write JSON files using server-side helpers

### MCP Data Flow

- MCP client calls stdio tools
- `mcp-server/src/index.ts` validates inputs with Zod
- `mcp-server/src/storage.ts` reads/writes the same JSON files used by the web app

## Running and Building

### Web App (`app/`)

```bash
npm --prefix app run dev
npm --prefix app run build
npm --prefix app run start
```

Notes:

- `npm --prefix app run test` currently runs a build smoke test (`next build`)
- `npm --prefix app run lint` uses `next lint`

### MCP Server (`mcp-server/`)

```bash
npm --prefix mcp-server run dev
npm --prefix mcp-server run build
npm --prefix mcp-server run start
npm --prefix mcp-server run test
```

`start` expects compiled output (`dist/index.js`), so run `build` first.

## REST API (Web App)

All endpoints are file-backed and use the shared storage directory.

### Diagrams

- `GET /api/diagrams` - list diagrams (newest first)
- `POST /api/diagrams` - create/update a diagram JSON document
- `GET /api/diagrams/:id` - fetch a single diagram
- `DELETE /api/diagrams/:id` - delete a diagram

### Gantt Charts

- `GET /api/gantt` - list charts (newest first)
- `POST /api/gantt` - create/update a chart JSON document
- `GET /api/gantt/:id` - fetch a single chart
- `DELETE /api/gantt/:id` - delete a chart

## MCP Tools and Resources

### Diagram Tools

- `list_diagrams`
- `get_diagram`
- `create_diagram`
- `update_diagram`
- `delete_diagram`
- `add_node_to_diagram`
- `add_edge_to_diagram`

### ER / Database Schema Tools

- `create_database_schema`
- `add_table_to_diagram`
- `add_relationship_to_diagram`

### Gantt Tools

- `list_gantt_charts`
- `get_gantt_chart`
- `create_gantt_chart`
- `add_gantt_task`
- `update_gantt_task`
- `add_link_to_gantt_task`
- `delete_gantt_chart`

### MCP Resources

- `archdiagram://diagrams`
- `archdiagram://gantt-charts`

## Example MCP Configuration (stdio)

Example shape for an MCP client config (adjust paths for your machine):

```json
{
  "mcpServers": {
    "archdiagram": {
      "command": "npm",
      "args": ["--prefix", "/absolute/path/to/diagrams/mcp-server", "run", "dev"],
      "env": {
        "DIAGRAMS_DIR": "/absolute/path/to/diagrams/mcp-server/diagrams-data"
      }
    }
  }
}
```

If your MCP client expects a compiled server, use `run start` after `npm --prefix mcp-server run build`.

## Troubleshooting

### The app and MCP server do not see the same diagrams

Cause:

- They are resolving different working directories and therefore different storage paths.

Fix:

- Set `DIAGRAMS_DIR` explicitly for both processes to the same absolute path.

### Diagrams appear but canvas is empty

Possible cause:

- A diagram was created from Mermaid-only content (for example via MCP) and has no stored React Flow nodes yet.

What happens:

- The app attempts to parse Mermaid and sync it to the canvas automatically on load.

### Corrupt JSON file errors

Cause:

- A manually edited or partially written JSON file in the storage directory.

Fix:

- Inspect the file under `mcp-server/diagrams-data/` (or your custom `DIAGRAMS_DIR`)
- Repair JSON syntax or delete the broken file if disposable

## Validation and Tests

Recommended checks after changes:

```bash
npm --prefix mcp-server run test
npm --prefix mcp-server run build
npm --prefix app run build
```

Manual smoke tests worth doing when changing shared models/storage:

- Create diagram in UI, confirm MCP `list_diagrams` sees it
- Create Gantt chart via MCP, confirm it appears in `/gantt` and `/calendar`
- Edit Mermaid in UI and reload the page

## Rollback (Local Dev)

- Stop both processes
- Remove the generated storage directory if you want a clean slate:

```bash
rm -rf mcp-server/diagrams-data
```

- Restart the app and MCP server

