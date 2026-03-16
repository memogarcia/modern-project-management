# PlanView — Project Management + Architecture Diagrams

## TL;DR

- A **Next.js** web app for project management (Kanban, Gantt, Calendar, Matrix, Sessions) and architecture diagram editing, plus an **MCP server** that exposes the same data over stdio.
- Both components share a single **SQLite** database, so changes made in the app are visible to the MCP server (and vice versa).
- Start the app with `npm --prefix app run dev` and the MCP server with `npm --prefix mcp-server run dev`.

## Quickstart

Time to complete: ~5 minutes

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

5. (Optional) Force both processes to use the same explicit database path.

```bash
PLANVIEW_DB=/absolute/path/to/planview.db npm --prefix app run dev
PLANVIEW_DB=/absolute/path/to/planview.db npm --prefix mcp-server run dev
```

## What This Repo Does

PlanView is a local-first planning and visualization workspace with two interfaces:

- **Web UI** (`app/`)
  - Project list and project hub
  - Kanban board with drag-and-drop, epics, and WIP limits
  - Gantt chart view (timeline derived from task dates)
  - Calendar view for task scheduling
  - Eisenhower Matrix view (priority-based quadrants)
  - Focus Sessions tracker (pomodoro-style sessions linked to tasks)
  - Architecture diagram editor (React Flow + Mermaid)
  - Task detail modal with links, tags, dependencies, and metadata
- **MCP Server** (`mcp-server/`)
  - 35+ tools for projects, tasks, diagrams, sessions, and more
  - 3 resources (diagrams, projects list, project detail)
  - 2 prompts (sprint planning, project status report)
  - SQLite-backed storage with WAL mode

## Features

### Project Management

- **Kanban board** — Customizable columns, drag-and-drop task movement, WIP limits
- **Epics** — Group tasks under epics with color-coded badges
- **Tasks** — Priority (low/medium/high/critical), assignee, tags, start/due dates, progress tracking, typed links (Jira, GitHub PR/Issue, Confluence, Slack), task dependencies, and custom metadata
- **Gantt chart** — Timeline view derived from task start/due dates
- **Calendar** — Month-based calendar view of task schedules
- **Matrix** — Eisenhower-style quadrant view derived from task priority
- **Focus Sessions** — Pomodoro-style sessions linked to specific tasks

### Architecture Diagrams

- Node-based editor built with React Flow
- Live Mermaid code panel (Monaco editor)
- Mermaid ↔ canvas sync
- Auto-layout support (ELK-based layout utilities)
- Undo/redo, copy/cut/paste, grouping, z-order actions
- PNG export from the canvas
- Shape palette: service, database, gateway, queue, client, cloud, cache, storage, function, container, custom
- Database schema nodes and Mermaid `erDiagram` generation support
- Diagrams can be linked to projects

### MCP Server

- Stdio MCP server using `@modelcontextprotocol/sdk` (v1.1.0)
- Modern `registerTool` / `registerResource` / `registerPrompt` API with tool annotations
- Comprehensive tooling across projects, tasks, diagrams, sessions, and diagram linking
- Built-in sprint planning and project status report prompts

## Repo Structure

```text
.
├── app/                 # Next.js web app (UI + REST API)
├── mcp-server/          # MCP stdio server (TypeScript)
├── AGENTS.md            # Repo-specific contributor/agent guidance
├── DESIGN_SYSTEM.md     # Design tokens and styling reference
└── README.md
```

Key files:

| Area | File |
|------|------|
| App DB layer | `app/src/lib/db.server.ts` |
| App types (projects) | `app/src/lib/projectTypes.ts` |
| App types (diagrams) | `app/src/lib/types.ts` |
| Diagram store | `app/src/store/diagramStore.ts` |
| Project store | `app/src/store/projectStore.ts` |
| Mermaid ↔ Flow converters | `app/src/lib/converters.ts` |
| API routes (projects) | `app/src/app/api/projects/` |
| API routes (diagrams) | `app/src/app/api/diagrams/` |
| MCP server entry | `mcp-server/src/index.ts` |
| MCP DB layer | `mcp-server/src/db.ts` |
| MCP types | `mcp-server/src/types.ts` |

## Architecture and Data Flow

### Shared SQLite Database (Important)

The app and MCP server both read/write the same SQLite database using `better-sqlite3` with WAL mode and foreign keys enabled.

Default path resolution:

1. `PLANVIEW_DB` environment variable (if set)
2. `<repo-root>/mcp-server/data/planview.db` (if running from repo root)
3. `mcp-server/data/planview.db` (relative fallback)

The `mcp-server/data/` directory is gitignored.

### Database Schema

```
projects ──┬── columns        (Kanban columns per project)
           ├── epics           (Task grouping)
           ├── tasks           (Core work items)
           │   ├── task_tags
           │   ├── task_links
           │   └── task_dependencies
           ├── sessions        (Focus sessions)
           │   └── session_tasks
           └── diagrams        (Linked via project_id FK)
```

### Web App Data Flow

1. UI components use Zustand stores (`projectStore`, `diagramStore`)
2. Stores call client-side fetch helpers (`projectStorage.ts`, `storage.ts`)
3. Helpers call Next.js API routes (`/api/projects`, `/api/diagrams`)
4. API routes use `db.server.ts` for SQLite reads/writes

### MCP Data Flow

1. MCP client calls stdio tools
2. `mcp-server/src/index.ts` validates inputs with Zod schemas
3. `mcp-server/src/db.ts` reads/writes the same SQLite database

## Running and Building

### Web App (`app/`)

```bash
npm --prefix app run dev      # Dev server on :3000
npm --prefix app run build    # Production build
npm --prefix app run start    # Start production server
npm --prefix app run lint     # ESLint (next lint)
```

### MCP Server (`mcp-server/`)

```bash
npm --prefix mcp-server run dev    # Run in dev mode
npm --prefix mcp-server run build  # Compile TypeScript
npm --prefix mcp-server run start  # Run compiled output
npm --prefix mcp-server run test   # Run E2E tests
```

`start` expects compiled output (`dist/index.js`), so run `build` first.

## REST API (Web App)

All endpoints use the shared SQLite database.

### Projects

- `GET /api/projects` — List projects (summary metadata)
- `POST /api/projects` — Create or update a project
- `GET /api/projects/:id` — Get full project (columns, epics, tasks, sessions, diagrams)
- `DELETE /api/projects/:id` — Delete a project

### Diagrams

- `GET /api/diagrams` — List diagrams (newest first)
- `POST /api/diagrams` — Create or update a diagram
- `GET /api/diagrams/:id` — Fetch a single diagram
- `DELETE /api/diagrams/:id` — Delete a diagram

## MCP Tools and Resources

### Diagram Tools

| Tool | Description |
|------|-------------|
| `list_diagrams` | List all diagrams |
| `get_diagram` | Get diagram by ID |
| `create_diagram` | Create from Mermaid code |
| `update_diagram` | Update name, description, or Mermaid code |
| `delete_diagram` | Delete a diagram |
| `add_node_to_diagram` | Add a node to Mermaid code |
| `add_edge_to_diagram` | Add an edge between nodes |

### ER / Database Schema Tools

| Tool | Description |
|------|-------------|
| `create_database_schema` | Create ER diagram with tables and relationships |
| `add_table_to_diagram` | Add a table to an existing diagram |
| `add_relationship_to_diagram` | Add a relationship between tables |

### Project Tools

| Tool | Description |
|------|-------------|
| `list_projects` | List all projects with summary stats |
| `get_project` | Get full project by ID |
| `create_project` | Create project with optional custom columns |
| `update_project` | Update project name/description |
| `delete_project` | Delete project and all data |

### Column Tools

| Tool | Description |
|------|-------------|
| `add_kanban_column` | Add column to a project |
| `update_kanban_column` | Update column name, color, WIP limit |
| `reorder_kanban_columns` | Reorder all columns |
| `delete_kanban_column` | Delete column (moves tasks to target column) |

### Epic Tools

| Tool | Description |
|------|-------------|
| `list_kanban_epics` | List epics in a project |
| `get_kanban_epic` | Get epic with its tasks |
| `create_kanban_epic` | Create an epic |
| `update_kanban_epic` | Update epic name, description, color |
| `delete_kanban_epic` | Delete epic (optionally move tasks) |

### Task Tools

| Tool | Description |
|------|-------------|
| `create_kanban_task` | Create task with all metadata |
| `update_kanban_task` | Update any task fields |
| `move_kanban_task` | Move task to column/position |
| `delete_kanban_task` | Delete a task |
| `list_kanban_tasks` | List/filter tasks (by epic, column, assignee, priority, tag) |
| `add_link_to_kanban_task` | Add typed link to task |

### Session Tools

| Tool | Description |
|------|-------------|
| `add_project_session` | Create a focus session |
| `update_project_session` | Update session title/notes |
| `remove_project_session` | Remove a session |
| `add_task_to_project_session` | Link a task to a session |
| `remove_task_from_project_session` | Unlink a task from a session |

### Diagram Linking Tools

| Tool | Description |
|------|-------------|
| `link_diagram_to_project` | Associate a diagram with a project |
| `unlink_diagram_from_project` | Remove the association |

### MCP Resources

| URI | Description |
|-----|-------------|
| `planview://diagrams` | All diagrams |
| `planview://projects` | All projects (summary) |
| `planview://projects/{projectId}` | Full project detail (dynamic) |

### MCP Prompts

| Prompt | Description |
|--------|-------------|
| `plan-sprint` | Generate a sprint plan from backlog tasks |
| `project-status` | Generate a status report for a project |

## Example MCP Configuration (stdio)

Example shape for an MCP client config (adjust paths for your machine):

```json
{
  "mcpServers": {
    "planview": {
      "command": "npm",
      "args": ["--prefix", "/absolute/path/to/repo/mcp-server", "run", "dev"],
      "env": {
        "PLANVIEW_DB": "/absolute/path/to/repo/mcp-server/data/planview.db"
      }
    }
  }
}
```

If your MCP client expects a compiled server, use `run start` after `npm --prefix mcp-server run build`.

## Troubleshooting

### The app and MCP server do not see the same data

Cause: They are resolving different database paths.

Fix: Set `PLANVIEW_DB` explicitly for both processes to the same absolute path.

### Diagrams appear but canvas is empty

Possible cause: A diagram was created from Mermaid-only content (e.g. via MCP) and has no stored React Flow nodes yet.

What happens: The app parses Mermaid and syncs it to the canvas automatically on load.

### Database locked errors

Cause: Multiple processes writing concurrently without WAL mode, or a stale lock file.

Fix: Both the app and MCP server enable WAL mode by default. If you see lock errors, ensure only one instance of each process is running.

### Reset to clean state

```bash
rm -rf mcp-server/data/planview.db*
```

Restart both the app and MCP server — the database and schema will be recreated automatically.

## Validation and Tests

Recommended checks after changes:

```bash
npm --prefix mcp-server run test
npm --prefix mcp-server run build
npm --prefix app run build
```

Manual smoke tests when changing shared models/storage:

- Create project in UI, confirm MCP `list_projects` sees it
- Create task via MCP, confirm it appears in Kanban board
- Create diagram via MCP, link it to a project, confirm it shows in the project's diagram view
