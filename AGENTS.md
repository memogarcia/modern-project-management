# AGENTS.md

Guidance for agents and contributors working in this repository (`diagrams`).

This repo contains:

- A Next.js app for architecture diagrams, Gantt charts, and calendar views
- A Model Context Protocol (MCP) server for creating/updating the same data over stdio
- Shared JSON file storage used by both the app and the MCP server

## 1. Scope and Intent

Optimize for:

- Shared-data compatibility between `app/` and `mcp-server/`
- Small, readable changes
- Fast local validation for the area you changed
- Preserving user data and avoiding corrupt writes

Default role if unclear: Software Engineer + Troubleshooter.

## 2. Repo Map (Read This First)

- `app/`
  - Next.js App Router UI
  - REST API routes under `app/src/app/api/**`
  - Client state in Zustand stores
  - Diagram editor uses React Flow + Mermaid
- `mcp-server/`
  - TypeScript MCP stdio server using `@modelcontextprotocol/sdk`
  - Tool registrations in `mcp-server/src/index.ts`
  - File-backed storage in `mcp-server/src/storage.ts`
  - E2E tests in `mcp-server/src/__tests__`
- Shared storage directory (runtime/generated)
  - Default: `mcp-server/diagrams-data/` (gitignored)
  - Override with `DIAGRAMS_DIR`

## 3. Core Invariants (Do Not Break)

### 3.1 Shared Storage Contract

The Next.js app and the MCP server must read and write the same JSON files.

- App storage resolution: `app/src/lib/diagramsDir.server.ts`
- MCP storage resolution: `mcp-server/src/storage.ts`

If you change storage path resolution or data layout, update both sides in the same change.

### 3.2 Data Model Compatibility

Keep these in sync when fields change:

- `app/src/lib/types.ts` <-> `mcp-server/src/types.ts` (diagram + Gantt model overlap)
- `app/src/lib/ganttTypes.ts` <-> `mcp-server/src/types.ts` (Gantt model overlap)

If you add or rename fields, validate:

- App list/detail pages still load old and new documents
- MCP tools still create/read/update documents successfully

### 3.3 Safe IDs and File Writes

- IDs are intentionally restricted (`[A-Za-z0-9_-]`) before file access
- Writes are atomic (tmp file + rename) in storage helpers

Do not bypass these protections with direct `fs.writeFileSync` on user-controlled paths.

### 3.4 Mermaid <-> Flow Sync

The diagram editor supports both React Flow state and Mermaid text.

- Converters live in `app/src/lib/converters.ts`
- Store orchestration lives in `app/src/store/diagramStore.ts`

When changing converters, test round-trip behavior and preserve existing diagrams when possible.

## 4. Working Modes (Auto-Detect)

Use the right "hat" based on the request.

### 4.1 UI / Frontend (Next.js, React Flow, Mermaid panel)

Signals:

- "editor", "React Flow", "Mermaid panel", "toolbar", "Next.js page", "calendar view"

Focus:

- Preserve existing visual language and interactions
- Keep keyboard shortcuts and autosave behavior intact
- Avoid breaking client/server boundaries (`"use client"` vs server modules)

Validate:

- `npm --prefix app run build` (repo root)

### 4.2 MCP / Automation (MCP server tools, stdio, zod schemas)

Signals:

- "MCP", "tool", "stdio", "Claude/Desktop config", "zod", "resource URI"

Focus:

- Tool schema correctness and error messages
- Backward compatibility of tool names and arguments
- Resource URIs and output JSON shape

Validate:

- `npm --prefix mcp-server run test`
- `npm --prefix mcp-server run build`

### 4.3 Shared Persistence / Data Integrity

Signals:

- "storage", "DIAGRAMS_DIR", "JSON", "corrupt file", "not loading", "shared data"

Focus:

- Path resolution parity between app and MCP server
- Atomic writes
- Defensive reads and error handling

Validate:

- Manual create/edit from app and MCP using same `DIAGRAMS_DIR`

### 4.4 Docs / Copywriting

Signals:

- "README", "how-to", "docs", "tutorial", "reference"

Focus:

- TL;DR first
- Quickstart with exact commands
- Verification + rollback/troubleshooting notes

## 5. Local Development Commands

This repo is not configured as a single npm workspace. Run commands per package.

### 5.1 Install

From repo root:

- `npm install --prefix app`
- `npm install --prefix mcp-server`

Optional:

- Root `npm install` only installs root helper deps and does not install `app/` or `mcp-server/`.

### 5.2 Run the App

- `npm --prefix app run dev`

App URL (default): `http://localhost:3000`

### 5.3 Run the MCP Server

- `npm --prefix mcp-server run dev`

Server transport: stdio only.

### 5.4 Shared Data Directory

Set `DIAGRAMS_DIR` when you need both processes to use a specific location:

- `DIAGRAMS_DIR=/absolute/path npm --prefix app run dev`
- `DIAGRAMS_DIR=/absolute/path npm --prefix mcp-server run dev`

## 6. Change Rules by Area

### 6.1 If You Change MCP Tooling

- Update tool registration in `mcp-server/src/index.ts`
- Keep names stable unless explicitly doing a breaking change
- Update/add E2E coverage in `mcp-server/src/__tests__`
- Update `README.md` MCP tool list if user-facing behavior changes

### 6.2 If You Change API Routes

- Keep route contract aligned with client callers in `app/src/lib/storage.ts` and `app/src/lib/ganttStorage.ts`
- Preserve ID validation and clear error responses
- Avoid introducing business logic in route handlers if it belongs in shared helpers/stores

### 6.3 If You Change Diagram Editor Behavior

- Check keyboard shortcuts still work (`save`, `undo/redo`, `layout`, copy/cut/paste)
- Check Mermaid panel sync still works (editor -> flow and flow -> Mermaid)
- Confirm autosave does not cause loops or stale overwrites

### 6.4 If You Change Gantt Models or UI

- Keep `app/src/lib/ganttTypes.ts` and `mcp-server/src/types.ts` aligned
- Validate both Gantt and Calendar views still render
- Verify task links and metadata survive save/load

## 7. Validation Checklist (Use Before Hand-off)

Pick the relevant subset based on the change.

- `npm --prefix mcp-server run test` for MCP changes
- `npm --prefix mcp-server run build` for MCP TypeScript changes
- `npm --prefix app run build` for app/API/store changes
- Manual smoke test create/edit/delete in UI when touching storage or editor logic
- Manual smoke test MCP tool create/read/update/delete when touching MCP tools or shared models

Note: `app`'s `test` script currently runs a build smoke test.

## 8. Coding Conventions (Repo-Specific)

- Prefer small explicit functions over large inline mutations
- Keep server-only code in `*.server.ts` or server route files
- Reuse existing store patterns (queued persistence, error state) instead of inventing new ones
- Preserve backward compatibility for stored JSON when practical
- Do not commit generated data under `mcp-server/diagrams-data/` (already gitignored)

## 9. Documentation Style

Use plain English. Prefer:

- TL;DR first
- Quickstart with copy-paste commands
- "What you need" / prerequisites
- Verification and troubleshooting

When documenting commands, show repo-root forms using `npm --prefix ...` unless there is a reason not to.

## 10. PR Notes (Recommended)

Title:

- `feat: ...`
- `fix: ...`
- `docs: ...`

Include:

- Why the change was needed
- What changed (behavior level)
- How you validated it
- Follow-up work or known limitations

