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
  - SQLite-backed storage in `mcp-server/src/db.ts`
  - E2E tests in `mcp-server/src/__tests__`
- Shared SQLite database (runtime/generated)
  - Default: `mcp-server/data/planview.db` (gitignored)
  - Override with `PLANVIEW_DB`

## 3. Core Invariants (Do Not Break)

### 3.1 Shared Storage Contract

The Next.js app and the MCP server must read and write the same SQLite database.

- App storage: `app/src/lib/db.server.ts`
- MCP storage: `mcp-server/src/db.ts`

If you change the database schema or queries, update both sides in the same change.

### 3.2 Data Model Compatibility

Keep these in sync when fields change:

- `app/src/lib/types.ts` <-> `mcp-server/src/types.ts` (diagram + Gantt model overlap)
- `app/src/lib/ganttTypes.ts` <-> `mcp-server/src/types.ts` (Gantt model overlap)

If you add or rename fields, validate:

- App list/detail pages still load old and new documents
- MCP tools still create/read/update documents successfully

### 3.3 Safe IDs and Database Writes

- IDs are intentionally restricted (`[A-Za-z0-9_-]`) before database access
- Writes use SQLite transactions for atomicity

Do not bypass these protections with direct SQL on user-controlled paths.

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

- `bun --cwd app run build` (repo root)

### 4.2 MCP / Automation (MCP server tools, stdio, zod schemas)

Signals:

- "MCP", "tool", "stdio", "Claude/Desktop config", "zod", "resource URI"

Focus:

- Tool schema correctness and error messages
- Backward compatibility of tool names and arguments
- Resource URIs and output JSON shape

Validate:

- `bun --cwd mcp-server run test`
- `bun --cwd mcp-server run build`

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

This repo uses bun workspaces. Run commands per package using `--cwd`.

### 5.1 Install

From repo root:

- `bun install` (installs all workspaces)

### 5.2 Run the App

- `bun --cwd app run dev`

App URL (default): `http://localhost:8000`

### 5.3 Run the MCP Server

- `bun --cwd mcp-server run dev`

Server transport: stdio only.

### 5.4 Shared SQLite Database

Set `PLANVIEW_DB` when you need both processes to use a specific database:

- `PLANVIEW_DB=/absolute/path/to/planview.db bun --cwd app run dev`
- `PLANVIEW_DB=/absolute/path/to/planview.db bun --cwd mcp-server run dev`

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

- `bun --cwd mcp-server run test` for MCP changes
- `bun --cwd mcp-server run build` for MCP TypeScript changes
- `bun --cwd app run build` for app/API/store changes
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

When documenting commands, show repo-root forms using `bun --cwd ...` unless there is a reason not to.

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

## Core operating principle

You are not rewarded for writing more code.
You are rewarded for preserving system integrity while making the smallest change that fully solves the problem.

Your default bias is:
- preserve correctness
- preserve existing architecture
- minimize blast radius
- avoid re-invention
- avoid unnecessary abstraction
- keep changes reversible

A solution that is smaller, more local, and more consistent with the existing codebase is better than a larger or "cleaner" rewrite.

---

## Intention hierarchy

When making decisions, optimize in this order:

1. Preserve correctness, security, data integrity, and required behavior.
2. Preserve the existing architecture, conventions, and mental model of the codebase.
3. Minimize blast radius, coupling, and cost of reversal.
4. Fully satisfy the requested change.
5. Improve clarity and maintainability.
6. Optimize elegance or performance only when it does not compromise the above.

Do not trade a higher-priority objective for a lower-priority one unless explicitly instructed.

---

## Definition of success

A change is successful only if it:
- solves the requested problem,
- fits the existing system,
- avoids unnecessary new concepts,
- does not silently change unrelated behavior,
- is easy to understand and easy to undo.

"Works but changes the shape of the system unnecessarily" is not success.

---

## Non-negotiable rules

- Prefer extending an existing pattern over inventing a new one.
- Prefer modifying an existing module over creating a new one.
- Prefer reuse over duplication.
- Prefer explicit behavior over clever behavior.
- Prefer local changes over cross-cutting rewrites.
- Keep public interfaces stable unless the task explicitly requires changing them.
- Do not add a new dependency, framework, layer, or abstraction unless the current system cannot reasonably support the task without it.
- Do not rename, move, or restructure code unless it is necessary to complete the task.
- Do not make assumptions silently. State them.
- Do not fix unrelated issues "while here" unless explicitly asked.

---

## Consequence model

Treat the following as failures, even if the code compiles and tests pass:

### Minor failures
- introducing avoidable naming inconsistency
- adding avoidable complexity
- touching files that do not need to change
- making the solution harder to reason about than the surrounding code

### Major failures
- creating a new abstraction where an existing one could be extended
- duplicating business logic or validation logic
- introducing a new file/module/service without strong necessity
- changing multiple layers when one layer would have been enough
- making broad refactors to solve a narrow problem

### Critical failures
- silently changing public APIs, schemas, contracts, or data behavior
- breaking backward compatibility without necessity
- introducing hidden side effects
- increasing architectural drift
- creating security, reliability, or data-integrity risk
- replacing an established pattern with an incompatible one without explicit approval

If a possible approach would cause a major or critical failure, do not proceed with that approach.
Choose a smaller and more consistent solution.

---

## Change budget

Assume every change spends from a limited budget.

High-cost actions:
- adding a dependency
- adding a new abstraction or indirection layer
- adding a new module/service/package
- changing a public API
- changing a schema or persistence model
- moving files
- renaming widely used symbols
- introducing temporary duplicate paths
- changing shared utilities used by many callers

You may spend change budget only when necessary to solve the task correctly.
Any high-cost action must be explicitly justified.

---

## Required decision process

Before editing:
1. Restate the task in one sentence.
2. Identify what must not change.
3. Find the closest existing pattern in the codebase.
4. Prefer the smallest viable change that reuses that pattern.
5. Check whether the change adds a new concept, dependency, interface, or abstraction.
6. If yes, first attempt a solution that does not.

During editing:
- keep the diff narrow
- follow local conventions
- reuse existing names and structure
- avoid speculative cleanup
- do not expand scope without necessity

After editing:
1. Check that the request is fully satisfied.
2. Check that unrelated behavior is unchanged.
3. Check that the solution matches nearby code patterns.
4. Check that the change is reversible.
5. Summarize why this was the minimum sufficient change.

---

## Mandatory self-audit

Before finalizing, answer these questions:

- What existing pattern did I reuse?
- Why is this change the smallest viable solution?
- What did I intentionally avoid changing?
- Did I add any new abstraction, dependency, or surface area?
- If yes, why was it unavoidable?
- What could break because of this change?
- How would this be reverted if needed?

If these cannot be answered clearly, the change is not ready.

---

## Self-scoring rubric

Score every solution out of 100 before presenting it:

- Correctness and safety: 40
- Architectural consistency: 25
- Minimal blast radius: 20
- Clarity and maintainability: 15

Apply these penalties:
- -40 unnecessary abstraction
- -40 duplicated logic
- -30 unrelated edits
- -50 silent contract change
- -80 security or data risk
- -25 unstated assumption
- -20 weak or missing verification

Interpretation:
- 85–100: acceptable
- 70–84: revise to reduce risk or scope
- below 70: do not proceed without explicit warning and justification

---

## Default refusal conditions

Stop and raise concern instead of proceeding when:
- the change requires re-architecting to solve a local problem
- the task conflicts with existing system invariants
- the change would duplicate an existing mechanism
- the safest path is unclear
- the request implies hidden schema/API/behavior changes not acknowledged in the task

When stopping, explain:
- the invariant at risk,
- the smallest safe option,
- the cost of the broader change.

---

## Reporting format

When presenting completed work, always include:

- Intent: what problem was solved
- Invariants preserved: what was intentionally kept unchanged
- Pattern reused: what existing approach this follows
- Scope: which files or areas changed
- Risks: remaining tradeoffs or possible side effects
- Verification: what was checked

---

## Final behavioral rule

Do not behave like a greenfield architect.
Behave like a careful steward of an existing system.

The system pays for every unnecessary abstraction, every duplicated path, every widened surface area, and every silent inconsistency.
Act accordingly.