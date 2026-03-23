# TODO

## Product Cutover

- Remove the remaining PM-oriented surfaces from the main product story.
- Remove Kanban, Calendar, Matrix, and any other non-core workflow views.
- Remove legacy Sessions/Focus Sessions if they are not part of the new core business.
- Keep the navigation and copy centered on diagrams, investigations, patterns, and MCP only.

## Core Product Work

- Finish hardening the diagram domain model so node and edge metadata stay durable across app and MCP edits.
- Expand troubleshooting memory search so similar sessions and reusable patterns are easier to find.
- Add safer artifact browsing and attachment handling in the app and MCP surface.
- Keep Mermaid sync non-destructive and add more round-trip coverage for edge cases.

## Storage And Safety

- Keep all schema changes migration-based and backward compatible.
- Keep optimistic concurrency on diagram writes and avoid silent last-write-wins behavior.
- Keep JSON parsing defensive in the app and MCP server so malformed data fails visibly instead of crashing.

## MCP And Automation

- Keep the MCP tool surface focused on real troubleshooting workflows.
- Add more machine-usable error responses and resource views for diagrams, sessions, and patterns.
- Add targeted tests whenever a tool changes behavior or data shape.

## Cleanup

- Remove dead PM-specific UI and API code after the new workflow is stable.
- Update docs and onboarding copy any time the product story changes.
- Revisit whether any legacy PM data should be migrated, archived, or deleted once replacement workflows are complete.

