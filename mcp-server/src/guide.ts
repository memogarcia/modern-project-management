import {
  DIAGRAM_PERSPECTIVE_KINDS,
  LINK_KINDS,
  NODE_SHAPE_TYPES,
  SESSION_COMMAND_STATUSES,
  SESSION_STATUSES,
  TIMELINE_ENTRY_KINDS,
} from "../../shared/planview/domain.js";

export const GUIDE_TOPICS = [
  "all",
  "diagrams",
  "metadata",
  "investigations",
  "artifacts",
  "patterns",
] as const;

export type GuideTopic = (typeof GUIDE_TOPICS)[number];

const SHAPE_HINTS: Record<(typeof NODE_SHAPE_TYPES)[number], string> = {
  service: "Use for an API, backend service, worker, or internal system component.",
  database: "Use for a durable data store such as PostgreSQL, MySQL, or DynamoDB.",
  gateway: "Use for ingress, API gateway, load balancer, or edge routing.",
  queue: "Use for asynchronous brokers and event streams such as Kafka or SQS.",
  client: "Use for user-facing callers such as browsers, mobile apps, or partner clients.",
  cloud: "Use for external managed platforms or broad cloud boundaries.",
  cache: "Use for Redis, Memcached, CDN cache layers, or short-lived shared state.",
  storage: "Use for object or file storage such as S3, blob stores, or shared volumes.",
  function: "Use for short-lived serverless or triggered compute units.",
  container: "Use when the container boundary itself matters more than the service role.",
  custom: "Use only when the built-in shapes do not fit the concept you need to show.",
};

function diagramSection() {
  return {
    intent: "Create or expand a system diagram incrementally instead of replacing the full Mermaid document.",
    workflow: [
      {
        step: 1,
        tool: "create_diagram",
        notes: "Start with a minimal flowchart such as `graph TD` when you want to add nodes and edges incrementally.",
        sampleArguments: {
          name: "Checkout Platform",
          description: "Customer checkout path and core dependencies",
          mermaidCode: "graph TD",
        },
      },
      {
        step: 2,
        tool: "add_node_to_diagram",
        notes: "Add one component at a time. Pick a stable `nodeId` such as `checkout_api` or `orders_db`.",
        sampleArguments: {
          id: "diagram-id",
          nodeId: "checkout_api",
          label: "Checkout API",
          shapeType: "service",
          description: "Handles customer checkout traffic",
        },
      },
      {
        step: 3,
        tool: "add_edge_to_diagram",
        notes: "Connect existing node IDs only. Use short labels such as `HTTPS`, `gRPC`, `SQL`, or `publishes`.",
        sampleArguments: {
          id: "diagram-id",
          source: "checkout_api",
          target: "orders_db",
          label: "SQL",
        },
      },
      {
        step: 4,
        tool: "get_diagram_metadata",
        notes: "Read back node IDs, edge IDs, counts, and revision before adding rich metadata or investigations.",
      },
    ],
    nodeShapeTypes: NODE_SHAPE_TYPES.map((shapeType) => ({
      shapeType,
      guidance: SHAPE_HINTS[shapeType],
    })),
    databaseModeling: {
      preferredTools: ["create_database_schema", "add_table_to_diagram", "add_relationship_to_diagram"],
      notes:
        "Use the database schema tools for ER diagrams. Do not mix `graph TD` flowchart edits with `erDiagram` table edits in the same document unless you are intentionally replacing the Mermaid source with `update_diagram`.",
    },
  };
}

function metadataSection() {
  return {
    intent: "Enrich nodes and edges with operational context that survives across app and MCP edits.",
    rules: [
      "Call `get_diagram_metadata` first so you can copy exact `nodeId`, `edgeId`, and `revision` values.",
      "`update_diagram_node_metadata` and `update_diagram_edge_metadata` replace the full metadata object for that entity. Send the complete desired object, not only changed fields.",
      "Keep timestamps in ISO 8601 format, for example `2026-03-24T03:00:00.000Z`.",
      "If you want an artifact to appear inside node metadata attachments, call `attach_artifact` first and then copy the returned artifact reference into `metadata.attachments` before updating the node metadata.",
    ],
    nodeChecklist: [
      "title: human-readable component name. Keep it aligned with the node label.",
      "owner: team or person responsible for the node.",
      "documentationLinks, dashboardLinks, logLinks, traceLinks, runbookLinks: use curated links instead of prose when possible.",
      "knownFailureModes: short recurring failure modes such as `connection exhaustion` or `stale cache`.",
      "notesMarkdown: durable context that does not fit cleanly in another field.",
    ],
    edgeChecklist: [
      "relationshipType: what kind of dependency this is, for example `dependency`, `event-stream`, or `replication`.",
      "protocol: transport or protocol such as `HTTPS`, `gRPC`, `postgres`, or `Kafka`.",
      "authAssumptions: auth model between the components.",
      "dependencyNotes and knownFailureModes: what breaks when this dependency degrades.",
    ],
    sampleNodeMetadata: {
      diagramId: "diagram-id",
      nodeId: "checkout_api",
      expectedRevision: 3,
      metadata: {
        title: "Checkout API",
        description: "Handles customer checkout traffic",
        tags: ["checkout", "critical"],
        owner: "checkout-team@example.com",
        documentationLinks: [],
        dashboardLinks: [
          {
            id: "checkout-dashboard",
            label: "Checkout Dashboard",
            url: "https://dash.example.dev/checkout",
            kind: "dashboard",
          },
        ],
        logLinks: [],
        traceLinks: [],
        runbookLinks: [],
        knownFailureModes: ["DB saturation"],
        notesMarkdown: "Keep this service within the checkout SLO.",
        attachments: [],
        createdAt: "2026-03-24T03:00:00.000Z",
        updatedAt: "2026-03-24T03:00:00.000Z",
      },
    },
  };
}

function investigationsSection() {
  return {
    intent: "Record incident context, commands, evidence, and resolution against the affected diagram entities.",
    workflow: [
      {
        step: 1,
        tool: "create_troubleshooting_session",
        notes: "Create the investigation after the relevant diagram already exists. Link node and edge IDs from `get_diagram_metadata`.",
      },
      {
        step: 2,
        tool: "append_session_timeline_entry",
        notes: "Capture observations, hypotheses, commands, status changes, and the final resolution in chronological order.",
      },
      {
        step: 3,
        tool: "append_session_comment",
        notes: "Store short human or agent commentary that should stay attached to the investigation.",
      },
      {
        step: 4,
        tool: "append_session_command",
        notes: "Record important shell, kubectl, SQL, or API commands along with a short outcome summary.",
      },
      {
        step: 5,
        tool: "link_session_to_entities",
        notes: "Expand the affected scope if the investigation later implicates more nodes or edges.",
      },
      {
        step: 6,
        tool: "update_troubleshooting_session",
        notes: "Move the session to `resolved` and record the durable fix in `resolutionSummary` when the incident is closed.",
      },
    ],
    statuses: SESSION_STATUSES,
    timelineKinds: TIMELINE_ENTRY_KINDS,
    commandStatuses: SESSION_COMMAND_STATUSES,
    sampleArguments: {
      diagramId: "diagram-id",
      title: "Checkout 503s",
      summary: "Customers see intermittent 503 responses during checkout",
      status: "open",
      linkedNodeIds: ["checkout_api"],
      linkedEdgeIds: ["edge-id"],
      notesMarkdown: "Started from latency and error-rate alerts.",
      hypotheses: ["Orders DB connection pool saturation"],
    },
  };
}

function artifactsSection() {
  return {
    intent: "Store durable evidence bytes in the artifact store and reference them from sessions or metadata.",
    rules: [
      "`attach_artifact` accepts raw file bytes as base64 in `contentBase64`.",
      "Use `ownerType` and `ownerId` to decide which entity owns the artifact: `session`, `node`, or `edge`.",
      "For binary or text evidence you want to preserve long term, store it as an artifact instead of pasting large blobs into notes fields.",
    ],
    sampleArguments: {
      ownerType: "session",
      ownerId: "checkout_503_session",
      diagramId: "diagram-id",
      label: "incident-log.txt",
      fileName: "incident-log.txt",
      mimeType: "text/plain",
      contentBase64: "Y2hlY2tvdXQgdGltZWxpbmUgZXZpZGVuY2U=",
    },
    followUp: "If the artifact should also appear on node metadata, read the returned artifact metadata and add it to the node's `attachments` array in a later `update_diagram_node_metadata` call.",
  };
}

function patternsSection() {
  return {
    intent: "Turn resolved investigation knowledge into reusable troubleshooting memory.",
    workflow: [
      "Use `search_troubleshooting_memory` before starting a new investigation to look for similar symptoms.",
      "Use `extract_knowledge_pattern` only after a session has enough signal to teach a repeatable symptom-to-resolution path.",
      "Use `list_knowledge_patterns` to enumerate reusable patterns after extraction.",
    ],
    sampleArguments: {
      sessionId: "checkout_503_session",
      pattern: {
        title: "Checkout DB pool exhaustion",
        summary: "Checkout returns 503 when DB pool saturation occurs.",
        symptom: "Customer-facing 503s under peak traffic",
        resolution: "Rollback connection-heavy deploy and scale DB pool.",
        tags: ["checkout", "postgres", "503"],
      },
    },
  };
}

const GUIDE_SECTIONS = {
  diagrams: diagramSection,
  metadata: metadataSection,
  investigations: investigationsSection,
  artifacts: artifactsSection,
  patterns: patternsSection,
} as const;

export function buildPlanViewGuide(topic: GuideTopic = "all") {
  const base = {
    summary:
      "Model topology first, then enrich nodes and edges with metadata, then record investigations, artifacts, and reusable patterns.",
    commonRules: [
      "Use stable IDs with letters, numbers, underscores, and hyphens.",
      "Prefer small incremental edits over replacing the entire Mermaid document unless you intentionally want to rewrite it.",
      "Read current state before mutation when you need node IDs, edge IDs, or a revision number.",
    ],
    enums: {
      nodeShapeTypes: NODE_SHAPE_TYPES,
      linkKinds: LINK_KINDS,
      sessionStatuses: SESSION_STATUSES,
      timelineEntryKinds: TIMELINE_ENTRY_KINDS,
      perspectiveKinds: DIAGRAM_PERSPECTIVE_KINDS,
    },
  };

  if (topic === "all") {
    return {
      ...base,
      sections: {
        diagrams: diagramSection(),
        metadata: metadataSection(),
        investigations: investigationsSection(),
        artifacts: artifactsSection(),
        patterns: patternsSection(),
      },
    };
  }

  return {
    ...base,
    topic,
    sections: {
      [topic]: GUIDE_SECTIONS[topic](),
    },
  };
}
