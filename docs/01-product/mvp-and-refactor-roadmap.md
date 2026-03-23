# MVP And Refactor Roadmap

## TL;DR

- The next version of PlanView should be built around diagrams, metadata, sessions, and retrieval.
- Remove most PM-oriented surface area from the main navigation and replace it with troubleshooting workflows.
- The first paid version should feel useful to a single engineer or small consultancy before it tries to support a full incident organization.

## Quickstart

Build in this order:

1. Define the new data model around nodes, edges, sessions, artifacts, and reusable patterns.
2. Add rich metadata and attachments to the existing diagram editor.
3. Add troubleshooting sessions linked to diagram entities.
4. Add retrieval for similar sessions and extracted patterns.
5. Cut or hide PM views from the main product story.

## What You Need

- one clear product owner
- agreement that PM features are no longer the core
- willingness to prioritize persistence and retrieval over surface-level UI growth

## Phase 1: Reframe The Product

Goal:

- make the app feel like an engineering troubleshooting tool on first use

Changes:

- rename product surfaces around systems, investigations, and knowledge
- change landing copy to troubleshooting and architecture
- move PM views out of the primary navigation or remove them
- make the MCP page part of the core workflow, not an advanced extra

Definition of done:

- a new user can explain the product correctly after one minute in the UI

## Phase 2: Rich Graph Metadata

Goal:

- make nodes and edges useful as operational objects, not just visual shapes

Required capabilities:

- rich text notes per node and edge
- attachments
- tags
- dashboard and log links
- ownership
- known failure modes
- last verified marker

Nice to have:

- markdown support
- inline previews for links and attachments

Definition of done:

- a diagram alone can serve as a practical operations entry point

## Phase 3: Troubleshooting Sessions

Goal:

- store actual investigation work next to the graph

Required capabilities:

- create a session from a diagram
- link impacted nodes and edges
- timeline of events
- evidence store
- investigation notes
- commands run
- comments
- AI transcript capture
- resolution summary

Definition of done:

- an engineer can complete and reopen a session without needing Slack or a separate document to understand what happened

## Phase 4: Reuse And Retrieval

Goal:

- stop teams from repeating the same investigation work

Required capabilities:

- search sessions by system component
- search sessions by symptom
- search extracted patterns
- show similar prior sessions
- allow “extract reusable pattern” from a resolved session

Definition of done:

- a user facing a familiar issue can discover a useful previous investigation in less than two minutes

## Phase 5: Consultancy-Grade Sharing

Goal:

- enable cross-project reuse without leaking client data

Required capabilities:

- tenant isolation
- private-by-default session storage
- reusable pattern publishing workflow
- redaction before publishing
- visibility controls per client and workspace

Definition of done:

- a consultancy can safely reuse generalized troubleshooting knowledge across clients

## Refactor Priorities In The Current Repo

### High Priority

- reduce PM-first navigation and copy
- introduce session-oriented domain objects
- extend node and edge metadata models
- harden persistence before adding more features
- unify app and MCP storage logic to reduce drift

### Medium Priority

- add import paths from Mermaid and infrastructure sources
- improve search and indexing
- support graph-aware evidence browsing

### Low Priority

- any deeper PM feature work
- more timeline views
- broader task workflows

## Suggested Navigation

Main navigation should eventually look more like:

- Systems
- Diagrams
- Investigations
- Patterns
- MCP

Not:

- Kanban
- Gantt
- Calendar
- Matrix

## Suggested MVP Packaging

### Solo Engineer / Consultant

Includes:

- local or self-hosted workspace
- diagrams with metadata
- troubleshooting sessions
- MCP access
- search and retrieval

Why it works:

- immediate ROI for one person who repeatedly debugs similar systems

### Small Team

Includes:

- shared workspace
- comments
- attachments
- reusable patterns
- role-based access

Why it works:

- stronger handoffs and less duplicate work

## Pricing Hypotheses

Possible pricing models:

- per seat for hosted team use
- per workspace for consultancies
- self-hosted license for private environments
- premium tier for advanced retrieval and cross-project knowledge controls

Avoid:

- competing on low-cost generic diagramming
- pricing like a broad PM suite without matching that feature depth

## What To Validate First

Talk to these users first:

- independent consultants
- engineering consultancies with 5 to 50 engineers
- SRE leads at small to mid-sized SaaS companies
- staff engineers who own architecture docs and incident response

Questions to validate:

- do they currently lose prior troubleshooting work?
- where is that work stored today?
- would they trust a diagram as the entry point?
- would they pay for private, reusable troubleshooting memory?
- what data cannot cross client or team boundaries?

## Near-Term Build Order

1. Node metadata
2. Edge metadata
3. Session model
4. Artifact model
5. Session UI
6. MCP session tools
7. Similar-session retrieval
8. Pattern extraction
9. Tenant and sharing controls

## Check Yourself

You are on the right path if:

- the product story starts with incidents, troubleshooting, and system understanding
- users can attach real evidence to the graph
- prior work is easy to discover later
- consultancies can reuse knowledge safely

You are drifting off course if:

- roadmap discussions spend more time on boards and calendars than on investigations
- the graph is visual only
- AI is present but not grounded in durable system context

## Rollback

If this direction proves weak, the fallback is not to restore full PM complexity.

The fallback is to remain a strong engineering diagram + MCP tool with metadata and documentation workflows, without expanding into incident memory as aggressively.
