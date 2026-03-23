# Architecture-Backed Troubleshooting Memory

## TL;DR

- PlanView should stop competing as a general project management tool and become a diagram-first troubleshooting memory product for engineers, AI agents, and consultancies.
- The durable asset is not the diagram alone. It is the combination of system topology, operational metadata, investigation history, evidence, AI context, and reusable fixes.
- The strongest wedge is: private, MCP-native incident memory linked to architecture, with cross-project reuse through sanitized patterns instead of raw data sharing.

## Quickstart

If you need a product decision in five minutes, use this:

1. Keep the diagram editor and MCP server as the core of the product.
2. Remove or de-emphasize Kanban, Gantt, Calendar, and Matrix from the main story.
3. Add rich metadata, attachments, notes, and investigation sessions to nodes and edges.
4. Make retrieval and reuse the centerpiece: similar issue search, prior fixes, and reusable troubleshooting patterns.
5. Treat this as an engineering knowledge product, not a generic whiteboard or task manager.

## What You Are Building

You are building a troubleshooting workspace where:

- engineers describe the current architecture
- incidents and investigations are attached to the graph
- evidence is stored next to the affected components
- AI agents can read and update the same context through MCP
- future incidents can reuse prior reasoning, artifacts, and fixes

The product is best described as:

- architecture-backed troubleshooting memory
- incident memory graph for engineers
- private AI-operable operational knowledge base

## Why This Direction Is Better

### Situation

The current product mixes architecture diagrams with lightweight task management.

### Complication

That puts it into direct competition with mature platforms that already dominate project management, whiteboarding, and general collaboration.

### Question

Where is the strongest wedge for a smaller product to win?

### Answer

Focus on a narrow, high-value workflow where diagrams are the index for troubleshooting knowledge and where MCP access is a first-class capability.

## The Problem Worth Solving

Engineers repeatedly lose time because:

- incident context is scattered across Slack, dashboards, tickets, docs, and memory
- architecture diagrams are static and disconnected from operational reality
- AI tools lack durable, structured system context
- consultants solve the same class of issue multiple times across different clients
- teams cannot safely reuse learnings without also leaking sensitive data

The buyer does not care about “reasoning tokens.” The buyer cares about:

- lower MTTR
- less duplicated investigation work
- faster onboarding
- safer handoffs
- better reuse of prior incident knowledge

## Ideal Customers

### Best Initial ICP

- engineering consultancies
- SRE and platform teams
- senior engineers supporting multiple systems
- AI-heavy engineering teams using Claude, Cursor, Gemini, or ChatGPT with MCP workflows

### Strong Use Cases

- recurring production incidents
- architecture reviews tied to live systems
- cross-client operational playbooks
- troubleshooting handoffs between humans and agents
- preserving past investigations for future reuse

### Weak Use Cases

- broad project management for non-technical teams
- generic team whiteboarding
- lightweight task tracking as the primary workflow

## Product Positioning

### Positioning Statement

For engineers and consultancies who repeatedly troubleshoot complex systems, PlanView is a diagram-first troubleshooting memory workspace that links architecture, evidence, and prior investigations into a reusable operational knowledge graph. Unlike generic whiteboards or incident tools, it gives both humans and AI agents shared, structured context that persists across projects and incidents.

### What It Is Not

- not a Jira replacement
- not a general whiteboard
- not a generic PM suite
- not only a Mermaid editor

## Core Product Model

The data model should revolve around these objects:

- Workspace or Organization
- Client
- Project or System
- Diagram
- Node
- Edge
- Troubleshooting Session
- Artifact
- Finding
- Fix
- Reusable Pattern

### Node Metadata

Each node should support:

- description
- ownership
- tags
- linked dashboards
- linked logs and traces
- runbooks
- docs
- attachments
- rich text notes
- known failure modes
- last verified date

### Edge Metadata

Each edge should support:

- dependency type
- protocol
- auth assumptions
- latency or SLO relevance
- failure modes
- notes
- related incidents
- evidence

### Troubleshooting Session

Each session should support:

- incident title
- symptom
- affected nodes and edges
- timeline
- commands run
- screenshots, logs, and traces
- AI conversation history
- hypotheses
- decisions
- resolution
- reusable pattern extraction

## Key Differentiators

The credible differentiators are:

- diagram-first operational memory
- MCP-native access for AI agents
- private and local-first deployment options
- cross-project reuse with explicit sanitization
- richer node and edge metadata than standard diagram tools

These are materially stronger than the current PM feature set.

## Market Reality

This market is real, but it is not empty.

Relevant competitors already cover adjacent areas:

- Rootly and FireHydrant cover incident management and AI-assisted response
- Atlassian Compass covers service and component catalogs
- Miro, Lucidchart, Mermaid, and draw.io cover diagramming and collaboration
- ClickUp and Notion cover broad AI workspace positioning

The opening is not “another all-in-one productivity app.”

The opening is:

- engineering-native
- troubleshooting-first
- architecture-indexed
- MCP-accessible
- privacy-conscious

## Biggest Risks

### 1. Cross-Client Data Leakage

Consultancies need reuse, but not raw context sharing across clients.

You need:

- tenant isolation
- private-by-default sessions
- explicit extraction of reusable patterns
- redaction before publishing shared knowledge
- approval controls for shared memory

### 2. Diagram Rot

If diagrams are manual and stale, the product loses trust quickly.

You need:

- imports from Mermaid, IaC, Kubernetes manifests, and docs
- quick editing for partial updates
- freshness markers on nodes and edges
- session-driven updates back into the graph

### 3. Weak Retrieval

If “similar issue” retrieval is poor, the entire knowledge-memory story breaks.

You need:

- semantic search over sessions and notes
- graph-aware retrieval by affected node and edge
- pattern extraction from resolved incidents
- ranking by similarity, recency, and confidence

## What To Cut

Remove or de-emphasize:

- Kanban as a primary workflow
- Gantt
- Calendar
- Matrix

At most, keep minimal follow-up items linked to investigations.

## What To Keep

Keep and invest in:

- diagram editor
- Mermaid sync
- MCP server
- shared persistence
- export and import
- structured graph metadata

## Success Metrics

Good early product metrics:

- time to create a useful troubleshooting session
- percentage of incidents linked to nodes and edges
- retrieval success rate for similar prior cases
- number of reusable patterns extracted per month
- repeat usage by consultants across multiple clients
- reduction in duplicated troubleshooting work

## Product Thesis

The best path to revenue is not a broad collaboration platform.

The best path is a focused engineering product where:

- architecture becomes the memory index
- troubleshooting work becomes durable
- AI agents operate against real system context
- teams and consultancies stop paying for the same learning twice

## Decision

PlanView should pivot to a diagram-first troubleshooting memory product and treat task management as secondary or removable.
