# Run A Local Troubleshooting Workflow

## TL;DR

- You can run PlanView locally as a shared troubleshooting workspace for both the web app and the MCP server.
- Start both processes against the same `PLANVIEW_DB` and `PLANVIEW_ARTIFACTS_DIR`, then create a diagram, add metadata, open an investigation, and confirm the same data is visible through MCP.
- Time to complete: ~10 minutes.

## Quickstart

1. Install dependencies.

```bash
bun install
```

2. Start the app and MCP server against the same storage.

```bash
PLANVIEW_DB=./mcp-server/data/planview.db \
PLANVIEW_ARTIFACTS_DIR=./mcp-server/data/artifacts \
bun --cwd app run dev
```

```bash
PLANVIEW_DB=./mcp-server/data/planview.db \
PLANVIEW_ARTIFACTS_DIR=./mcp-server/data/artifacts \
bun --cwd mcp-server run dev
```

3. Open `http://localhost:8000`.

4. Create a system diagram, add metadata to a node and an edge, then open an investigation from the diagram view.

5. Verify the same diagram and investigation through MCP:
   - `list_diagrams`
   - `get_diagram_metadata`
   - `list_troubleshooting_sessions`

## What You Need

- `bun` (1.3+)
- access to run the app locally on port `8000`
- access to run the MCP stdio server locally

## Situation

PlanView is now centered on troubleshooting memory, not general project management.

## Complication

That only works if the app and MCP server operate on exactly the same durable storage. If they drift, engineers and agents end up with inconsistent system context.

## Question

How do you run one local workspace that both surfaces can read and write safely?

## Answer

Use the same SQLite database and artifact directory for both processes, then validate the workflow end to end from the diagram into an investigation.

## Steps

1. Start both processes with the same storage env vars.

Why this matters:
This makes the app and MCP server share one source of truth for diagrams, metadata, investigations, patterns, and artifacts.

2. Create a diagram from the app.

Recommended path:
- open `Diagrams`
- create a new diagram
- add at least two nodes and one dependency edge

3. Add production-useful metadata.

For a node, fill in:
- owner
- tags
- runbook or documentation links
- dashboards or logs
- known failure modes

For an edge, fill in:
- relationship type
- protocol
- auth assumptions
- dependency notes

4. Create an investigation from the diagram.

At minimum, capture:
- title
- symptom
- linked nodes
- linked edges
- hypotheses
- notes

5. Add durable evidence.

Use the investigation panel to add:
- a timeline entry
- a comment
- a command record
- an artifact upload if you have a sample log or screenshot

6. Mark the investigation resolved and extract a reusable pattern.

This tests the full reuse path:
- live incident memory
- resolution capture
- pattern extraction for later retrieval

7. Verify through MCP.

From your MCP client, confirm you can see the same data with:
- `get_diagram`
- `get_diagram_metadata`
- `get_troubleshooting_session`
- `search_troubleshooting_memory`

## Check Yourself

You are done when:

- the diagram exists in the app
- node and edge metadata are saved
- at least one investigation is linked to the diagram
- MCP can list and read the same diagram and investigation
- a pattern extracted from the investigation appears in `Patterns`

## If Things Go Sideways

Problem: the app and MCP server do not show the same data.

Fix:
- confirm both processes use the same `PLANVIEW_DB`
- confirm both processes use the same `PLANVIEW_ARTIFACTS_DIR`
- restart both processes after changing env vars

Problem: Mermaid edits fail to apply.

Fix:
- check the visible Mermaid error in the editor
- fix unsupported syntax instead of forcing a save
- keep the last good graph until the Mermaid text validates

Problem: artifacts do not appear.

Fix:
- confirm `PLANVIEW_ARTIFACTS_DIR` exists and is writable
- verify the upload completed from the browser
- inspect `mcp-server/data/artifacts/` for the stored file

## Verify

Run:

```bash
bun --cwd app run lint
bun --cwd app run build
bun --cwd mcp-server run build
bun --cwd mcp-server run test
```

## Rollback

If you want to discard the local workspace:

```bash
rm -f ./mcp-server/data/planview.db
rm -rf ./mcp-server/data/artifacts
```
