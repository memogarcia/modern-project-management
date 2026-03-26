# PlanView - Diagram-First Troubleshooting Memory with Project Roadmaps

## TL;DR

- PlanView is a private troubleshooting workspace where diagrams, Mermaid, investigations, project roadmaps, and MCP clients all operate on the same durable SQLite-backed system memory.
- The core workflow is: model a system, attach rich node and edge metadata, run investigations against affected components, store evidence and commands, and extract reusable patterns.
- The Next.js app lives in `app/`. The MCP stdio server lives in `mcp-server/`. Both read and write the same database and artifact store.

## Quickstart

Time to complete: ~5 minutes

What you need:

- `bun` (1.3+)
- Two terminal tabs

1. Install dependencies.

```bash
bun install
```

2. Start the web app.

```bash
PLANVIEW_DB=./mcp-server/data/planview.db \
PLANVIEW_ARTIFACTS_DIR=./mcp-server/data/artifacts \
bun --cwd app run dev
```

3. Start the MCP server against the same storage.

```bash
PLANVIEW_DB=./mcp-server/data/planview.db \
PLANVIEW_ARTIFACTS_DIR=./mcp-server/data/artifacts \
bun --cwd mcp-server run dev
```

4. Open `http://localhost:8000`.

5. Verify the shared setup:
   - create a diagram in the app
   - add node metadata and an investigation
   - confirm the same diagram and investigation are available through MCP tools and resources

Rollback:

- stop both processes
- remove `mcp-server/data/planview.db`
- remove `mcp-server/data/artifacts/`

## What PlanView Is

PlanView is not a generic PM suite and not a generic whiteboard.

It is a diagram-first troubleshooting memory product for:

- engineers operating complex systems
- AI agents using MCP to read and update durable context
- consultancies that need reusable operational knowledge without sharing raw client context

The durable asset is the combination of:

- system topology
- node and edge metadata
- troubleshooting sessions
- evidence and artifacts
- commands and AI trace references
- reusable knowledge patterns

## Core Product Model

The current foundation is built around these objects:

- `Diagram`
- `Project`
- `ProjectTask`
- `DiagramNodeMetadata`
- `DiagramEdgeMetadata`
- `TroubleshootingSession`
- `SessionArtifact`
- `SessionComment`
- `KnowledgePattern`

Each diagram can now carry:

- rich node metadata: owner, tags, docs, dashboards, logs, traces, runbooks, notes, attachments, timestamps
- rich edge metadata: relationship type, protocol, auth assumptions, dependency notes, evidence links, failure modes, timestamps
- linked investigations with timeline entries, comments, commands, resolution details, and extracted patterns

## Architecture

### Shared persistence

The app and MCP server share one SQLite database and one artifact directory.

- Default database: `mcp-server/data/planview.db`
- Default artifact root: `mcp-server/data/artifacts`
- Override with:
  - `PLANVIEW_DB`
  - `PLANVIEW_ARTIFACTS_DIR`

Storage is migration-backed and now includes:

- `schema_migrations`
- `projects`, `columns`, `epics`, `tasks`, `task_dependencies`
- `diagrams`, `diagram_nodes`, `diagram_edges`
- `troubleshooting_sessions`
- `troubleshooting_session_nodes`
- `troubleshooting_session_edges`
- `troubleshooting_timeline_entries`
- `troubleshooting_comments`
- `troubleshooting_commands`
- `knowledge_patterns`
- `artifacts`

The shared DB/domain logic lives in `shared/planview/` so the app and MCP server do not drift on schema, validation, Mermaid parsing, or troubleshooting models.

### Mermaid safety

Mermaid is treated as a safe editing surface, not the only source of truth.

- Mermaid edits preserve node and edge IDs when possible
- existing node and edge metadata is preserved during reconciliation
- unsupported Mermaid syntax fails visibly
- parse failures do not wipe the last good graph
- round-trip tests cover flowcharts, labeled edges, subgraphs, ER diagrams, and failure cases

## App Surface

The main navigation is now oriented around:

- Projects
- Diagrams
- Investigations
- Patterns
- MCP

Key UI surfaces:

- project list and project-based Gantt roadmap views
- diagram editor with React Flow + Mermaid
- structured node metadata editor
- structured edge metadata editor
- investigation panel linked to the active diagram
- pattern listing and MCP onboarding pages

## MCP Surface

The MCP server is production-oriented for troubleshooting workflows.

### Diagram tools

- `get_planview_guide`
- `list_projects`
- `get_project`
- `create_project`
- `update_project`
- `delete_project`
- `list_project_tasks`
- `upsert_project_task`
- `delete_project_task`
- `list_diagrams`
- `get_diagram`
- `create_diagram`
- `update_diagram`
- `delete_diagram`
- `get_diagram_metadata`
- `update_diagram_node_metadata`
- `update_diagram_edge_metadata`

### Investigation tools

- `create_troubleshooting_session`
- `list_troubleshooting_sessions`
- `get_troubleshooting_session`
- `update_troubleshooting_session`
- `append_session_timeline_entry`
- `append_session_comment`
- `append_session_command`
- `link_session_to_entities`
- `extract_knowledge_pattern`
- `list_knowledge_patterns`
- `search_troubleshooting_memory`
- `list_artifacts`
- `get_artifact_metadata`
- `attach_artifact`

### Resources

- `planview://guide/workflows`
- `planview://projects`
- `planview://projects/{projectId}`
- `planview://projects/{projectId}/gantt`
- `planview://diagrams`
- `planview://diagrams/{diagramId}`
- `planview://investigations`
- `planview://investigations/{sessionId}`
- `planview://patterns`
- `planview://patterns/{patternId}`
- `planview://artifacts`
- `planview://artifacts/{artifactId}`

### Local MCP config note

For repo-local work, run:

```bash
bun --cwd mcp-server run dev
```

If your MCP client requires absolute paths, derive them from `pwd` in this repo and set:

- `PLANVIEW_DB`
- `PLANVIEW_ARTIFACTS_DIR`

Avoid placeholder paths that do not exist on disk.

## Repo Map

```text
.
├── app/                 # Next.js app router UI + REST API
├── mcp-server/          # MCP stdio server and E2E tests
├── shared/planview/     # Shared domain, migrations, validation, Mermaid, storage
├── docs/01-product/     # Product direction and roadmap
├── AGENTS.md
└── README.md
```

Important files:

- `app/src/store/diagramStore.ts`
- `app/src/components/DiagramEditor.tsx`
- `app/src/components/TroubleshootingPanel.tsx`
- `app/src/lib/db.server.ts`
- `app/src/lib/converters.ts`
- `mcp-server/src/index.ts`
- `mcp-server/src/db.ts`
- `shared/planview/database.ts`
- `shared/planview/domain.ts`
- `shared/planview/validation.ts`
- `shared/planview/mermaid.ts`

## Validation

Use these commands from the repo root:

```bash
bun --cwd app run lint
bun --cwd app run build
bun --cwd mcp-server run build
bun --cwd mcp-server run test
```

Notes:

- `app`'s `lint` script is a TypeScript validation pass. This replaces the old `next lint` path, which is not the right validation entrypoint for the current Next 16 setup.
- The MCP test suite includes:
  - Mermaid round-trip and parse-failure safety tests
  - storage-level troubleshooting persistence tests
  - MCP E2E tests for the new troubleshooting memory tools

## Docs

Product direction:

- [Architecture-Backed Troubleshooting Memory](docs/01-product/troubleshooting-memory-strategy.md)
- [MVP And Refactor Roadmap](docs/01-product/mvp-and-refactor-roadmap.md)
- [Run A Local Troubleshooting Workflow](docs/02-how-to/run-local-troubleshooting-workflow.md)
